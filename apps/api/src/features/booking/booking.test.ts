import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import type {
  AppointmentResponse,
  AppointmentsListResponse,
  AuthResponse,
  DoctorProfileSummary,
  DoctorScheduleSummary,
  FacilitySummary,
  SlotsListResponse,
} from "@medisync/contracts";
import { buildApiServer } from "../../server.js";
import { createDbPool } from "../../shared/db/pool.js";
import { runMigrations } from "../../shared/db/migrate.js";
import { createRedisClient } from "../../shared/redis/client.js";
import { hashPassword } from "../foundation/index.js";

const DEFAULT_TEST_DB_URL =
  "postgresql://medisync:medisync_dev_password@127.0.0.1:5433/medisync";
const DEFAULT_TEST_REDIS_URL = "redis://127.0.0.1:6380";
const TEST_AUTH_SECRET =
  process.env.AUTH_SECRET ??
  "medisync-ci-ephemeral-test-secret-minimum-32-chars";

describe("api slice 3 booking: multi-clinic doctor schedules & transactional locking", () => {
  let pool: Pool;
  let redis: Redis;
  let app: FastifyInstance;

  const runSuffix = crypto.randomBytes(4).toString("hex");
  const licenseBase = Math.floor(100000 + crypto.randomInt(0, 700000));
  const createdUserIds: string[] = [];
  const createdFacilityIds: string[] = [];
  const createdScheduleIds: string[] = [];
  const createdAppointmentIds: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL;
    const redisUrl = process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL;
    pool = createDbPool(databaseUrl);
    redis = createRedisClient(redisUrl);
    await runMigrations(pool);

    app = await buildApiServer({
      databaseUrl,
      redisUrl,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://127.0.0.1:3000"],
      pool,
      redis,
      runDbMigrations: false,
    });
  });

  afterAll(async () => {
    if (createdAppointmentIds.length > 0) {
      await pool.query("DELETE FROM appointments WHERE id = ANY($1::uuid[])", [
        createdAppointmentIds,
      ]);
    }
    if (createdScheduleIds.length > 0) {
      await pool.query(
        "DELETE FROM doctor_schedules WHERE id = ANY($1::uuid[])",
        [createdScheduleIds],
      );
    }
    if (createdUserIds.length > 0) {
      await pool.query(
        "DELETE FROM doctor_profiles WHERE doctor_user_id = ANY($1::uuid[])",
        [createdUserIds],
      );
      await pool.query("DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
    }
    if (createdFacilityIds.length > 0) {
      await pool.query("DELETE FROM facilities WHERE id = ANY($1::uuid[])", [
        createdFacilityIds,
      ]);
    }
    if (createdUserIds.length > 0) {
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
    }

    await app.close();
    await redis.quit();
    await pool.end();
  });

  async function registerAccount(input: {
    email: string;
    fullName: string;
    role: "PATIENT" | "DOCTOR" | "CLINIC_STAFF" | "DRIVER";
    countryCode: string;
  }): Promise<AuthResponse> {
    const res = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: input.email,
        password: "StrongPassword!123",
        fullName: input.fullName,
        role: input.role,
        countryCode: input.countryCode,
      },
    });
    expect(res.statusCode).toBe(201);
    const parsed = res.json<AuthResponse>();
    createdUserIds.push(parsed.user.id);
    return parsed;
  }

  async function createFacility(
    token: string,
    payload: {
      name: string;
      kind: "CLINIC" | "HOSPITAL";
      countryCode: string;
      licenseNumber: string;
      lat: number;
      lng: number;
      address: string;
    },
  ): Promise<FacilitySummary> {
    const res = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ facility: FacilitySummary }>();
    createdFacilityIds.push(body.facility.id);
    return body.facility;
  }

  it("prevents concurrent double-booking, blocks cross-clinic slot overlaps, enforces RBAC & tenancy, and frees cancelled slots", async () => {
    // Target UTC Monday 2026-11-16 (getUTCDay() === 1)
    const testDate = "2026-11-16";
    const dayOfWeek = 1;

    const opsPasswordHash = await hashPassword("OpsSecret!123");
    const opsEmail = `ops.book.${runSuffix}@medisync.global`;
    const opsInsert = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, country_code)
       VALUES ($1, $2, 'Ops Booking Admin', 'OPS_ADMIN', 'MA')
       RETURNING id`,
      [opsEmail, opsPasswordHash],
    );
    createdUserIds.push(opsInsert.rows[0]!.id);

    const opsLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: opsEmail, password: "OpsSecret!123" },
    });
    expect(opsLogin.statusCode).toBe(200);
    const opsToken = opsLogin.json<AuthResponse>().token;

    const doctor = await registerAccount({
      email: `dr.cardio.${runSuffix}@medisync.ma`,
      fullName: "Dr. Salma Bennani",
      role: "DOCTOR",
      countryCode: "MA",
    });
    const clinicStaff = await registerAccount({
      email: `staff.clinic.${runSuffix}@medisync.ma`,
      fullName: "Karim Reception",
      role: "CLINIC_STAFF",
      countryCode: "MA",
    });
    const patientA = await registerAccount({
      email: `patient.a.${runSuffix}@medisync.ma`,
      fullName: "Nadia El Fassi",
      role: "PATIENT",
      countryCode: "MA",
    });
    const patientB = await registerAccount({
      email: `patient.b.${runSuffix}@medisync.ma`,
      fullName: "Youssef Tazi",
      role: "PATIENT",
      countryCode: "MA",
    });
    const patientC = await registerAccount({
      email: `patient.c.${runSuffix}@medisync.ma`,
      fullName: "Leila Mansouri",
      role: "PATIENT",
      countryCode: "MA",
    });
    const francePatient = await registerAccount({
      email: `patient.fr.${runSuffix}@medisync.fr`,
      fullName: "Claire Moreau",
      role: "PATIENT",
      countryCode: "FR",
    });

    const clinicAlpha = await createFacility(clinicStaff.token, {
      name: `Clinique Anfa ${runSuffix}`,
      kind: "CLINIC",
      countryCode: "MA",
      licenseNumber: `MA-CLIN-${licenseBase}`,
      lat: 33.5883,
      lng: -7.6324,
      address: "Boulevard d'Anfa, Casablanca",
    });
    const clinicBeta = await createFacility(opsToken, {
      name: `Centre Maarif ${runSuffix}`,
      kind: "CLINIC",
      countryCode: "MA",
      licenseNumber: `MA-CLIN-${licenseBase + 1}`,
      lat: 33.5821,
      lng: -7.6377,
      address: "Rue Jean Jaures, Casablanca",
    });

    // Doctor upserts specialty profile
    const profileRes = await app.inject({
      method: "PUT",
      url: "/v1/booking/profiles",
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        specialty: "Cardiology",
        licenseNumber: `MA-MD-${licenseBase}`,
        consultationFeeMinor: 40000,
        bio: "Interventional cardiologist operating across Casablanca partner clinics.",
      },
    });
    expect(profileRes.statusCode).toBe(200);
    expect(
      profileRes.json<{ profile: DoctorProfileSummary }>().profile.specialty,
    ).toBe("Cardiology");

    // Same doctor publishes two overlapping shifts at Clinic Alpha (09:00-10:00) and Clinic Beta (09:00-10:00)
    const schedAlphaRes = await app.inject({
      method: "POST",
      url: "/v1/booking/schedules",
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        facilityId: clinicAlpha.id,
        dayOfWeek,
        startTimeUtc: "09:00",
        endTimeUtc: "10:00",
        slotDurationMinutes: 30,
        visitMode: "IN_PERSON",
      },
    });
    expect(schedAlphaRes.statusCode).toBe(201);
    const schedAlpha =
      schedAlphaRes.json<{ schedule: DoctorScheduleSummary }>().schedule;
    createdScheduleIds.push(schedAlpha.id);

    const schedBetaRes = await app.inject({
      method: "POST",
      url: "/v1/booking/schedules",
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: {
        facilityId: clinicBeta.id,
        dayOfWeek,
        startTimeUtc: "09:00",
        endTimeUtc: "10:00",
        slotDurationMinutes: 30,
        visitMode: "TELEHEALTH",
      },
    });
    expect(schedBetaRes.statusCode).toBe(201);
    const schedBeta =
      schedBetaRes.json<{ schedule: DoctorScheduleSummary }>().schedule;
    createdScheduleIds.push(schedBeta.id);

    // Explore available slots before booking
    const slotsBeforeRes = await app.inject({
      method: "GET",
      url: `/v1/booking/slots?countryCode=MA&date=${testDate}&doctorUserId=${doctor.user.id}`,
    });
    expect(slotsBeforeRes.statusCode).toBe(200);
    const slotsBefore = slotsBeforeRes.json<SlotsListResponse>();
    expect(slotsBefore.slots.length).toBe(4);

    // Concurrent race: 5 requests attempt to book the exact same 09:00 slot for different patients at Clinic Alpha
    const targetSlotIso = "2026-11-16T09:00:00.000Z";
    const racers = [patientA, patientB, patientC];
    const raceResponses = await Promise.all(
      racers.map((p) =>
        app.inject({
          method: "POST",
          url: "/v1/booking/appointments",
          headers: { authorization: `Bearer ${p.token}` },
          payload: {
            scheduleId: schedAlpha.id,
            slotStartIso: targetSlotIso,
            reason: "Chest tightness check",
          },
        }),
      ),
    );

    const createdResponses = raceResponses.filter((r) => r.statusCode === 201);
    const conflictResponses = raceResponses.filter((r) => r.statusCode === 409);
    expect(createdResponses).toHaveLength(1);
    expect(conflictResponses).toHaveLength(2);
    expect(
      conflictResponses[0]!.json<{ error: string }>().error,
    ).toBe("SLOT_ALREADY_BOOKED");

    const winningBooking = createdResponses[0]!.json<AppointmentResponse>()
      .appointment;
    createdAppointmentIds.push(winningBooking.id);

    // Same doctor CANNOT be booked at the SAME 09:00 time at Clinic Beta either!
    const crossClinicAttempt = await app.inject({
      method: "POST",
      url: "/v1/booking/appointments",
      headers: { authorization: `Bearer ${patientC.token}` },
      payload: {
        scheduleId: schedBeta.id,
        slotStartIso: targetSlotIso,
        reason: "Telehealth consult",
      },
    });
    expect(crossClinicAttempt.statusCode).toBe(409);

    // Available slots query with includeBooked=false must exclude BOTH Clinic Alpha 09:00 and Clinic Beta 09:00!
    const slotsAfterRes = await app.inject({
      method: "GET",
      url: `/v1/booking/slots?countryCode=MA&date=${testDate}&doctorUserId=${doctor.user.id}&includeBooked=false`,
    });
    expect(slotsAfterRes.statusCode).toBe(200);
    const slotsAfter = slotsAfterRes.json<SlotsListResponse>();
    expect(
      slotsAfter.slots.every((slot) => slot.slotStartIso !== targetSlotIso),
    ).toBe(true);
    expect(slotsAfter.slots.length).toBe(2);

    // Cross-country booking (FR patient booking MA doctor) is blocked with 403
    const crossCountryRes = await app.inject({
      method: "POST",
      url: "/v1/booking/appointments",
      headers: { authorization: `Bearer ${francePatient.token}` },
      payload: {
        scheduleId: schedAlpha.id,
        slotStartIso: "2026-11-16T09:30:00.000Z",
      },
    });
    expect(crossCountryRes.statusCode).toBe(403);

    // Another patient CANNOT cancel the winning patient's booking (403)
    const ownerPatient =
      racers.find((r) => r.user.id === winningBooking.patientUserId) ?? patientA;
    const intruderPatient = racers.find((r) => r.user.id !== ownerPatient.user.id)!;

    const intruderCancel = await app.inject({
      method: "PATCH",
      url: `/v1/booking/appointments/${winningBooking.id}/status`,
      headers: { authorization: `Bearer ${intruderPatient.token}` },
      payload: { status: "CANCELLED" },
    });
    expect(intruderCancel.statusCode).toBe(403);

    // Patient cannot self check-in (only clinical staff / doctor can)
    const selfCheckIn = await app.inject({
      method: "PATCH",
      url: `/v1/booking/appointments/${winningBooking.id}/status`,
      headers: { authorization: `Bearer ${ownerPatient.token}` },
      payload: { status: "CHECKED_IN" },
    });
    expect(selfCheckIn.statusCode).toBe(403);

    // Owner patient cancels their appointment cleanly -> frees slot immediately!
    const validCancel = await app.inject({
      method: "PATCH",
      url: `/v1/booking/appointments/${winningBooking.id}/status`,
      headers: { authorization: `Bearer ${ownerPatient.token}` },
      payload: { status: "CANCELLED", note: "Rescheduling for afternoon" },
    });
    expect(validCancel.statusCode).toBe(200);
    expect(validCancel.json<AppointmentResponse>().appointment.status).toBe(
      "CANCELLED",
    );

    // Another patient can now re-book the freed 09:00 slot at Clinic Beta (TELEHEALTH)!
    const rebookRes = await app.inject({
      method: "POST",
      url: "/v1/booking/appointments",
      headers: { authorization: `Bearer ${intruderPatient.token}` },
      payload: {
        scheduleId: schedBeta.id,
        slotStartIso: targetSlotIso,
        reason: "Urgent cardio video consult",
      },
    });
    expect(rebookRes.statusCode).toBe(201);
    const rebooked = rebookRes.json<AppointmentResponse>().appointment;
    createdAppointmentIds.push(rebooked.id);

    // Clinic staff checks patient in, then doctor completes the appointment
    const checkInRes = await app.inject({
      method: "PATCH",
      url: `/v1/booking/appointments/${rebooked.id}/status`,
      headers: { authorization: `Bearer ${clinicStaff.token}` },
      payload: { status: "CHECKED_IN", note: "Vitals recorded: BP 120/80" },
    });
    expect(checkInRes.statusCode).toBe(200);
    expect(checkInRes.json<AppointmentResponse>().appointment.status).toBe(
      "CHECKED_IN",
    );

    const completeRes = await app.inject({
      method: "PATCH",
      url: `/v1/booking/appointments/${rebooked.id}/status`,
      headers: { authorization: `Bearer ${doctor.token}` },
      payload: { status: "COMPLETED" },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json<AppointmentResponse>().appointment.status).toBe(
      "COMPLETED",
    );

    // Scoped list verifies doctor sees both their appointments (CANCELLED + COMPLETED)
    const listDocRes = await app.inject({
      method: "GET",
      url: "/v1/booking/appointments",
      headers: { authorization: `Bearer ${doctor.token}` },
    });
    expect(listDocRes.statusCode).toBe(200);
    const docList = listDocRes.json<AppointmentsListResponse>();
    expect(docList.appointments.some((a) => a.id === rebooked.id)).toBe(true);
  });
});
