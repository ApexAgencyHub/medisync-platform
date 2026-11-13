import type { Pool } from "pg";
import { z } from "zod";
import {
  AuthenticatedUserSchema,
  FacilitySummarySchema,
  type AuditEvent,
  type AuthenticatedUser,
  type CreateFacilityInput,
  type FacilityListQuery,
  type FacilitySummary,
  type RegisterUserInput,
  type UserRole,
  type VerificationStatus,
} from "@medisync/contracts";
import {
  createSigV4PresignedUrl,
  type S3PresignConfig,
} from "../../shared/storage/s3-presign.js";

const UserRowSchema = AuthenticatedUserSchema.extend({
  passwordHash: z.string(),
  avatarObjectKey: z.string().nullable().optional(),
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
  input: RegisterUserInput,
  passwordHash: string,
): Promise<AuthenticatedUser> {
  try {
    const res = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, country_code, facility_id)
       VALUES ($1, $2, $3, $4, $5, $6)
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
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"`,
      [
        input.email.trim().toLowerCase(),
        passwordHash,
        input.fullName.trim(),
        input.role,
        input.countryCode.trim().toUpperCase(),
        input.facilityId ?? null,
      ],
    );
    return AuthenticatedUserSchema.parse(res.rows[0]);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DuplicateConflictError("Email is already registered.");
    }
    throw err;
  }
}

export async function findUserByEmail(
  pool: Pool,
  email: string,
  s3Config?: S3PresignConfig,
): Promise<StoredUserRecord | null> {
  const res = await pool.query(
    `SELECT
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
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
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
  try {
    const res = await pool.query(
      `INSERT INTO facilities (
         country_code,
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
         ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography,
         $5,
         $6,
         $7,
         $8
       )
       RETURNING
         id,
         name,
         kind,
         country_code AS "countryCode",
         license_number AS "licenseNumber",
         verification_status AS "verificationStatus",
         lat,
         lng,
         address,
         owner_user_id AS "ownerUserId",
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"`,
      [
        input.countryCode.trim().toUpperCase(),
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
       to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "occurredAtIso"
     FROM audit_logs
     WHERE ($1::text IS NULL OR country_code = $1)
     ORDER BY occurred_at DESC
     LIMIT $2`,
    [options.countryCode ?? null, options.limit],
  );
  return res.rows.map((row) => AuditRowSchema.parse(row));
}
