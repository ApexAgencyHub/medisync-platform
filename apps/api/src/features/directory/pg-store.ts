import type { Redis } from "ioredis";
import type { Pool } from "pg";
import {
  DemoPersonaSummarySchema,
  DirectoryDoctorSummarySchema,
  DirectoryDriverSummarySchema,
  DirectoryFacilitySummarySchema,
  DirectoryPatientSummarySchema,
  type DemoPersonaSummary,
  type DirectoryDoctorSummary,
  type DirectoryDriverSummary,
  type DirectoryFacilitySummary,
  type DirectoryPatientSummary,
  type DirectorySearchQuery,
  type VehicleType,
} from "@medisync/contracts";
import type { AuthTokenClaims } from "../foundation/index.js";
import { readDriverStatuses } from "../maps-dispatch/index.js";
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

const DRIVER_FLEET_METADATA: Readonly<
  Record<
    string,
    { vehicleType: VehicleType; vehicleLabel: string; serviceZone: string }
  >
> = {
  "driver.ma@medisync.global": {
    vehicleType: "AMBULANCE",
    vehicleLabel: "EMS Rapid Sprinter · Unit 04",
    serviceZone: "Casablanca Emergency District",
  },
  "courier.ma@medisync.global": {
    vehicleType: "MEDICAL_SHUTTLE",
    vehicleLabel: "Patient Care Shuttle · Hybrid SUV",
    serviceZone: "Anfa & Maarif Patient Transfers",
  },
  "driver.intl@medisync.global": {
    vehicleType: "AMBULANCE",
    vehicleLabel: "Geneva EMS Unit 01 · Mobile ICU",
    serviceZone: "Geneva Canton & Cross-Border",
  },
};

function resolveDriverFleet(
  email: string,
  countryCode: string,
  facilityName: string | null,
): { vehicleType: VehicleType; vehicleLabel: string; serviceZone: string } {
  const known = DRIVER_FLEET_METADATA[email];
  if (known) return known;
  const isShuttle = /shuttle|courier|car|sedan/i.test(email);
  return {
    vehicleType: isShuttle ? "MEDICAL_SHUTTLE" : "AMBULANCE",
    vehicleLabel: isShuttle
      ? "Patient Care Shuttle · Hybrid Transport"
      : "Medical Emergency Sprinter",
    serviceZone: facilityName ?? `${countryCode} Regional Coverage`,
  };
}

export async function listDirectoryDriversPublic(
  pool: Pool,
  redis: Redis | undefined,
  query: DirectorySearchQuery,
  s3Config?: S3PresignConfig,
): Promise<DirectoryDriverSummary[]> {
  const searchPattern = query.q ? `%${query.q}%` : null;

  const res = await pool.query<{
    id: string;
    fullName: string;
    email: string;
    countryCode: string;
    facilityId: string | null;
    facilityName: string | null;
    avatarObjectKey: string | null;
  }>(
    `SELECT
       u.id,
       u.full_name AS "fullName",
       u.email,
       u.country_code AS "countryCode",
       u.facility_id AS "facilityId",
       f.name AS "facilityName",
       u.avatar_object_key AS "avatarObjectKey"
     FROM users u
     LEFT JOIN facilities f ON f.id = u.facility_id
     WHERE u.role = 'DRIVER'
       AND ($1::text IS NULL OR u.country_code = $1)
       AND (
         $2::text IS NULL
         OR u.full_name ILIKE $2
         OR u.email ILIKE $2
         OR COALESCE(f.name, '') ILIKE $2
       )
     ORDER BY u.country_code DESC, u.full_name ASC
     LIMIT $3`,
    [query.countryCode ?? null, searchPattern, query.limit],
  );

  const liveStatuses = redis
    ? await readDriverStatuses(
        redis,
        res.rows.map((r) => ({ driverId: r.id, countryCode: r.countryCode })),
      )
    : new Map();

  return res.rows.map((row) => {
    const withAvatar = withAvatarUrl(row, s3Config);
    const fleet = resolveDriverFleet(
      row.email,
      row.countryCode,
      row.facilityName,
    );
    return DirectoryDriverSummarySchema.parse({
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      countryCode: row.countryCode,
      facilityId: row.facilityId,
      facilityName: row.facilityName,
      vehicleType: fleet.vehicleType,
      vehicleLabel: fleet.vehicleLabel,
      serviceZone: fleet.serviceZone,
      liveStatus: liveStatuses.get(row.id) ?? null,
      avatarUrl: withAvatar.avatarUrl,
    });
  });
}

export const SEEDED_DEMO_PASSWORD = "DemoPass!2026";

export const SEEDED_DEMO_METADATA: Readonly<
  Record<string, { headline: string }>
> = {
  "patient.ma@medisync.global": {
    headline: "Casablanca Patient · View Slots, QR Prescriptions & Labs",
  },
  "doctor.ma@medisync.global": {
    headline: "Cardiologist @ Clinique Anfa · Clinical Notes, Rx QR & Shifts",
  },
  "nurse.ma@medisync.global": {
    headline: "State Infirmier @ CHU Ibn Rochd · Home Nursing & Wound Care",
  },
  "pharmacist.ma@medisync.global": {
    headline: "Pharmacie Maarif 24/7 · Verify & Dispense Prescriptions",
  },
  "lab.ma@medisync.global": {
    headline: "Labo BioCasablanca · Diagnostic Orders & Lab Reports",
  },
  "driver.ma@medisync.global": {
    headline: "Casablanca EMS Unit · Live GPS Dispatch & Ambulance",
  },
  "courier.ma@medisync.global": {
    headline: "Casablanca Shuttle Driver · Patient Transfers & Care Rides",
  },
  "hospital.ma@medisync.global": {
    headline: "CHU Ibn Rochd Director · Facility Management & Staffing",
  },
  "patient.intl@medisync.global": {
    headline: "Geneva Patient · Multi-Clinic Video Visits & Prescriptions",
  },
  "doctor.intl@medisync.global": {
    headline: "Internal Medicine @ Geneva Clinic · Visits & Orders",
  },
  "nurse.intl@medisync.global": {
    headline: "Registered Infirmier @ Geneva Hub · Home Visits & Care",
  },
  "pharmacist.intl@medisync.global": {
    headline: "Pharmacie du Léman 24/7 · Dispensing Desk",
  },
  "lab.intl@medisync.global": {
    headline: "BioGen Diagnostics Lab · Direct Lab Report PDFs",
  },
  "driver.intl@medisync.global": {
    headline: "Geneva Ambulance Unit 01 · Live Medical Dispatch",
  },
  "ops.admin@medisync.global": {
    headline: "Ministry Governance Admin · Verify Licenses & Resolve Disputes",
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
