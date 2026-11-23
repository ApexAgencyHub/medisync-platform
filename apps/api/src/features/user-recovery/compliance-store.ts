import crypto from "node:crypto";
import type { Redis } from "ioredis";
import type { Pool, PoolClient } from "pg";
import {
  DeleteAccountResponseSchema,
  LegalConsentRecordSchema,
  UserDataExportResponseSchema,
  type DeleteAccountResponse,
  type LegalConsentRecord,
  type RecordConsentInput,
  type UserDataExportResponse,
  type UserRole,
} from "@medisync/contracts";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
  appendAuditLog,
  findUserById,
  invalidateUserAuthCache,
  revokeJwtToken,
  type AuthTokenClaims,
} from "../foundation/index.js";

export class ComplianceBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplianceBadRequestError";
  }
}

export class ComplianceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComplianceConflictError";
  }
}

export async function listUserConsents(
  pool: Pool,
  userId: string,
): Promise<LegalConsentRecord[]> {
  const res = await pool.query(
    `SELECT
       id,
       user_id AS "userId",
       consent_type AS "consentType",
       consent_version AS "consentVersion",
       granted,
       source_portal AS "sourcePortal",
       to_char(granted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "grantedAtIso",
       CASE
         WHEN revoked_at IS NULL THEN NULL
         ELSE to_char(revoked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       END AS "revokedAtIso"
     FROM user_consents
     WHERE user_id = $1
     ORDER BY consent_type ASC`,
    [userId],
  );
  return res.rows.map((row) => LegalConsentRecordSchema.parse(row));
}

export async function recordUserConsent(
  pool: Pool,
  actor: Pick<AuthTokenClaims, "sub" | "role" | "countryCode">,
  input: RecordConsentInput,
  meta?: { ip?: string | undefined; userAgent?: string | undefined },
): Promise<LegalConsentRecord> {
  const client: PoolClient = await pool.connect();
  const ipHash = meta?.ip
    ? crypto.createHash("sha256").update(meta.ip).digest("hex")
    : null;
  const userAgent = meta?.userAgent?.slice(0, 240) ?? null;

  try {
    await client.query("BEGIN");

    const upsertRes = await client.query(
      `INSERT INTO user_consents (
         user_id,
         consent_type,
         consent_version,
         granted,
         source_portal,
         ip_hash,
         user_agent,
         granted_at,
         revoked_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, NOW(),
         CASE WHEN $4 THEN NULL ELSE NOW() END
       )
       ON CONFLICT (user_id, consent_type) DO UPDATE SET
         consent_version = EXCLUDED.consent_version,
         granted = EXCLUDED.granted,
         source_portal = EXCLUDED.source_portal,
         ip_hash = COALESCE(EXCLUDED.ip_hash, user_consents.ip_hash),
         user_agent = COALESCE(EXCLUDED.user_agent, user_consents.user_agent),
         granted_at = CASE WHEN EXCLUDED.granted THEN NOW() ELSE user_consents.granted_at END,
         revoked_at = CASE WHEN EXCLUDED.granted THEN NULL ELSE NOW() END
       RETURNING
         id,
         user_id AS "userId",
         consent_type AS "consentType",
         consent_version AS "consentVersion",
         granted,
         source_portal AS "sourcePortal",
         to_char(granted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "grantedAtIso",
         CASE
           WHEN revoked_at IS NULL THEN NULL
           ELSE to_char(revoked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
         END AS "revokedAtIso"`,
      [
        actor.sub,
        input.consentType,
        input.consentVersion,
        input.granted,
        input.sourcePortal,
        ipHash,
        userAgent,
      ],
    );

    if (
      input.consentType === "TELEHEALTH_CONSENT" ||
      input.consentType === "DATA_SHARING"
    ) {
      const column =
        input.consentType === "TELEHEALTH_CONSENT"
          ? "telehealth_consent"
          : "data_sharing_consent";
      await client.query(
        `UPDATE patient_medical_profiles
         SET ${column} = $2,
             updated_by_user_id = $1,
             updated_at = NOW()
         WHERE user_id = $1`,
        [actor.sub, input.granted],
      );
    }

    await appendAuditLog(client, {
      countryCode: actor.countryCode,
      actorId: actor.sub,
      actorRole: actor.role,
      action: input.granted ? "LEGAL_CONSENT_GRANTED" : "LEGAL_CONSENT_REVOKED",
      resourceType: "user_consent",
      resourceId: actor.sub,
      metadata: {
        consentType: input.consentType,
        consentVersion: input.consentVersion,
        sourcePortal: input.sourcePortal,
      },
    });

    await client.query("COMMIT");
    return LegalConsentRecordSchema.parse(upsertRes.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function exportUserPersonalData(
  pool: Pool,
  claims: AuthTokenClaims,
  s3Config?: S3PresignConfig,
): Promise<UserDataExportResponse> {
  const user = await findUserById(pool, claims.sub, s3Config);
  if (!user) {
    throw new ComplianceBadRequestError("USER_NOT_FOUND");
  }

  const [
    consents,
    medProfileRes,
    insurancesRes,
    appointmentsRes,
    prescriptionsRes,
    labOrdersRes,
    pharmacyOrdersRes,
    dispatchesRes,
  ] = await Promise.all([
    listUserConsents(pool, claims.sub),
    pool.query<Record<string, unknown>>(
      `SELECT * FROM patient_medical_profiles WHERE user_id = $1 LIMIT 1`,
      [claims.sub],
    ),
    pool.query<Record<string, unknown>>(
      `SELECT id, provider_name AS "providerName", coverage_plan AS "coveragePlan", coverage_percent AS "coveragePercent", verification_status AS "verificationStatus", valid_until AS "validUntil"
       FROM patient_insurance_policies
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [claims.sub],
    ),
    pool.query<Record<string, unknown>>(
      `SELECT id, country_code AS "countryCode", visit_mode AS "visitMode", status, reason, to_char(slot_start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "slotStartIso"
       FROM appointments
       WHERE patient_user_id = $1 OR doctor_user_id = $1
       ORDER BY slot_start_at DESC
       LIMIT 200`,
      [claims.sub],
    ),
    pool.query<Record<string, unknown>>(
      `SELECT id, country_code AS "countryCode", status, medications, notes, to_char(issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "issuedAtIso"
       FROM prescriptions
       WHERE patient_user_id = $1
       ORDER BY issued_at DESC
       LIMIT 200`,
      [claims.sub],
    ),
    pool.query<Record<string, unknown>>(
      `SELECT id, country_code AS "countryCode", panel_name AS "panelName", urgency, status, result_summary AS "resultSummary", to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
       FROM lab_orders
       WHERE patient_user_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [claims.sub],
    ),
    pool.query<Record<string, unknown>>(
      `SELECT id, country_code AS "countryCode", fulfillment_mode AS "fulfillmentMode", status, currency_code AS "currencyCode", total_minor AS "totalMinor", receipt_number AS "receiptNumber", to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
       FROM pharmacy_orders
       WHERE patient_user_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [claims.sub],
    ),
    pool.query<Record<string, unknown>>(
      `SELECT id, country_code AS "countryCode", status, urgency, pickup_address AS "pickupAddress", to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAtIso"
       FROM dispatch_requests
       WHERE patient_user_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [claims.sub],
    ),
  ]);

  await appendAuditLog(pool, {
    countryCode: claims.countryCode,
    actorId: claims.sub,
    actorRole: claims.role,
    action: "USER_DATA_EXPORTED",
    resourceType: "user",
    resourceId: claims.sub,
  });

  return UserDataExportResponseSchema.parse({
    exportedAtIso: new Date().toISOString(),
    standard: "CNDP-09-08/GDPR-ART20",
    user,
    consents,
    medicalProfile: medProfileRes.rows[0] ?? null,
    insurances: insurancesRes.rows,
    appointments: appointmentsRes.rows,
    prescriptions: prescriptionsRes.rows,
    labOrders: labOrdersRes.rows,
    pharmacyOrders: pharmacyOrdersRes.rows,
    dispatches: dispatchesRes.rows,
  });
}

export async function anonymizeAndDeleteAccount(
  pool: Pool,
  claims: AuthTokenClaims,
  redis?: Redis,
): Promise<DeleteAccountResponse> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const userRes = await client.query<{
      id: string;
      role: UserRole;
      countryCode: string;
      accountStatus: string;
    }>(
      `SELECT id, role, country_code AS "countryCode", account_status AS "accountStatus"
       FROM users
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [claims.sub],
    );
    const existing = userRes.rows[0];
    if (!existing) {
      throw new ComplianceBadRequestError("USER_NOT_FOUND");
    }

    if (existing.role === "OPS_ADMIN") {
      const remainingAdmins = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM users
         WHERE role = 'OPS_ADMIN'
           AND account_status = 'ACTIVE'
           AND id <> $1`,
        [claims.sub],
      );
      if (Number(remainingAdmins.rows[0]?.count ?? "0") === 0) {
        throw new ComplianceConflictError("LAST_ACTIVE_ADMIN_PROTECTED");
      }
    }

    const anonEmail = `deleted-${claims.sub}@anonymized.medisync.local`;
    await client.query(
      `UPDATE users
       SET email = $2,
           phone = NULL,
           google_sub = NULL,
           password_hash = NULL,
           full_name = 'Anonymized Member',
           avatar_object_key = NULL,
           email_verified = FALSE,
           phone_verified = FALSE,
           account_status = 'SUSPENDED',
           credential_verified = FALSE,
           token_version = token_version + 1
       WHERE id = $1`,
      [claims.sub, anonEmail],
    );

    await client.query(
      `UPDATE user_consents
       SET granted = FALSE,
           revoked_at = NOW()
       WHERE user_id = $1`,
      [claims.sub],
    );

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: claims.sub,
      actorRole: existing.role,
      action: "USER_ACCOUNT_ANONYMIZED",
      resourceType: "user",
      resourceId: claims.sub,
      metadata: { reason: "USER_REQUESTED_ERASURE" },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }

  await revokeJwtToken(redis, claims);
  await invalidateUserAuthCache(redis, claims.sub);

  return DeleteAccountResponseSchema.parse({
    deleted: true,
    anonymizedUserId: claims.sub,
  });
}
