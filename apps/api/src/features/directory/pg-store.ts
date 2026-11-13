import type { Pool } from "pg";
import {
  DemoPersonaSummarySchema,
  DirectoryDoctorSummarySchema,
  DirectoryFacilitySummarySchema,
  DirectoryPatientSummarySchema,
  type DemoPersonaSummary,
  type DirectoryDoctorSummary,
  type DirectoryFacilitySummary,
  type DirectoryPatientSummary,
  type DirectorySearchQuery,
} from "@medisync/contracts";
import type { AuthTokenClaims } from "../foundation/index.js";
import {
  createSigV4PresignedUrl,
  type S3PresignConfig,
} from "../../shared/storage/s3-presign.js";

function withAvatarUrl(
  row: Record<string, unknown>,
  s3Config?: S3PresignConfig,
): Record<string, unknown> {
  const objectKey =
    typeof row.avatarObjectKey === "string" && row.avatarObjectKey.length > 0
      ? row.avatarObjectKey
      : null;
  return {
    ...row,
    avatarUrl:
      objectKey && s3Config
        ? createSigV4PresignedUrl({
            config: s3Config,
            method: "GET",
            objectKey,
          })
        : null,
  };
}

export async function listDirectoryPatientsScoped(
  pool: Pool,
  actor: AuthTokenClaims,
  query: DirectorySearchQuery,
  s3Config?: S3PresignConfig,
): Promise<DirectoryPatientSummary[]> {
  const countryCode =
    actor.role === "OPS_ADMIN"
      ? (query.countryCode ?? null)
      : actor.countryCode;
  const searchPattern = query.q ? `%${query.q}%` : null;

  if (actor.role === "PATIENT" || actor.role === "CAREGIVER") {
    const selfRes = await pool.query(
      `SELECT
         id,
         full_name AS "fullName",
         email,
         role,
         country_code AS "countryCode",
         avatar_object_key AS "avatarObjectKey"
       FROM users
       WHERE id = $1
         AND role IN ('PATIENT', 'CAREGIVER')
       LIMIT 1`,
      [actor.sub],
    );
    return selfRes.rows.map((r) =>
      DirectoryPatientSummarySchema.parse(withAvatarUrl(r, s3Config)),
    );
  }

  const res = await pool.query(
    `SELECT
       id,
       full_name AS "fullName",
       email,
       role,
       country_code AS "countryCode",
       avatar_object_key AS "avatarObjectKey"
     FROM users
     WHERE role IN ('PATIENT', 'CAREGIVER')
       AND ($1::text IS NULL OR country_code = $1)
       AND ($2::text IS NULL OR full_name ILIKE $2 OR email ILIKE $2)
     ORDER BY full_name ASC
     LIMIT $3`,
    [countryCode, searchPattern, query.limit],
  );

  return res.rows.map((r) =>
    DirectoryPatientSummarySchema.parse(withAvatarUrl(r, s3Config)),
  );
}

export async function listDirectoryDoctorsScoped(
  pool: Pool,
  query: DirectorySearchQuery,
  s3Config?: S3PresignConfig,
): Promise<DirectoryDoctorSummary[]> {
  const searchPattern = query.q ? `%${query.q}%` : null;

  const res = await pool.query(
    `SELECT
       u.id,
       u.full_name AS "fullName",
       u.email,
       u.country_code AS "countryCode",
       COALESCE(dp.specialty, 'General Practice') AS specialty,
       u.facility_id AS "facilityId",
       f.name AS "facilityName",
       COALESCE(dp.consultation_fee_minor, 0)::int AS "consultationFeeMinor",
       u.avatar_object_key AS "avatarObjectKey"
     FROM users u
     LEFT JOIN doctor_profiles dp ON dp.doctor_user_id = u.id
     LEFT JOIN facilities f ON f.id = u.facility_id
     WHERE u.role = 'DOCTOR'
       AND ($1::text IS NULL OR u.country_code = $1)
       AND (
         $2::text IS NULL
         OR u.full_name ILIKE $2
         OR COALESCE(dp.specialty, '') ILIKE $2
         OR COALESCE(f.name, '') ILIKE $2
       )
     ORDER BY u.full_name ASC
     LIMIT $3`,
    [query.countryCode ?? null, searchPattern, query.limit],
  );

  return res.rows.map((r) =>
    DirectoryDoctorSummarySchema.parse(withAvatarUrl(r, s3Config)),
  );
}

export async function listDirectoryFacilitiesPublic(
  pool: Pool,
  query: DirectorySearchQuery,
): Promise<DirectoryFacilitySummary[]> {
  const searchPattern = query.q ? `%${query.q}%` : null;

  const res = await pool.query(
    `SELECT
       id,
       name,
       kind,
       country_code AS "countryCode",
       license_number AS "licenseNumber",
       verification_status AS "verificationStatus",
       open_status AS "openStatus",
       address,
       lat,
       lng
     FROM facilities
     WHERE verification_status = 'VERIFIED'
       AND ($1::text IS NULL OR country_code = $1)
       AND ($2::text IS NULL OR kind = $2)
       AND ($3::text IS NULL OR name ILIKE $3 OR address ILIKE $3)
     ORDER BY name ASC
     LIMIT $4`,
    [query.countryCode ?? null, query.kind ?? null, searchPattern, query.limit],
  );

  return res.rows.map((r) => DirectoryFacilitySummarySchema.parse(r));
}

export const SEEDED_DEMO_PASSWORD = "DemoPass!2026";

export const SEEDED_DEMO_METADATA: Readonly<
  Record<string, { headline: string }>
> = {
  "patient.ma@medisync.global": {
    headline: "Casablanca Patient · View Slots, QR Prescriptions & Labs",
  },
  "doctor.ma@medisync.global": {
    headline: "Cardiologist @ Clinique Anfa · SOAP Notes, Rx QR & Shifts",
  },
  "pharmacist.ma@medisync.global": {
    headline: "Pharmacie Maarif 24/7 · Verify & Dispense Prescriptions",
  },
  "lab.ma@medisync.global": {
    headline: "Labo BioCasablanca · Diagnostic Orders & S3 Uploads",
  },
  "driver.ma@medisync.global": {
    headline: "Casablanca EMS Unit · Redis Geo Live Telemetry & Dispatches",
  },
  "hospital.ma@medisync.global": {
    headline: "CHU Ibn Rochd Director · Facility Ops & Staffing",
  },
  "patient.intl@medisync.global": {
    headline: "Geneva Patient · Multi-Clinic Telehealth & Prescriptions",
  },
  "doctor.intl@medisync.global": {
    headline: "Internal Medicine @ Geneva Clinic · Visits & Orders",
  },
  "pharmacist.intl@medisync.global": {
    headline: "Pharmacie du Léman 24/7 · Dispensing Desk",
  },
  "lab.intl@medisync.global": {
    headline: "BioGen Diagnostics Lab · Direct S3 Lab PDFs",
  },
  "driver.intl@medisync.global": {
    headline: "Geneva Ambulance Unit 01 · Live SSE Dispatch",
  },
  "ops.admin@medisync.global": {
    headline: "Sovereign Ministry Admin · Verify Licenses, Disputes & Audit",
  },
};

export async function listSeededDemoPersonas(
  pool: Pool,
): Promise<DemoPersonaSummary[]> {
  const emails = Object.keys(SEEDED_DEMO_METADATA);
  const res = await pool.query<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    countryCode: string;
  }>(
    `SELECT
       id,
       email,
       full_name AS "fullName",
       role,
       country_code AS "countryCode"
     FROM users
     WHERE email = ANY($1::text[])
     ORDER BY country_code DESC, role ASC`,
    [emails],
  );

  return res.rows.map((row) =>
    DemoPersonaSummarySchema.parse({
      id: row.id,
      email: row.email,
      demoPassword: SEEDED_DEMO_PASSWORD,
      fullName: row.fullName,
      role: row.role,
      countryCode: row.countryCode,
      headline: SEEDED_DEMO_METADATA[row.email]?.headline ?? row.role,
    }),
  );
}
