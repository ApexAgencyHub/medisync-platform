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

const SQL_FOLD_FROM =
  "àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ";
const SQL_FOLD_TO =
  "aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY";

const MOROCCAN_CITY_ALIAS_GROUPS: readonly (readonly string[])[] = [
  ["casablanca", "casa", "الدار البيضاء"],
  ["rabat", "الرباط"],
  ["marrakech", "marrakesh", "مراكش"],
  ["tangier", "tanger", "طنجة"],
  ["fes", "fez", "فاس"],
  ["agadir", "أكادير"],
];

function foldAccentText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function buildAccentAwarePatterns(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const folded = foldAccentText(raw);
  if (!folded) return null;
  const group = MOROCCAN_CITY_ALIAS_GROUPS.find((aliases) =>
    aliases.some((alias) => foldAccentText(alias) === folded),
  );
  const terms = group
    ? Array.from(new Set([folded, ...group.map(foldAccentText)]))
    : [folded];
  return terms.map((term) => `%${term}%`);
}

function sqlFoldExpr(columnExpr: string): string {
  return `translate(${columnExpr}, '${SQL_FOLD_FROM}', '${SQL_FOLD_TO}')`;
}

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
         phone,
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
       phone,
       role,
       country_code AS "countryCode",
       avatar_object_key AS "avatarObjectKey"
     FROM users
     WHERE role IN ('PATIENT', 'CAREGIVER')
       AND ($1::text IS NULL OR country_code = $1)
       AND (
         $2::text IS NOT NULL
         OR (full_name <> 'Guest Care Pass' AND COALESCE(email, '') NOT LIKE 'guest-%')
       )
       AND ($2::text IS NULL OR full_name ILIKE $2 OR email ILIKE $2 OR COALESCE(phone, '') ILIKE $2)
     ORDER BY
       CASE WHEN full_name = 'Guest Care Pass' THEN 1 ELSE 0 END ASC,
       full_name ASC
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
  const searchPatterns = buildAccentAwarePatterns(query.q);
  const cityPatterns = buildAccentAwarePatterns(query.city);
  const specialtyPattern = query.specialty ? `%${query.specialty}%` : null;

  const res = await pool.query(
    `SELECT
       u.id,
       u.full_name AS "fullName",
       u.email,
       CASE WHEN u.role = 'NURSE' THEN 'NURSE' ELSE 'DOCTOR' END AS role,
       u.country_code AS "countryCode",
       COALESCE(dp.specialty, CASE WHEN u.role = 'NURSE' THEN 'Home Nursing & Infirmiers' ELSE 'General Practice' END) AS specialty,
       u.facility_id AS "facilityId",
       f.name AS "facilityName",
       f.city AS "facilityCity",
       COALESCE(dp.consultation_fee_minor, 0)::int AS "consultationFeeMinor",
       COALESCE(dp.languages_spoken, f.languages_spoken, ARRAY[]::text[]) AS "languagesSpoken",
       COALESCE(dp.accepted_insurances, f.accepted_insurances, ARRAY[]::text[]) AS "acceptedInsurances",
       COALESCE(dp.telehealth_enabled, f.telehealth_enabled, FALSE) AS "telehealthEnabled",
       COALESCE(dp.home_visit_enabled, f.home_visit_enabled, FALSE) AS "homeVisitEnabled",
       u.credential_verified AS "credentialVerified",
       u.avatar_object_key AS "avatarObjectKey"
     FROM users u
     LEFT JOIN doctor_profiles dp ON dp.doctor_user_id = u.id
     LEFT JOIN facilities f ON f.id = u.facility_id
     WHERE u.role IN ('DOCTOR', 'NURSE')
       AND u.account_status = 'ACTIVE'
       AND ($1::text IS NULL OR u.country_code = $1)
       AND (
         $2::text[] IS NULL
         OR ${sqlFoldExpr("u.full_name")} ILIKE ANY($2::text[])
         OR ${sqlFoldExpr("COALESCE(dp.specialty, CASE WHEN u.role = 'NURSE' THEN 'Home Nursing & Infirmiers' ELSE 'General Practice' END)")} ILIKE ANY($2::text[])
         OR ${sqlFoldExpr("COALESCE(f.name, '')")} ILIKE ANY($2::text[])
         OR ${sqlFoldExpr("COALESCE(f.city, '')")} ILIKE ANY($2::text[])
       )
       AND (
         $3::text IS NULL
         OR COALESCE(dp.specialty, CASE WHEN u.role = 'NURSE' THEN 'Home Nursing & Infirmiers' ELSE 'General Practice' END) ILIKE $3
       )
       AND ($4::text IS NULL OR $4 = ANY(COALESCE(dp.accepted_insurances, f.accepted_insurances, ARRAY[]::text[])))
       AND ($5::text IS NULL OR $5 = ANY(COALESCE(dp.languages_spoken, f.languages_spoken, ARRAY[]::text[])))
       AND ($6::boolean IS NOT TRUE OR COALESCE(dp.telehealth_enabled, f.telehealth_enabled, FALSE) = TRUE)
       AND ($7::boolean IS NOT TRUE OR COALESCE(dp.home_visit_enabled, f.home_visit_enabled, FALSE) = TRUE)
       AND ($8::text[] IS NULL OR ${sqlFoldExpr("COALESCE(f.city, '')")} ILIKE ANY($8::text[]))
     ORDER BY u.full_name ASC
     LIMIT $9`,
    [
      query.countryCode ?? null,
      searchPatterns,
      specialtyPattern,
      query.insurance ?? null,
      query.language ?? null,
      query.telehealthOnly ?? false,
      query.homeVisitOnly ?? false,
      cityPatterns,
      query.limit,
    ],
  );

  return res.rows.map((r) =>
    DirectoryDoctorSummarySchema.parse(withAvatarUrl(r, s3Config)),
  );
}

export async function listDirectoryFacilitiesPublic(
  pool: Pool,
  query: DirectorySearchQuery,
): Promise<DirectoryFacilitySummary[]> {
  const searchPatterns = buildAccentAwarePatterns(query.q);
  const cityPatterns = buildAccentAwarePatterns(query.city);
  const specialtyPattern = query.specialty ? `%${query.specialty}%` : null;

  const res = await pool.query(
    `SELECT
       id,
       name,
       kind,
       country_code AS "countryCode",
       license_number AS "licenseNumber",
       verification_status AS "verificationStatus",
       open_status AS "openStatus",
       city,
       address,
       accepted_insurances AS "acceptedInsurances",
       languages_spoken AS "languagesSpoken",
       telehealth_enabled AS "telehealthEnabled",
       home_visit_enabled AS "homeVisitEnabled",
       lat,
       lng
     FROM facilities
     WHERE verification_status = 'VERIFIED'
       AND ($1::text IS NULL OR country_code = $1)
       AND ($2::text IS NULL OR kind = $2)
       AND (
         $3::text[] IS NULL
         OR ${sqlFoldExpr("name")} ILIKE ANY($3::text[])
         OR ${sqlFoldExpr("address")} ILIKE ANY($3::text[])
         OR ${sqlFoldExpr("COALESCE(city, '')")} ILIKE ANY($3::text[])
       )
       AND ($4::text IS NULL OR $4 = ANY(accepted_insurances))
       AND ($5::text IS NULL OR $5 = ANY(languages_spoken))
       AND ($6::boolean IS NOT TRUE OR telehealth_enabled = TRUE)
       AND ($7::boolean IS NOT TRUE OR home_visit_enabled = TRUE)
       AND (
         $8::text IS NULL
         OR EXISTS (SELECT 1 FROM unnest(specialties) s WHERE s ILIKE $8)
       )
       AND ($9::text[] IS NULL OR ${sqlFoldExpr("COALESCE(city, '')")} ILIKE ANY($9::text[]))
     ORDER BY name ASC
     LIMIT $10`,
    [
      query.countryCode ?? null,
      query.kind ?? null,
      searchPatterns,
      query.insurance ?? null,
      query.language ?? null,
      query.telehealthOnly ?? false,
      query.homeVisitOnly ?? false,
      specialtyPattern,
      cityPatterns,
      query.limit,
    ],
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
  "driver.rabat.ma@medisync.global": {
    vehicleType: "AMBULANCE",
    vehicleLabel: "Rabat EMS Rapid Sprinter · Unit 02",
    serviceZone: "Rabat Agdal, Hassan & Souissi",
  },
  "driver.marrakech.ma@medisync.global": {
    vehicleType: "AMBULANCE",
    vehicleLabel: "Marrakech EMS Sprinter · Unit 03",
    serviceZone: "Marrakech Guéliz, Médina & Amerchich",
  },
  "driver.tangier.ma@medisync.global": {
    vehicleType: "AMBULANCE",
    vehicleLabel: "Tangier EMS Rapid Unit · Unit 05",
    serviceZone: "Tangier Bay, Tanger Centre & Route de Rabat",
  },
  "driver.fes.ma@medisync.global": {
    vehicleType: "AMBULANCE",
    vehicleLabel: "Fès EMS Rapid Sprinter · Unit 06",
    serviceZone: "Fès Ville Nouvelle, Saïss & CHU Hassan II",
  },
  "driver.agadir.ma@medisync.global": {
    vehicleType: "AMBULANCE",
    vehicleLabel: "Agadir EMS Souss Unit · Unit 07",
    serviceZone: "Agadir Centre, Baie d'Agadir & Souss",
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
  const searchPatterns = buildAccentAwarePatterns(query.q);
  const cityPatterns = buildAccentAwarePatterns(query.city);

  const res = await pool.query<{
    id: string;
    fullName: string;
    email: string;
    countryCode: string;
    facilityId: string | null;
    facilityName: string | null;
    facilityCity: string | null;
    avatarObjectKey: string | null;
  }>(
    `SELECT
       u.id,
       u.full_name AS "fullName",
       u.email,
       u.country_code AS "countryCode",
       u.facility_id AS "facilityId",
       f.name AS "facilityName",
       f.city AS "facilityCity",
       u.avatar_object_key AS "avatarObjectKey"
     FROM users u
     LEFT JOIN facilities f ON f.id = u.facility_id
     WHERE u.role = 'DRIVER'
       AND u.account_status = 'ACTIVE'
       AND u.credential_verified = TRUE
       AND ($1::text IS NULL OR u.country_code = $1)
       AND (
         $2::text[] IS NULL
         OR ${sqlFoldExpr("u.full_name")} ILIKE ANY($2::text[])
         OR ${sqlFoldExpr("u.email")} ILIKE ANY($2::text[])
         OR ${sqlFoldExpr("COALESCE(f.name, '')")} ILIKE ANY($2::text[])
         OR ${sqlFoldExpr("COALESCE(f.city, '')")} ILIKE ANY($2::text[])
       )
       AND ($3::text[] IS NULL OR ${sqlFoldExpr("COALESCE(f.city, '')")} ILIKE ANY($3::text[]))
     ORDER BY u.country_code DESC, u.full_name ASC
     LIMIT $4`,
    [query.countryCode ?? null, searchPatterns, cityPatterns, query.limit],
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
      facilityCity: row.facilityCity,
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
    email: string | null;
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
      email: row.email ?? "",
      demoPassword: SEEDED_DEMO_PASSWORD,
      fullName: row.fullName,
      role: row.role,
      countryCode: row.countryCode,
      headline: (row.email ? SEEDED_DEMO_METADATA[row.email]?.headline : undefined) ?? row.role,
    }),
  );
}
