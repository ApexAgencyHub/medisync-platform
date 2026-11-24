import type { Pool } from "pg";
import { z } from "zod";
import { findMoroccanCity } from "@medisync/country-packs";
import {
  AuthenticatedUserSchema,
  FacilitySummarySchema,
  normalizePhoneIdentifier,
  type AuditEvent,
  type AuthenticatedUser,
  type CreateFacilityInput,
  type FacilityListQuery,
  type FacilitySummary,
  type PatientEasyRole,
  type RegisterUserInput,
  type UserRole,
  type VerificationStatus,
} from "@medisync/contracts";
import {
  createSigV4PresignedUrl,
  type S3PresignConfig,
} from "../../shared/storage/s3-presign.js";

const UserRowSchema = AuthenticatedUserSchema.extend({
  passwordHash: z.string().nullable(),
  avatarObjectKey: z.string().nullable().optional(),
  authProvider: z.enum(["LOCAL", "PHONE", "GOOGLE"]).default("LOCAL"),
  googleSub: z.string().nullable().optional(),
  tokenVersion: z.number().int().default(1),
});

export type StoredUserRecord = z.infer<typeof UserRowSchema>;

function hydrateUserAvatar(
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

const AuditRowSchema = z.object({
  eventId: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  actorId: z.string().uuid(),
  actorRole: z.string(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  occurredAtIso: z.string().datetime(),
});

export class DuplicateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateConflictError";
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

export async function pingDatabase(pool: Pool): Promise<boolean> {
  const res = await pool.query<{ ok: number }>("SELECT 1 AS ok");
  return res.rows[0]?.ok === 1;
}

export async function insertUser(
  pool: Pool,
  input: Omit<RegisterUserInput, "role"> & { role: UserRole },
  passwordHash: string | null,
  options: {
    accountStatus?: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED" | undefined;
    credentialVerified?: boolean | undefined;
    phone?: string | null | undefined;
    authProvider?: "LOCAL" | "PHONE" | "GOOGLE" | undefined;
    emailVerified?: boolean | undefined;
    phoneVerified?: boolean | undefined;
  } = {},
): Promise<AuthenticatedUser> {
  const normalizedEmail = input.email ? input.email.trim().toLowerCase() : null;
  const rawPhone = options.phone ?? input.phone ?? null;
  const normalizedPhone = rawPhone ? normalizePhoneIdentifier(rawPhone) : null;

  try {
    const res = await pool.query(
      `INSERT INTO users (
         email,
         password_hash,
         full_name,
         role,
         country_code,
         facility_id,
         phone,
         phone_verified,
         email_verified,
         auth_provider,
         account_status,
         credential_verified
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING
         id,
         email,
         full_name AS "fullName",
         role,
         country_code AS "countryCode",
         facility_id AS "facilityId",
         email_verified AS "emailVerified",
         phone,
         phone_verified AS "phoneVerified",
         auth_provider AS "authProvider",
         account_status AS "accountStatus",
         credential_verified AS "credentialVerified",
         CASE WHEN last_login_at IS NULL THEN NULL ELSE to_char(last_login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "lastLoginAtIso",
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"`,
      [
        normalizedEmail,
        passwordHash,
        input.fullName.trim(),
        input.role,
        input.countryCode.trim().toUpperCase(),
        input.facilityId ?? null,
        normalizedPhone,
        options.phoneVerified ?? false,
        options.emailVerified ?? false,
        options.authProvider ?? (normalizedEmail ? "LOCAL" : "PHONE"),
        options.accountStatus ?? "ACTIVE",
        options.credentialVerified ?? false,
      ],
    );
    return AuthenticatedUserSchema.parse(res.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      const constraintName =
        typeof err === "object" &&
        err !== null &&
        "constraint" in err &&
        typeof (err as { constraint?: unknown }).constraint === "string"
          ? (err as { constraint: string }).constraint
          : "";
      throw new DuplicateConflictError(
        constraintName.includes("phone")
          ? "Phone number is already registered."
          : "Email is already registered.",
      );
    }
    throw err;
  }
}

export async function recordUserLoginTimestamp(
  pool: Pool,
  userId: string,
): Promise<void> {
  await pool
    .query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [userId])
    .catch(() => undefined);
}

const STORED_USER_SELECT = `
  id,
  email,
  password_hash AS "passwordHash",
  full_name AS "fullName",
  role,
  country_code AS "countryCode",
  facility_id AS "facilityId",
  avatar_object_key AS "avatarObjectKey",
  email_verified AS "emailVerified",
  phone,
  phone_verified AS "phoneVerified",
  auth_provider AS "authProvider",
  google_sub AS "googleSub",
  account_status AS "accountStatus",
  credential_verified AS "credentialVerified",
  token_version AS "tokenVersion",
  CASE WHEN last_login_at IS NULL THEN NULL ELSE to_char(last_login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "lastLoginAtIso",
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
`;

export async function findUserByEmail(
  pool: Pool,
  email: string,
  s3Config?: S3PresignConfig,
): Promise<StoredUserRecord | null> {
  const res = await pool.query(
    `SELECT ${STORED_USER_SELECT}
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email.trim().toLowerCase()],
  );
  if (res.rowCount === 0) return null;
  return UserRowSchema.parse(
    hydrateUserAvatar(res.rows[0] as Record<string, unknown>, s3Config),
  );
}

export async function findUserByIdentifier(
  pool: Pool,
  identifier: string,
  s3Config?: S3PresignConfig,
): Promise<StoredUserRecord | null> {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) {
    return findUserByEmail(pool, trimmed, s3Config);
  }
  const normalizedPhone = normalizePhoneIdentifier(trimmed);
  if (!normalizedPhone) return null;

  const res = await pool.query(
    `SELECT ${STORED_USER_SELECT}
     FROM users
     WHERE phone = $1
     LIMIT 1`,
    [normalizedPhone],
  );
  if (res.rowCount === 0) return null;
  return UserRowSchema.parse(
    hydrateUserAvatar(res.rows[0] as Record<string, unknown>, s3Config),
  );
}

export class StaffPortalRequiredError extends Error {
  constructor(message = "Staff and Admin accounts must sign in through the Healthcare Staff portal.") {
    super(message);
    this.name = "StaffPortalRequiredError";
  }
}

export async function upsertPatientFromPhoneOtp(
  pool: Pool,
  input: {
    phone: string;
    fullName?: string | undefined;
    countryCode: string;
    role: PatientEasyRole;
  },
  s3Config?: S3PresignConfig,
): Promise<{ user: AuthenticatedUser; tokenVersion: number; created: boolean }> {
  const normalizedPhone = normalizePhoneIdentifier(input.phone);
  const existing = await findUserByIdentifier(pool, normalizedPhone, s3Config);

  if (existing) {
    if (existing.role !== "PATIENT" && existing.role !== "CAREGIVER") {
      throw new StaffPortalRequiredError();
    }
    const upd = await pool.query(
      `UPDATE users
       SET phone_verified = TRUE,
           last_login_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         email,
         full_name AS "fullName",
         role,
         country_code AS "countryCode",
         facility_id AS "facilityId",
         avatar_object_key AS "avatarObjectKey",
         email_verified AS "emailVerified",
         phone,
         phone_verified AS "phoneVerified",
         auth_provider AS "authProvider",
         account_status AS "accountStatus",
         credential_verified AS "credentialVerified",
         token_version AS "tokenVersion",
         CASE WHEN last_login_at IS NULL THEN NULL ELSE to_char(last_login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "lastLoginAtIso",
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"`,
      [existing.id],
    );
    const row = upd.rows[0] as Record<string, unknown>;
    return {
      user: AuthenticatedUserSchema.parse(hydrateUserAvatar(row, s3Config)),
      tokenVersion: Number(row.tokenVersion ?? 1),
      created: false,
    };
  }

  const displayName =
    input.fullName?.trim() ||
    `Patient ${normalizedPhone.slice(-4).padStart(4, "0")}`;

  const res = await pool.query(
    `INSERT INTO users (
       email,
       password_hash,
       full_name,
       role,
       country_code,
       facility_id,
       phone,
       phone_verified,
       email_verified,
       auth_provider,
       account_status,
       credential_verified,
       last_login_at
     )
     VALUES (NULL, NULL, $1, $2, $3, NULL, $4, TRUE, FALSE, 'PHONE', 'ACTIVE', FALSE, NOW())
     RETURNING
       id,
       email,
       full_name AS "fullName",
       role,
       country_code AS "countryCode",
       facility_id AS "facilityId",
       email_verified AS "emailVerified",
       phone,
       phone_verified AS "phoneVerified",
       auth_provider AS "authProvider",
       account_status AS "accountStatus",
       credential_verified AS "credentialVerified",
       CASE WHEN last_login_at IS NULL THEN NULL ELSE to_char(last_login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "lastLoginAtIso",
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"`,
    [displayName, input.role, input.countryCode.trim().toUpperCase(), normalizedPhone],
  );

  return {
    user: AuthenticatedUserSchema.parse(res.rows[0]),
    tokenVersion: 1,
    created: true,
  };
}

export async function upsertPatientFromGoogle(
  pool: Pool,
  input: {
    googleSub: string;
    email: string | null;
    emailVerified: boolean;
    fullName: string | null;
    countryCode: string;
    role: PatientEasyRole;
  },
  s3Config?: S3PresignConfig,
): Promise<{ user: AuthenticatedUser; tokenVersion: number; created: boolean }> {
  const normalizedEmail = input.email ? input.email.trim().toLowerCase() : null;

  const bySubRes = await pool.query(
    `SELECT ${STORED_USER_SELECT}
     FROM users
     WHERE google_sub = $1
     LIMIT 1`,
    [input.googleSub],
  );

  let existing: StoredUserRecord | null =
    bySubRes.rowCount && bySubRes.rows[0]
      ? UserRowSchema.parse(
          hydrateUserAvatar(bySubRes.rows[0] as Record<string, unknown>, s3Config),
        )
      : null;

  if (!existing && normalizedEmail && input.emailVerified) {
    existing = await findUserByEmail(pool, normalizedEmail, s3Config);
  }

  if (existing) {
    if (existing.role !== "PATIENT" && existing.role !== "CAREGIVER") {
      throw new StaffPortalRequiredError();
    }
    const upd = await pool.query(
      `UPDATE users
       SET google_sub = COALESCE(google_sub, $2),
           email_verified = CASE WHEN $3 THEN TRUE ELSE email_verified END,
           last_login_at = NOW()
       WHERE id = $1
       RETURNING
         id,
         email,
         full_name AS "fullName",
         role,
         country_code AS "countryCode",
         facility_id AS "facilityId",
         avatar_object_key AS "avatarObjectKey",
         email_verified AS "emailVerified",
         phone,
         phone_verified AS "phoneVerified",
         auth_provider AS "authProvider",
         account_status AS "accountStatus",
         credential_verified AS "credentialVerified",
         token_version AS "tokenVersion",
         CASE WHEN last_login_at IS NULL THEN NULL ELSE to_char(last_login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "lastLoginAtIso",
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"`,
      [existing.id, input.googleSub, input.emailVerified],
    );
    const row = upd.rows[0] as Record<string, unknown>;
    return {
      user: AuthenticatedUserSchema.parse(hydrateUserAvatar(row, s3Config)),
      tokenVersion: Number(row.tokenVersion ?? 1),
      created: false,
    };
  }

  const displayName =
    input.fullName?.trim() ||
    (normalizedEmail ? normalizedEmail.split("@")[0] ?? "MediSync Patient" : "MediSync Patient");

  const res = await pool.query(
    `INSERT INTO users (
       email,
       password_hash,
       full_name,
       role,
       country_code,
       facility_id,
       email_verified,
       auth_provider,
       google_sub,
       account_status,
       credential_verified,
       last_login_at
     )
     VALUES ($1, NULL, $2, $3, $4, NULL, $5, 'GOOGLE', $6, 'ACTIVE', FALSE, NOW())
     RETURNING
       id,
       email,
       full_name AS "fullName",
       role,
       country_code AS "countryCode",
       facility_id AS "facilityId",
       email_verified AS "emailVerified",
       phone,
       phone_verified AS "phoneVerified",
       auth_provider AS "authProvider",
       account_status AS "accountStatus",
       credential_verified AS "credentialVerified",
       CASE WHEN last_login_at IS NULL THEN NULL ELSE to_char(last_login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "lastLoginAtIso",
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"`,
    [
      normalizedEmail,
      displayName,
      input.role,
      input.countryCode.trim().toUpperCase(),
      input.emailVerified,
      input.googleSub,
    ],
  );

  return {
    user: AuthenticatedUserSchema.parse(res.rows[0]),
    tokenVersion: 1,
    created: true,
  };
}

export async function findUserById(
  pool: Pool,
  userId: string,
  s3Config?: S3PresignConfig,
): Promise<AuthenticatedUser | null> {
  const res = await pool.query(
    `SELECT
       id,
       email,
       full_name AS "fullName",
       role,
       country_code AS "countryCode",
       facility_id AS "facilityId",
       avatar_object_key AS "avatarObjectKey",
       email_verified AS "emailVerified",
       phone,
       phone_verified AS "phoneVerified",
       auth_provider AS "authProvider",
       account_status AS "accountStatus",
       credential_verified AS "credentialVerified",
       CASE WHEN last_login_at IS NULL THEN NULL ELSE to_char(last_login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END AS "lastLoginAtIso",
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );
  if (res.rowCount === 0) return null;
  return AuthenticatedUserSchema.parse(
    hydrateUserAvatar(res.rows[0] as Record<string, unknown>, s3Config),
  );
}

export async function insertFacility(
  pool: Pool,
  input: CreateFacilityInput,
  ownerUserId: string,
): Promise<FacilitySummary> {
  const countryCode = input.countryCode.trim().toUpperCase();
  const explicitCity = input.city?.trim() || null;
  const inferredCity =
    explicitCity ??
    (countryCode === "MA"
      ? (findMoroccanCity(input.address)?.name ?? null)
      : null);

  try {
    const res = await pool.query(
      `INSERT INTO facilities (
         country_code,
         city,
         kind,
         name,
         license_number,
         location,
         lat,
         lng,
         address,
         owner_user_id
       )
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography,
         $6,
         $7,
         $8,
         $9
       )
       RETURNING
         id,
         name,
         kind,
         country_code AS "countryCode",
         city,
         license_number AS "licenseNumber",
         verification_status AS "verificationStatus",
         lat,
         lng,
         address,
         owner_user_id AS "ownerUserId",
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"`,
      [
        countryCode,
        inferredCity,
        input.kind,
        input.name.trim(),
        input.licenseNumber.trim().toUpperCase(),
        input.lat,
        input.lng,
        input.address.trim(),
        ownerUserId,
      ],
    );
    return FacilitySummarySchema.parse(res.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DuplicateConflictError(
        "A facility with this license number is already registered in this country.",
      );
    }
    throw err;
  }
}

export async function listFacilitiesScoped(
  pool: Pool,
  query: FacilityListQuery,
  viewer: { userId: string; role: UserRole; countryCode: string },
): Promise<FacilitySummary[]> {
  const effectiveCountry =
    viewer.role === "OPS_ADMIN"
      ? (query.countryCode ?? null)
      : viewer.countryCode;

  const res = await pool.query(
    `SELECT
       id,
       name,
       kind,
       country_code AS "countryCode",
       city,
       license_number AS "licenseNumber",
       verification_status AS "verificationStatus",
       lat,
       lng,
       address,
       owner_user_id AS "ownerUserId",
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
     FROM facilities
     WHERE ($1::text IS NULL OR country_code = $1)
       AND ($2::text IS NULL OR kind = $2)
       AND ($3::text IS NULL OR verification_status = $3)
       AND (
         $4 = 'OPS_ADMIN'
         OR verification_status = 'VERIFIED'
         OR owner_user_id = $5::uuid
       )
     ORDER BY created_at DESC
     LIMIT $6`,
    [
      effectiveCountry,
      query.kind ?? null,
      query.status ?? null,
      viewer.role,
      viewer.userId,
      query.limit,
    ],
  );

  return res.rows.map((row) => FacilitySummarySchema.parse(row));
}

export async function updateFacilityVerification(
  pool: Pool,
  facilityId: string,
  status: Extract<VerificationStatus, "VERIFIED" | "SUSPENDED">,
): Promise<FacilitySummary | null> {
  const res = await pool.query(
    `UPDATE facilities
     SET verification_status = $2
     WHERE id = $1
     RETURNING
       id,
       name,
       kind,
       country_code AS "countryCode",
       city,
       license_number AS "licenseNumber",
       verification_status AS "verificationStatus",
       lat,
       lng,
       address,
       owner_user_id AS "ownerUserId",
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"`,
    [facilityId, status],
  );
  if (res.rowCount === 0) return null;
  return FacilitySummarySchema.parse(res.rows[0]);
}

export async function appendAuditLog(
  db: Pick<Pool, "query">,
  entry: Omit<AuditEvent, "eventId" | "occurredAtIso"> & {
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (
       country_code,
       actor_id,
       actor_role,
       action,
       resource_type,
       resource_id,
       metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      entry.countryCode,
      entry.actorId,
      entry.actorRole,
      entry.action,
      entry.resourceType,
      entry.resourceId,
      JSON.stringify(entry.metadata ?? {}),
    ],
  );
}

export async function bumpUserTokenVersion(
  pool: Pool,
  userId: string,
): Promise<number | null> {
  const res = await pool.query<{ tokenVersion: number }>(
    `UPDATE users
     SET token_version = token_version + 1
     WHERE id = $1
     RETURNING token_version AS "tokenVersion"`,
    [userId],
  );
  return res.rows[0]?.tokenVersion ?? null;
}

export async function listAuditLogs(
  pool: Pool,
  options: { countryCode?: string | undefined; limit: number },
): Promise<Array<z.infer<typeof AuditRowSchema>>> {
  const res = await pool.query(
    `SELECT
       event_id AS "eventId",
       country_code AS "countryCode",
       actor_id AS "actorId",
       actor_role AS "actorRole",
       action,
       resource_type AS "resourceType",
       resource_id AS "resourceId",
       metadata,
       to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "occurredAtIso"
     FROM audit_logs
     WHERE ($1::text IS NULL OR country_code = $1)
     ORDER BY occurred_at DESC
     LIMIT $2`,
    [options.countryCode ?? null, options.limit],
  );
  return res.rows.map((row) => AuditRowSchema.parse(row));
}
