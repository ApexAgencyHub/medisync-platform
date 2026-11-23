import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  AppointmentSummarySchema,
  AvailableSlotSchema,
  DoctorProfileSummarySchema,
  DoctorScheduleSummarySchema,
  type AppointmentListQuery,
  type AppointmentStatus,
  type AppointmentSummary,
  type AvailableSlot,
  type CreateAppointmentInput,
  type CreateScheduleInput,
  type DoctorProfileSummary,
  type DoctorScheduleSummary,
  type ScheduleListQuery,
  type SlotsQuery,
  type UpdateScheduleInput,
  type UpsertDoctorProfileInput,
  type UserRole,
  type VisitMode,
} from "@medisync/contracts";
import { appendAuditLog, type AuthTokenClaims } from "../foundation/index.js";
import {
  createSigV4PresignedUrl,
  type S3PresignConfig,
} from "../../shared/storage/s3-presign.js";
import {
  generateScheduleSlotsForDate,
  hasTimeOverlap,
  parseUtcDate,
} from "./slot-engine.js";

function withPresignedImageUrl(
  row: Record<string, unknown>,
  objectKeyField: "avatarObjectKey" | "doctorAvatarObjectKey",
  targetField: "avatarUrl" | "doctorAvatarUrl",
  s3Config?: S3PresignConfig,
  urlCache?: Map<string, string>,
): Record<string, unknown> {
  const rawKey = row[objectKeyField];
  const objectKey =
    typeof rawKey === "string" && rawKey.length > 0 ? rawKey : null;
  let signedUrl: string | null = null;
  if (objectKey && s3Config) {
    const cached = urlCache?.get(objectKey);
    if (cached) {
      signedUrl = cached;
    } else {
      signedUrl = createSigV4PresignedUrl({
        config: s3Config,
        method: "GET",
        objectKey,
      });
      urlCache?.set(objectKey, signedUrl);
    }
  }
  return {
    ...row,
    [targetField]: signedUrl,
  };
}

export class BookingBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingBadRequestError";
  }
}

export class BookingForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingForbiddenError";
  }
}

export class BookingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingNotFoundError";
  }
}

export class SlotAlreadyBookedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlotAlreadyBookedError";
  }
}

export class BookingInvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingInvalidTransitionError";
  }
}

const ALLOWED_STATUS_TRANSITIONS: Record<
  AppointmentStatus,
  readonly AppointmentStatus[]
> = {
  CONFIRMED: ["CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const ScheduleQueryRowSchema = DoctorScheduleSummarySchema.extend({
  consultationFeeMinor: z.number().int().min(0),
  telehealthEnabled: z.boolean().default(true),
});

const OccupiedRangeSchema = z.object({
  doctorUserId: z.string().uuid(),
  startMs: z.coerce.number(),
  endMs: z.coerce.number(),
});

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

const APPOINTMENT_SELECT_COLUMNS = `
  a.id,
  a.country_code AS "countryCode",
  a.schedule_id AS "scheduleId",
  a.facility_id AS "facilityId",
  f.name AS "facilityName",
  a.doctor_user_id AS "doctorUserId",
  doc.full_name AS "doctorName",
  doc.avatar_object_key AS "doctorAvatarObjectKey",
  COALESCE(dp.specialty, 'General Practice') AS "specialty",
  a.patient_user_id AS "patientUserId",
  pat.full_name AS "patientName",
  pat.phone AS "patientPhone",
  a.booked_by_user_id AS "bookedByUserId",
  a.visit_mode AS "visitMode",
  to_char(a.slot_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "slotStartIso",
  to_char(a.slot_end_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "slotEndIso",
  a.status,
  a.reason,
  a.triage_note AS "triageNote",
  to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso",
  to_char(a.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"
`;

export async function fetchHydratedAppointmentById(
  db: Pick<Pool, "query"> | PoolClient,
  id: string,
  s3Config?: S3PresignConfig,
): Promise<AppointmentSummary | null> {
  const res = await db.query(
    `SELECT ${APPOINTMENT_SELECT_COLUMNS}
     FROM appointments a
     JOIN facilities f ON f.id = a.facility_id
     JOIN users doc ON doc.id = a.doctor_user_id
     JOIN users pat ON pat.id = a.patient_user_id
     LEFT JOIN doctor_profiles dp ON dp.doctor_user_id = a.doctor_user_id
     WHERE a.id = $1`,
    [id],
  );
  if (res.rowCount === 0) return null;
  return AppointmentSummarySchema.parse(
    withPresignedImageUrl(
      res.rows[0] as Record<string, unknown>,
      "doctorAvatarObjectKey",
      "doctorAvatarUrl",
      s3Config,
    ),
  );
}

function isPractitionerRole(role: UserRole): boolean {
  return role === "DOCTOR" || role === "NURSE";
}

export async function upsertDoctorProfile(
  pool: Pool,
  actor: AuthTokenClaims,
  input: UpsertDoctorProfileInput,
  s3Config?: S3PresignConfig,
): Promise<DoctorProfileSummary> {
  const targetDoctorId = isPractitionerRole(actor.role)
    ? actor.sub
    : input.doctorUserId ?? actor.sub;

  if (
    isPractitionerRole(actor.role) &&
    input.doctorUserId &&
    input.doctorUserId !== actor.sub
  ) {
    throw new BookingForbiddenError(
      "Practitioners can only update their own clinical profile.",
    );
  }

  const userRes = await pool.query<{
    id: string;
    fullName: string;
    role: UserRole;
    countryCode: string;
  }>(
    `SELECT id, full_name AS "fullName", role, country_code AS "countryCode"
     FROM users WHERE id = $1`,
    [targetDoctorId],
  );
  const doctorRow = userRes.rows[0];
  if (!doctorRow || !isPractitionerRole(doctorRow.role)) {
    throw new BookingBadRequestError(
      "Target user must be a registered DOCTOR or NURSE.",
    );
  }
  if (actor.role !== "OPS_ADMIN" && doctorRow.countryCode !== actor.countryCode) {
    throw new BookingForbiddenError(
      "Cannot modify doctor profiles across national jurisdictions.",
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO doctor_profiles (
         doctor_user_id,
         country_code,
         specialty,
         license_number,
         consultation_fee_minor,
         bio,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (doctor_user_id) DO UPDATE SET
         specialty = EXCLUDED.specialty,
         license_number = EXCLUDED.license_number,
         consultation_fee_minor = EXCLUDED.consultation_fee_minor,
         bio = EXCLUDED.bio,
         updated_at = NOW()`,
      [
        doctorRow.id,
        doctorRow.countryCode,
        input.specialty,
        input.licenseNumber,
        input.consultationFeeMinor,
        input.bio ?? null,
      ],
    );

    await appendAuditLog(client, {
      countryCode: doctorRow.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "DOCTOR_PROFILE_UPSERTED",
      resourceType: "doctor_profile",
      resourceId: doctorRow.id,
      metadata: { specialty: input.specialty },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const readRes = await pool.query(
    `SELECT
       dp.doctor_user_id AS "doctorUserId",
       u.full_name AS "doctorName",
       u.avatar_object_key AS "avatarObjectKey",
       dp.country_code AS "countryCode",
       dp.specialty,
       dp.license_number AS "licenseNumber",
       dp.consultation_fee_minor AS "consultationFeeMinor",
       dp.bio,
       to_char(dp.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"
     FROM doctor_profiles dp
     JOIN users u ON u.id = dp.doctor_user_id
     WHERE dp.doctor_user_id = $1`,
    [doctorRow.id],
  );
  return DoctorProfileSummarySchema.parse(
    withPresignedImageUrl(
      readRes.rows[0] as Record<string, unknown>,
      "avatarObjectKey",
      "avatarUrl",
      s3Config,
    ),
  );
}

export async function listDoctorProfiles(
  pool: Pool,
  countryCode?: string,
  s3Config?: S3PresignConfig,
): Promise<DoctorProfileSummary[]> {
  const res = await pool.query(
    `SELECT
       dp.doctor_user_id AS "doctorUserId",
       u.full_name AS "doctorName",
       u.avatar_object_key AS "avatarObjectKey",
       dp.country_code AS "countryCode",
       dp.specialty,
       dp.license_number AS "licenseNumber",
       dp.consultation_fee_minor AS "consultationFeeMinor",
       dp.bio,
       to_char(dp.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "updatedAtIso"
     FROM doctor_profiles dp
     JOIN users u ON u.id = dp.doctor_user_id
     WHERE u.account_status = 'ACTIVE'
       AND ($1::text IS NULL OR dp.country_code = $1)
     ORDER BY dp.updated_at DESC
     LIMIT 100`,
    [countryCode ?? null],
  );
  return res.rows.map((row) =>
    DoctorProfileSummarySchema.parse(
      withPresignedImageUrl(
        row as Record<string, unknown>,
        "avatarObjectKey",
        "avatarUrl",
        s3Config,
      ),
    ),
  );
}

export async function createDoctorSchedule(
  pool: Pool,
  actor: AuthTokenClaims,
  input: CreateScheduleInput,
): Promise<DoctorScheduleSummary> {
  const targetDoctorId = isPractitionerRole(actor.role)
    ? actor.sub
    : input.doctorUserId ?? "";

  if (!targetDoctorId) {
    throw new BookingBadRequestError(
      "doctorUserId is required when publishing schedules on behalf of a practitioner.",
    );
  }
  if (
    isPractitionerRole(actor.role) &&
    input.doctorUserId &&
    input.doctorUserId !== actor.sub
  ) {
    throw new BookingForbiddenError(
      "Practitioners can only publish their own shift schedules.",
    );
  }

  const [facilityRes, doctorRes] = await Promise.all([
    pool.query<{
      id: string;
      countryCode: string;
      verificationStatus: string;
      name: string;
    }>(
      `SELECT
         id,
         country_code AS "countryCode",
         verification_status AS "verificationStatus",
         name
       FROM facilities WHERE id = $1`,
      [input.facilityId],
    ),
    pool.query<{
      id: string;
      fullName: string;
      role: UserRole;
      countryCode: string;
    }>(
      `SELECT id, full_name AS "fullName", role, country_code AS "countryCode"
       FROM users WHERE id = $1`,
      [targetDoctorId],
    ),
  ]);
  const facility = facilityRes.rows[0];
  if (!facility) {
    throw new BookingNotFoundError("Target facility was not found.");
  }
  if (facility.verificationStatus === "SUSPENDED") {
    throw new BookingForbiddenError(
      "Cannot publish schedules for a suspended facility.",
    );
  }

  const doctor = doctorRes.rows[0];
  if (!doctor || !isPractitionerRole(doctor.role)) {
    throw new BookingBadRequestError(
      "Target user must be a registered DOCTOR or NURSE.",
    );
  }

  if (doctor.countryCode !== facility.countryCode) {
    throw new BookingForbiddenError(
      "Doctor and facility must belong to the same CountryPack jurisdiction.",
    );
  }
  if (actor.role !== "OPS_ADMIN" && actor.countryCode !== facility.countryCode) {
    throw new BookingForbiddenError(
      "Cannot manage schedules outside your assigned CountryPack jurisdiction.",
    );
  }

  const client = await pool.connect();
  let insertedId: string;
  try {
    await client.query("BEGIN");
    const insertRes = await client.query<{ id: string }>(
      `INSERT INTO doctor_schedules (
         country_code,
         doctor_user_id,
         facility_id,
         day_of_week,
         start_time_utc,
         end_time_utc,
         slot_duration_minutes,
         visit_mode
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        facility.countryCode,
        doctor.id,
        facility.id,
        input.dayOfWeek,
        input.startTimeUtc,
        input.endTimeUtc,
        input.slotDurationMinutes,
        input.visitMode,
      ],
    );
    const createdRow = insertRes.rows[0];
    if (!createdRow) {
      throw new Error("Failed to insert doctor schedule row.");
    }
    insertedId = createdRow.id;

    await appendAuditLog(client, {
      countryCode: facility.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "DOCTOR_SCHEDULE_CREATED",
      resourceType: "doctor_schedule",
      resourceId: insertedId,
      metadata: {
        doctorUserId: doctor.id,
        facilityId: facility.id,
        dayOfWeek: input.dayOfWeek,
        visitMode: input.visitMode,
      },
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const created = await fetchHydratedScheduleById(pool, insertedId);
  if (!created) {
    throw new Error("Inserted schedule could not be retrieved.");
  }
  return created;
}

async function fetchHydratedScheduleById(
  db: Pick<Pool, "query"> | PoolClient,
  scheduleId: string,
): Promise<DoctorScheduleSummary | null> {
  const res = await db.query(
    `SELECT
       s.id,
       s.country_code AS "countryCode",
       s.doctor_user_id AS "doctorUserId",
       doc.full_name AS "doctorName",
       COALESCE(dp.specialty, 'General Practice') AS "specialty",
       s.facility_id AS "facilityId",
       f.name AS "facilityName",
       s.day_of_week AS "dayOfWeek",
       s.start_time_utc AS "startTimeUtc",
       s.end_time_utc AS "endTimeUtc",
       s.slot_duration_minutes AS "slotDurationMinutes",
       s.visit_mode AS "visitMode",
       s.is_active AS "isActive",
       to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
     FROM doctor_schedules s
     JOIN users doc ON doc.id = s.doctor_user_id
     JOIN facilities f ON f.id = s.facility_id
     LEFT JOIN doctor_profiles dp ON dp.doctor_user_id = s.doctor_user_id
     WHERE s.id = $1
     LIMIT 1`,
    [scheduleId],
  );
  if (res.rowCount === 0) return null;
  return DoctorScheduleSummarySchema.parse(res.rows[0]);
}

export async function listDoctorSchedules(
  pool: Pool,
  query: ScheduleListQuery,
): Promise<DoctorScheduleSummary[]> {
  const res = await pool.query(
    `SELECT
       s.id,
       s.country_code AS "countryCode",
       s.doctor_user_id AS "doctorUserId",
       doc.full_name AS "doctorName",
       COALESCE(dp.specialty, 'General Practice') AS "specialty",
       s.facility_id AS "facilityId",
       f.name AS "facilityName",
       s.day_of_week AS "dayOfWeek",
       s.start_time_utc AS "startTimeUtc",
       s.end_time_utc AS "endTimeUtc",
       s.slot_duration_minutes AS "slotDurationMinutes",
       s.visit_mode AS "visitMode",
       s.is_active AS "isActive",
       to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
     FROM doctor_schedules s
     JOIN users doc ON doc.id = s.doctor_user_id
     JOIN facilities f ON f.id = s.facility_id
     LEFT JOIN doctor_profiles dp ON dp.doctor_user_id = s.doctor_user_id
     WHERE ($5::boolean IS TRUE OR s.is_active = TRUE)
       AND ($1::text IS NULL OR s.country_code = $1)
       AND ($2::uuid IS NULL OR s.facility_id = $2)
       AND ($3::uuid IS NULL OR s.doctor_user_id = $3)
     ORDER BY s.is_active DESC, s.day_of_week ASC, s.start_time_utc ASC
     LIMIT $4`,
    [
      query.countryCode ?? null,
      query.facilityId ?? null,
      query.doctorUserId ?? null,
      query.limit,
      Boolean(query.includeInactive),
    ],
  );
  return res.rows.map((row) => DoctorScheduleSummarySchema.parse(row));
}

export async function queryAvailableSlots(
  pool: Pool,
  query: SlotsQuery,
): Promise<AvailableSlot[]> {
  const parsedDate = parseUtcDate(query.date);
  if (!parsedDate) {
    throw new BookingBadRequestError("Invalid calendar date.");
  }

  const scheduleRes = await pool.query(
    `SELECT
       s.id,
       s.country_code AS "countryCode",
       s.doctor_user_id AS "doctorUserId",
       doc.full_name AS "doctorName",
       COALESCE(dp.specialty, 'General Practice') AS "specialty",
       COALESCE(dp.consultation_fee_minor, 0) AS "consultationFeeMinor",
       COALESCE(dp.telehealth_enabled, TRUE) AS "telehealthEnabled",
       s.facility_id AS "facilityId",
       f.name AS "facilityName",
       s.day_of_week AS "dayOfWeek",
       s.start_time_utc AS "startTimeUtc",
       s.end_time_utc AS "endTimeUtc",
       s.slot_duration_minutes AS "slotDurationMinutes",
       s.visit_mode AS "visitMode",
       s.is_active AS "isActive",
       to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
     FROM doctor_schedules s
     JOIN users doc ON doc.id = s.doctor_user_id
     JOIN facilities f ON f.id = s.facility_id
     LEFT JOIN doctor_profiles dp ON dp.doctor_user_id = s.doctor_user_id
     WHERE s.is_active = TRUE
       AND doc.account_status = 'ACTIVE'
       AND f.verification_status <> 'SUSPENDED'
       AND s.day_of_week = $1
       AND ($2::text IS NULL OR s.country_code = $2)
       AND ($3::uuid IS NULL OR s.facility_id = $3)
       AND ($4::uuid IS NULL OR s.doctor_user_id = $4)
       AND (
         $5::text IS NULL
         OR ($5 = 'HOME_VISIT' AND s.visit_mode = 'HOME_VISIT')
         OR ($5 = 'IN_PERSON' AND s.visit_mode IN ('IN_PERSON', 'TELEHEALTH'))
         OR ($5 = 'TELEHEALTH' AND s.visit_mode IN ('IN_PERSON', 'TELEHEALTH') AND COALESCE(dp.telehealth_enabled, TRUE) = TRUE)
       )
       AND ($6::text IS NULL OR COALESCE(dp.specialty, 'General Practice') ILIKE '%' || $6 || '%')
     ORDER BY s.start_time_utc ASC, f.name ASC
     LIMIT 120`,
    [
      parsedDate.dayOfWeek,
      query.countryCode ?? null,
      query.facilityId ?? null,
      query.doctorUserId ?? null,
      query.visitMode ?? null,
      query.specialty ?? null,
    ],
  );

  const schedules = scheduleRes.rows.map((row) =>
    ScheduleQueryRowSchema.parse(row),
  );
  if (schedules.length === 0) {
    return [];
  }

  const doctorIds = [...new Set(schedules.map((s) => s.doctorUserId))];
  const occupiedRes = await pool.query(
    `SELECT
       doctor_user_id AS "doctorUserId",
       EXTRACT(EPOCH FROM slot_start_at) * 1000 AS "startMs",
       EXTRACT(EPOCH FROM slot_end_at) * 1000 AS "endMs"
     FROM appointments
     WHERE doctor_user_id = ANY($1::uuid[])
       AND status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')
       AND slot_start_at < $3::timestamptz
       AND slot_end_at > $2::timestamptz`,
    [
      doctorIds,
      new Date(parsedDate.dayStartMs).toISOString(),
      new Date(parsedDate.dayEndMs).toISOString(),
    ],
  );

  const occupiedByDoctor = new Map<string, Array<{ startMs: number; endMs: number }>>();
  for (const row of occupiedRes.rows) {
    const parsedRow = OccupiedRangeSchema.parse(row);
    const list = occupiedByDoctor.get(parsedRow.doctorUserId) ?? [];
    list.push({ startMs: parsedRow.startMs, endMs: parsedRow.endMs });
    occupiedByDoctor.set(parsedRow.doctorUserId, list);
  }

  const results: AvailableSlot[] = [];
  for (const schedule of schedules) {
    const generated = generateScheduleSlotsForDate(schedule, parsedDate);
    const busyIntervals = occupiedByDoctor.get(schedule.doctorUserId) ?? [];

    for (const slot of generated) {
      const conflicts = busyIntervals.some((busy) =>
        hasTimeOverlap(slot.startMs, slot.endMs, busy.startMs, busy.endMs),
      );
      const isAvailable = !conflicts;
      if (!isAvailable && !query.includeBooked) {
        continue;
      }

      const effectiveSlotVisitMode: VisitMode =
        query.visitMode && schedule.visitMode !== "HOME_VISIT"
          ? query.visitMode
          : schedule.visitMode;

      results.push(
        AvailableSlotSchema.parse({
          scheduleId: schedule.id,
          doctorUserId: schedule.doctorUserId,
          doctorName: schedule.doctorName,
          specialty: schedule.specialty,
          facilityId: schedule.facilityId,
          facilityName: schedule.facilityName,
          countryCode: schedule.countryCode,
          visitMode: effectiveSlotVisitMode,
          consultationFeeMinor: schedule.consultationFeeMinor,
          slotStartIso: slot.slotStartIso,
          slotEndIso: slot.slotEndIso,
          isAvailable,
        }),
      );
    }
  }

  results.sort((a, b) => a.slotStartIso.localeCompare(b.slotStartIso));
  return results;
}

export async function createAppointmentTransactional(
  pool: Pool,
  actor: AuthTokenClaims,
  input: CreateAppointmentInput,
  s3Config?: S3PresignConfig,
): Promise<AppointmentSummary> {
  const targetPatientId =
    actor.role === "PATIENT" ? actor.sub : input.patientUserId ?? actor.sub;

  if (
    actor.role === "PATIENT" &&
    input.patientUserId &&
    input.patientUserId !== actor.sub
  ) {
    throw new BookingForbiddenError(
      "Patients can only book appointments for themselves.",
    );
  }

  const slotStartDate = new Date(input.slotStartIso);
  if (Number.isNaN(slotStartDate.getTime())) {
    throw new BookingBadRequestError("Invalid slotStartIso timestamp.");
  }
  const slotDateStr = slotStartDate.toISOString().slice(0, 10);
  const parsedDate = parseUtcDate(slotDateStr);
  if (!parsedDate) {
    throw new BookingBadRequestError("Invalid slot calendar date.");
  }

  const client = await pool.connect();
  let insertedId: string;

  try {
    await client.query("BEGIN");

    const schedRes = await client.query<{
      id: string;
      countryCode: string;
      doctorUserId: string;
      facilityId: string;
      dayOfWeek: number;
      startTimeUtc: string;
      endTimeUtc: string;
      slotDurationMinutes: number;
      visitMode: VisitMode;
      telehealthEnabled: boolean;
      isActive: boolean;
      verificationStatus: string;
    }>(
      `SELECT
         s.id,
         s.country_code AS "countryCode",
         s.doctor_user_id AS "doctorUserId",
         s.facility_id AS "facilityId",
         s.day_of_week AS "dayOfWeek",
         s.start_time_utc AS "startTimeUtc",
         s.end_time_utc AS "endTimeUtc",
         s.slot_duration_minutes AS "slotDurationMinutes",
         s.visit_mode AS "visitMode",
         COALESCE(dp.telehealth_enabled, TRUE) AS "telehealthEnabled",
         s.is_active AS "isActive",
         f.verification_status AS "verificationStatus"
       FROM doctor_schedules s
       JOIN facilities f ON f.id = s.facility_id
       LEFT JOIN doctor_profiles dp ON dp.doctor_user_id = s.doctor_user_id
       WHERE s.id = $1`,
      [input.scheduleId],
    );

    const schedule = schedRes.rows[0];
    if (!schedule || !schedule.isActive) {
      throw new BookingNotFoundError("Doctor schedule not found or inactive.");
    }
    if (schedule.verificationStatus === "SUSPENDED") {
      throw new BookingForbiddenError("Facility is suspended.");
    }

    // Lock both doctor and patient rows in deterministic sorted UUID order to prevent concurrent overlaps without deadlocks
    const lockUserIds = [...new Set([schedule.doctorUserId, targetPatientId])].sort();
    await client.query(
      `SELECT id FROM users WHERE id = ANY($1::uuid[]) ORDER BY id ASC FOR UPDATE`,
      [lockUserIds],
    );

    const patientRes = await client.query<{
      id: string;
      countryCode: string;
    }>(
      `SELECT id, country_code AS "countryCode" FROM users WHERE id = $1`,
      [targetPatientId],
    );
    const patient = patientRes.rows[0];
    if (!patient) {
      throw new BookingNotFoundError("Patient account not found.");
    }

    if (
      actor.role !== "OPS_ADMIN" &&
      (actor.countryCode !== schedule.countryCode ||
        patient.countryCode !== schedule.countryCode)
    ) {
      throw new BookingForbiddenError(
        "Cross-country booking is prohibited by CountryPack tenancy.",
      );
    }

    const effectiveVisitMode: VisitMode = input.visitMode ?? schedule.visitMode;
    if (schedule.visitMode === "HOME_VISIT") {
      if (effectiveVisitMode !== "HOME_VISIT") {
        throw new BookingBadRequestError(
          "Home nursing schedule only supports HOME_VISIT consultations.",
        );
      }
    } else {
      if (effectiveVisitMode === "HOME_VISIT") {
        throw new BookingBadRequestError(
          "Doctor clinic schedules only support IN_PERSON workplace visits or TELEHEALTH video calls.",
        );
      }
      if (effectiveVisitMode === "TELEHEALTH" && !schedule.telehealthEnabled) {
        throw new BookingBadRequestError(
          "This doctor only supports IN_PERSON workplace consultations.",
        );
      }
    }

    const generated = generateScheduleSlotsForDate(schedule, parsedDate);
    const matchingSlot = generated.find(
      (s) => s.startMs === slotStartDate.getTime(),
    );
    if (!matchingSlot) {
      throw new BookingBadRequestError(
        "Requested slotStartIso does not match an active schedule slot boundary.",
      );
    }

    // Check overlap across ALL clinics for this doctor AND for the same patient
    const overlapRes = await client.query<{ id: string; doctorConflict: boolean }>(
      `SELECT
         id,
         (doctor_user_id = $1) AS "doctorConflict"
       FROM appointments
       WHERE status IN ('CONFIRMED', 'CHECKED_IN', 'COMPLETED')
         AND (doctor_user_id = $1 OR patient_user_id = $2)
         AND slot_start_at < $4::timestamptz
         AND slot_end_at > $3::timestamptz
       LIMIT 1`,
      [
        schedule.doctorUserId,
        targetPatientId,
        matchingSlot.slotStartIso,
        matchingSlot.slotEndIso,
      ],
    );

    const conflict = overlapRes.rows[0];
    if (conflict) {
      throw new SlotAlreadyBookedError(
        conflict.doctorConflict
          ? "Doctor is already booked for this time slot at this or another clinic."
          : "Patient already has an overlapping active appointment.",
      );
    }

    const insertRes = await client.query<{ id: string }>(
      `INSERT INTO appointments (
         country_code,
         schedule_id,
         facility_id,
         doctor_user_id,
         patient_user_id,
         booked_by_user_id,
         visit_mode,
         slot_start_at,
         slot_end_at,
         reason
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz, $10)
       RETURNING id`,
      [
        schedule.countryCode,
        schedule.id,
        schedule.facilityId,
        schedule.doctorUserId,
        targetPatientId,
        actor.sub,
        effectiveVisitMode,
        matchingSlot.slotStartIso,
        matchingSlot.slotEndIso,
        input.reason ?? null,
      ],
    );

    const row = insertRes.rows[0];
    if (!row) {
      throw new Error("Failed to insert appointment.");
    }
    insertedId = row.id;

    await appendAuditLog(client, {
      countryCode: schedule.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "APPOINTMENT_BOOKED",
      resourceType: "appointment",
      resourceId: insertedId,
      metadata: {
        doctorUserId: schedule.doctorUserId,
        facilityId: schedule.facilityId,
        patientUserId: targetPatientId,
        visitMode: effectiveVisitMode,
        slotStartIso: matchingSlot.slotStartIso,
      },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(err)) {
      throw new SlotAlreadyBookedError(
        "This doctor slot was just booked by another concurrent request.",
      );
    }
    throw err;
  } finally {
    client.release();
  }

  const hydrated = await fetchHydratedAppointmentById(pool, insertedId, s3Config);
  if (!hydrated) {
    throw new Error("Booked appointment could not be retrieved.");
  }
  return hydrated;
}

export async function listAppointmentsScoped(
  pool: Pool,
  actor: AuthTokenClaims,
  query: AppointmentListQuery,
  s3Config?: S3PresignConfig,
): Promise<AppointmentSummary[]> {
  let effectiveCountry: string | null = actor.countryCode;
  if (actor.role === "OPS_ADMIN") {
    effectiveCountry = query.countryCode ?? null;
  } else if (query.countryCode && query.countryCode !== actor.countryCode) {
    throw new BookingForbiddenError(
      "Cross-country appointment access is restricted to OPS_ADMIN.",
    );
  }

  const patientScopeId =
    actor.role === "PATIENT" || actor.role === "CAREGIVER" ? actor.sub : null;
  const doctorScopeId = isPractitionerRole(actor.role)
    ? actor.sub
    : query.doctorUserId ?? null;

  const res = await pool.query(
    `SELECT ${APPOINTMENT_SELECT_COLUMNS}
     FROM appointments a
     JOIN facilities f ON f.id = a.facility_id
     JOIN users doc ON doc.id = a.doctor_user_id
     JOIN users pat ON pat.id = a.patient_user_id
     LEFT JOIN doctor_profiles dp ON dp.doctor_user_id = a.doctor_user_id
     WHERE ($1::text IS NULL OR a.country_code = $1)
       AND ($2::uuid IS NULL OR a.facility_id = $2)
       AND ($3::uuid IS NULL OR a.doctor_user_id = $3)
       AND ($4::text IS NULL OR a.status = $4)
       AND ($5::uuid IS NULL OR (a.patient_user_id = $5 OR a.booked_by_user_id = $5))
     ORDER BY a.slot_start_at ASC, a.created_at DESC
     LIMIT $6`,
    [
      effectiveCountry,
      query.facilityId ?? null,
      doctorScopeId,
      query.status ?? null,
      patientScopeId,
      query.limit,
    ],
  );
  const signedAvatarCache = new Map<string, string>();
  return res.rows.map((row) =>
    AppointmentSummarySchema.parse(
      withPresignedImageUrl(
        row as Record<string, unknown>,
        "doctorAvatarObjectKey",
        "doctorAvatarUrl",
        s3Config,
        signedAvatarCache,
      ),
    ),
  );
}

export async function transitionAppointmentStatus(
  pool: Pool,
  appointmentId: string,
  actor: AuthTokenClaims,
  nextStatus: AppointmentStatus,
  note?: string,
  s3Config?: S3PresignConfig,
): Promise<AppointmentSummary> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const currentRes = await client.query<{
      id: string;
      countryCode: string;
      doctorUserId: string;
      patientUserId: string;
      bookedByUserId: string;
      status: AppointmentStatus;
    }>(
      `SELECT
         id,
         country_code AS "countryCode",
         doctor_user_id AS "doctorUserId",
         patient_user_id AS "patientUserId",
         booked_by_user_id AS "bookedByUserId",
         status
       FROM appointments WHERE id = $1 FOR UPDATE`,
      [appointmentId],
    );

    const existing = currentRes.rows[0];
    if (!existing) {
      throw new BookingNotFoundError("Appointment not found.");
    }

    if (actor.role !== "OPS_ADMIN" && existing.countryCode !== actor.countryCode) {
      throw new BookingForbiddenError(
        "Cross-country appointment access is forbidden.",
      );
    }

    if (actor.role === "PATIENT" || actor.role === "CAREGIVER") {
      const ownsBooking =
        existing.patientUserId === actor.sub ||
        existing.bookedByUserId === actor.sub;
      if (!ownsBooking || nextStatus !== "CANCELLED") {
        throw new BookingForbiddenError(
          "Patients and caregivers may only cancel their own appointments.",
        );
      }
    } else if (isPractitionerRole(actor.role)) {
      if (existing.doctorUserId !== actor.sub) {
        throw new BookingForbiddenError(
          "Practitioners can only update their own appointments.",
        );
      }
    } else if (
      actor.role !== "CLINIC_STAFF" &&
      actor.role !== "HOSPITAL_ADMIN" &&
      actor.role !== "OPS_ADMIN"
    ) {
      throw new BookingForbiddenError("Role is not permitted to update bookings.");
    }

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[existing.status];
    if (!allowedNext.includes(nextStatus)) {
      throw new BookingInvalidTransitionError(
        `Cannot transition appointment from ${existing.status} to ${nextStatus}.`,
      );
    }

    await client.query(
      `UPDATE appointments
       SET status = $2,
           triage_note = COALESCE($3, triage_note),
           updated_at = NOW()
       WHERE id = $1`,
      [appointmentId, nextStatus, note ?? null],
    );

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "APPOINTMENT_STATUS_UPDATED",
      resourceType: "appointment",
      resourceId: appointmentId,
      metadata: {
        fromStatus: existing.status,
        toStatus: nextStatus,
      },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const updated = await fetchHydratedAppointmentById(pool, appointmentId, s3Config);
  if (!updated) {
    throw new Error("Updated appointment not found.");
  }
  return updated;
}

async function loadAuthorizedScheduleForMutation(
  client: PoolClient,
  scheduleId: string,
  actor: AuthTokenClaims,
): Promise<{
  id: string;
  countryCode: string;
  doctorUserId: string;
  facilityId: string;
  startTimeUtc: string;
  endTimeUtc: string;
  slotDurationMinutes: number;
}> {
  const res = await client.query<{
    id: string;
    countryCode: string;
    doctorUserId: string;
    facilityId: string;
    startTimeUtc: string;
    endTimeUtc: string;
    slotDurationMinutes: number;
  }>(
    `SELECT
       id,
       country_code AS "countryCode",
       doctor_user_id AS "doctorUserId",
       facility_id AS "facilityId",
       start_time_utc AS "startTimeUtc",
       end_time_utc AS "endTimeUtc",
       slot_duration_minutes AS "slotDurationMinutes"
     FROM doctor_schedules
     WHERE id = $1
     FOR UPDATE`,
    [scheduleId],
  );
  const existing = res.rows[0];
  if (!existing) {
    throw new BookingNotFoundError("Schedule shift not found.");
  }
  if (actor.role !== "OPS_ADMIN" && existing.countryCode !== actor.countryCode) {
    throw new BookingForbiddenError(
      "Cannot modify schedules outside your assigned CountryPack jurisdiction.",
    );
  }
  if (isPractitionerRole(actor.role) && existing.doctorUserId !== actor.sub) {
    throw new BookingForbiddenError(
      "Practitioners can only manage their own schedules.",
    );
  }
  return existing;
}

export async function updateDoctorSchedule(
  pool: Pool,
  scheduleId: string,
  actor: AuthTokenClaims,
  input: UpdateScheduleInput,
): Promise<DoctorScheduleSummary> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await loadAuthorizedScheduleForMutation(
      client,
      scheduleId,
      actor,
    );

    if (input.facilityId && input.facilityId !== existing.facilityId) {
      const facRes = await client.query<{
        id: string;
        countryCode: string;
        verificationStatus: string;
      }>(
        `SELECT id, country_code AS "countryCode", verification_status AS "verificationStatus"
         FROM facilities WHERE id = $1 LIMIT 1`,
        [input.facilityId],
      );
      const fac = facRes.rows[0];
      if (!fac) {
        throw new BookingNotFoundError("Target facility not found.");
      }
      if (fac.verificationStatus === "SUSPENDED") {
        throw new BookingForbiddenError(
          "Cannot assign shifts to a suspended facility.",
        );
      }
      if (fac.countryCode !== existing.countryCode) {
        throw new BookingForbiddenError(
          "Schedule facility must belong to the same CountryPack jurisdiction.",
        );
      }
    }

    const nextStart = input.startTimeUtc ?? existing.startTimeUtc;
    const nextEnd = input.endTimeUtc ?? existing.endTimeUtc;
    const nextDuration =
      input.slotDurationMinutes ?? existing.slotDurationMinutes;
    const [sh, sm] = nextStart.split(":").map(Number);
    const [eh, em] = nextEnd.split(":").map(Number);
    if ((eh! * 60 + em!) - (sh! * 60 + sm!) < nextDuration) {
      throw new BookingBadRequestError(
        "endTimeUtc must exceed startTimeUtc by at least slotDurationMinutes.",
      );
    }

    await client.query(
      `UPDATE doctor_schedules
       SET facility_id = COALESCE($2, facility_id),
           day_of_week = COALESCE($3, day_of_week),
           start_time_utc = COALESCE($4, start_time_utc),
           end_time_utc = COALESCE($5, end_time_utc),
           slot_duration_minutes = COALESCE($6, slot_duration_minutes),
           visit_mode = COALESCE($7, visit_mode),
           is_active = COALESCE($8, is_active)
       WHERE id = $1`,
      [
        scheduleId,
        input.facilityId ?? null,
        input.dayOfWeek ?? null,
        input.startTimeUtc ?? null,
        input.endTimeUtc ?? null,
        input.slotDurationMinutes ?? null,
        input.visitMode ?? null,
        input.isActive ?? null,
      ],
    );

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "DOCTOR_SCHEDULE_UPDATED",
      resourceType: "doctor_schedule",
      resourceId: scheduleId,
      metadata: {
        isActive: input.isActive,
        dayOfWeek: input.dayOfWeek,
        visitMode: input.visitMode,
      },
    });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  const updated = await fetchHydratedScheduleById(pool, scheduleId);
  if (!updated) {
    throw new BookingNotFoundError("Schedule shift not found after update.");
  }
  return updated;
}

export async function deleteDoctorSchedule(
  pool: Pool,
  scheduleId: string,
  actor: AuthTokenClaims,
): Promise<{ deleted: true; scheduleId: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await loadAuthorizedScheduleForMutation(
      client,
      scheduleId,
      actor,
    );

    const apptRes = await client.query<{ hasAppts: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM appointments WHERE schedule_id = $1) AS "hasAppts"`,
      [scheduleId],
    );
    if (apptRes.rows[0]?.hasAppts) {
      throw new BookingInvalidTransitionError(
        "Schedule shift already has booked visits. Pause (deactivate) it instead of deleting.",
      );
    }

    await client.query(`DELETE FROM doctor_schedules WHERE id = $1`, [
      scheduleId,
    ]);
    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: "DOCTOR_SCHEDULE_DELETED",
      resourceType: "doctor_schedule",
      resourceId: scheduleId,
      metadata: { doctorUserId: existing.doctorUserId },
    });
    await client.query("COMMIT");
    return { deleted: true as const, scheduleId };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
