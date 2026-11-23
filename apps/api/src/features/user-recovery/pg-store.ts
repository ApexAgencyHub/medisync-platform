import crypto from "node:crypto";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import {
  AuthResponseSchema,
  AuthenticatedUserSchema,
  type AuthResponse,
  type AuthenticatedUser,
  type ChangePasswordInput,
  type RecoveryPurpose,
  type RequestVerificationCodeResponse,
  type ResetPasswordWithCodeInput,
  type UpdateProfileInput,
  type UserRole,
  type VerifyAccountCodeInput,
} from "@medisync/contracts";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import { readOptionalEnvBool } from "../../shared/env.js";
import { dispatchVerificationNotification } from "../../shared/notifications/dispatcher.js";
import {
  appendAuditLog,
  findUserById,
  hashPassword,
  invalidateUserAuthCache,
  revokeJwtToken,
  signAuthToken,
  verifyPassword,
  type AuthTokenClaims,
} from "../foundation/index.js";

const OTP_TTL_MINUTES = 15;
const OTP_RATE_LIMIT_MAX = 5;
const OTP_RATE_LIMIT_WINDOW_SEC = 900;

const OTP_RATE_LIMIT_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], tonumber(ARGV[1]))
end
return current
`;

export class RecoveryRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryRateLimitError";
  }
}

export class RecoveryBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecoveryBadRequestError";
  }
}

function hashVerificationOtp(
  email: string,
  purpose: RecoveryPurpose,
  targetContact: string,
  code: string,
  authSecret: string,
): string {
  return crypto
    .createHmac("sha256", authSecret)
    .update(
      `otp:v2:${purpose}:${email.trim().toLowerCase()}:${targetContact.trim().toLowerCase()}:${code.trim()}`,
    )
    .digest("hex");
}

function safeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function requestAccountVerificationCode(
  pool: Pool,
  redis: Redis,
  authSecret: string,
  input: { email: string; purpose: RecoveryPurpose; phone?: string },
): Promise<RequestVerificationCodeResponse> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const deliveryChannel: "EMAIL" | "SMS" =
    input.purpose === "VERIFY_PHONE" ? "SMS" : "EMAIL";

  // Atomic sliding-window counter per email + purpose to prevent OTP spam
  const rlKey = `medisync:otp:rl:${input.purpose}:${normalizedEmail}`;
  const attempts = Number(
    await redis.eval(OTP_RATE_LIMIT_LUA, 1, rlKey, String(OTP_RATE_LIMIT_WINDOW_SEC)),
  );
  if (attempts > OTP_RATE_LIMIT_MAX) {
    throw new RecoveryRateLimitError(
      "Too many verification code requests. Please wait 15 minutes.",
    );
  }

  const userRes = await pool.query<{
    id: string;
    countryCode: string;
    role: UserRole;
    phone: string | null;
  }>(
    `SELECT id, country_code AS "countryCode", role, phone
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [normalizedEmail],
  );

  // Never leak account existence on public password reset or email requests
  const user = userRes.rows[0];
  if (!user) {
    return {
      sent: true,
      expiresInMinutes: OTP_TTL_MINUTES,
      deliveryChannel,
    };
  }

  const targetContact =
    input.purpose === "VERIFY_PHONE"
      ? (input.phone?.trim() ?? user.phone ?? "")
      : normalizedEmail;

  if (input.purpose === "VERIFY_PHONE" && targetContact.length < 6) {
    throw new RecoveryBadRequestError(
      "Phone number is required to request an SMS verification code.",
    );
  }

  const otpCode = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashVerificationOtp(
    normalizedEmail,
    input.purpose,
    targetContact,
    otpCode,
    authSecret,
  );

  // Invalidate any prior unconsumed codes for this user + purpose before issuing a fresh one.
  await pool.query(
    `UPDATE user_verification_codes
     SET consumed_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
    [user.id, input.purpose],
  );

  await pool.query(
    `INSERT INTO user_verification_codes (
       user_id, purpose, code_hash, target_contact, expires_at
     )
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval)`,
    [user.id, input.purpose, codeHash, targetContact, String(OTP_TTL_MINUTES)],
  );

  await dispatchVerificationNotification({
    channel: deliveryChannel,
    recipient: targetContact,
    purpose: input.purpose,
    code: otpCode,
    expiresInMinutes: OTP_TTL_MINUTES,
  });

  await appendAuditLog(pool, {
    countryCode: user.countryCode,
    actorId: user.id,
    actorRole: user.role,
    action: `RECOVERY_CODE_REQUESTED_${input.purpose}`,
    resourceType: "user",
    resourceId: user.id,
    metadata: { deliveryChannel },
  });

  const allowPreview =
    readOptionalEnvBool("ENABLE_DEV_OTP_PREVIEW") ??
    process.env.NODE_ENV !== "production";
  return !allowPreview
    ? {
        sent: true,
        expiresInMinutes: OTP_TTL_MINUTES,
        deliveryChannel,
      }
    : {
        sent: true,
        expiresInMinutes: OTP_TTL_MINUTES,
        deliveryChannel,
        devPreviewCode: otpCode,
      };
}

async function verifyActiveOtpRow(
  client: Pick<Pool, "query"> & { query: Pool["query"] },
  normalizedEmail: string,
  purpose: RecoveryPurpose,
  code: string,
  authSecret: string,
  expectedPhone?: string,
): Promise<{
  id: string;
  userId: string;
  countryCode: string;
  role: UserRole;
  targetContact: string;
}> {
  const codeRes = await client.query<{
    id: string;
    userId: string;
    countryCode: string;
    role: UserRole;
    codeHash: string;
    targetContact: string;
    attemptCount: number;
    maxAttempts: number;
  }>(
    `SELECT
       c.id,
       c.user_id AS "userId",
       u.country_code AS "countryCode",
       u.role,
       c.code_hash AS "codeHash",
       c.target_contact AS "targetContact",
       c.attempt_count AS "attemptCount",
       c.max_attempts AS "maxAttempts"
     FROM user_verification_codes c
     JOIN users u ON u.id = c.user_id
     WHERE u.email = $1
       AND c.purpose = $2
       AND c.consumed_at IS NULL
       AND c.expires_at > NOW()
     ORDER BY c.created_at DESC
     LIMIT 1
     FOR UPDATE`,
    [normalizedEmail, purpose],
  );

  const match = codeRes.rows[0];
  if (!match) {
    throw new RecoveryBadRequestError("INVALID_OR_EXPIRED_CODE");
  }

  if (match.attemptCount >= match.maxAttempts) {
    await client.query(
      `UPDATE user_verification_codes SET consumed_at = NOW() WHERE id = $1`,
      [match.id],
    );
    await client.query("COMMIT");
    throw new RecoveryRateLimitError("OTP_ATTEMPTS_EXCEEDED");
  }

  if (
    purpose === "VERIFY_PHONE" &&
    expectedPhone &&
    expectedPhone.trim() !== match.targetContact.trim()
  ) {
    throw new RecoveryBadRequestError("PHONE_MISMATCH");
  }

  const expectedHash = hashVerificationOtp(
    normalizedEmail,
    purpose,
    match.targetContact,
    code,
    authSecret,
  );

  if (!safeHexEqual(match.codeHash, expectedHash)) {
    const nextAttempts = match.attemptCount + 1;
    await client.query(
      `UPDATE user_verification_codes
       SET attempt_count = $2,
           consumed_at = CASE WHEN $2 >= max_attempts THEN NOW() ELSE consumed_at END
       WHERE id = $1`,
      [match.id, nextAttempts],
    );
    await client.query("COMMIT");
    if (nextAttempts >= match.maxAttempts) {
      throw new RecoveryRateLimitError("OTP_ATTEMPTS_EXCEEDED");
    }
    throw new RecoveryBadRequestError("INVALID_OR_EXPIRED_CODE");
  }

  return match;
}

export async function confirmAccountVerificationCode(
  pool: Pool,
  authSecret: string,
  input: VerifyAccountCodeInput,
  s3Config?: S3PresignConfig,
): Promise<AuthenticatedUser> {
  const normalizedEmail = input.email.trim().toLowerCase();

  const client = await pool.connect();
  let userId = "";

  try {
    await client.query("BEGIN");

    const match = await verifyActiveOtpRow(
      client,
      normalizedEmail,
      input.purpose,
      input.code,
      authSecret,
      input.phone,
    );

    await client.query(
      `UPDATE user_verification_codes SET consumed_at = NOW() WHERE id = $1`,
      [match.id],
    );

    if (input.purpose === "VERIFY_EMAIL") {
      await client.query(
        `UPDATE users SET email_verified = TRUE WHERE id = $1`,
        [match.userId],
      );
    } else {
      // Always bind verification strictly to the targetContact that received the SMS OTP.
      const verifiedPhone = match.targetContact;
      await client.query(
        `UPDATE users SET phone = $2, phone_verified = TRUE WHERE id = $1`,
        [match.userId, verifiedPhone],
      );
    }

    await appendAuditLog(client, {
      countryCode: match.countryCode,
      actorId: match.userId,
      actorRole: match.role,
      action:
        input.purpose === "VERIFY_EMAIL"
          ? "ACCOUNT_EMAIL_VERIFIED"
          : "ACCOUNT_PHONE_VERIFIED",
      resourceType: "user",
      resourceId: match.userId,
    });

    await client.query("COMMIT");
    userId = match.userId;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "23505"
    ) {
      throw new RecoveryBadRequestError("PHONE_ALREADY_IN_USE");
    }
    throw err;
  } finally {
    client.release();
  }

  const updated = await findUserById(pool, userId, s3Config);
  if (!updated) {
    throw new RecoveryBadRequestError("USER_NOT_FOUND");
  }
  return AuthenticatedUserSchema.parse(updated);
}

export async function resetUserPasswordWithCode(
  pool: Pool,
  authSecret: string,
  input: ResetPasswordWithCodeInput,
  redis?: Redis,
): Promise<{ reset: boolean }> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const newPasswordHash = await hashPassword(input.newPassword);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const match = await verifyActiveOtpRow(
      client,
      normalizedEmail,
      "RESET_PASSWORD",
      input.code,
      authSecret,
    );

    await client.query(
      `UPDATE user_verification_codes SET consumed_at = NOW() WHERE id = $1`,
      [match.id],
    );
    await client.query(
      `UPDATE users
       SET password_hash = $2,
           email_verified = TRUE,
           token_version = token_version + 1
       WHERE id = $1`,
      [match.userId, newPasswordHash],
    );

    await appendAuditLog(client, {
      countryCode: match.countryCode,
      actorId: match.userId,
      actorRole: match.role,
      action: "PASSWORD_RESET_COMPLETED",
      resourceType: "user",
      resourceId: match.userId,
    });

    await client.query("COMMIT");
    await invalidateUserAuthCache(redis, match.userId);
    return { reset: true };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function updateUserProfileRecord(
  pool: Pool,
  userId: string,
  countryCode: string,
  role: UserRole,
  input: UpdateProfileInput,
  s3Config?: S3PresignConfig,
  redis?: Redis,
): Promise<AuthenticatedUser> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (input.fullName !== undefined) {
      await client.query(`UPDATE users SET full_name = $2 WHERE id = $1`, [
        userId,
        input.fullName.trim(),
      ]);
    }

    if (input.phone !== undefined) {
      const normalizedPhone = input.phone
        ? input.phone.trim().replace(/[\s()-]+/g, "")
        : null;
      await client.query(
        `UPDATE users SET phone = $2, phone_verified = FALSE WHERE id = $1`,
        [userId, normalizedPhone],
      );
    }

    if (input.facilityId !== undefined) {
      if (input.facilityId === null) {
        await client.query(
          `UPDATE users SET facility_id = NULL WHERE id = $1`,
          [userId],
        );
      } else {
        if (role === "PATIENT" || role === "CAREGIVER") {
          throw new RecoveryBadRequestError(
            "FACILITY_ASSIGNMENT_FORBIDDEN_FOR_ROLE",
          );
        }
        const userStateRes = await client.query<{
          facilityId: string | null;
          accountStatus: string;
          credentialVerified: boolean;
        }>(
          `SELECT facility_id AS "facilityId", account_status AS "accountStatus", credential_verified AS "credentialVerified"
           FROM users
           WHERE id = $1
           LIMIT 1`,
          [userId],
        );
        const currentUserState = userStateRes.rows[0];
        const facRes = await client.query<{
          id: string;
          ownerUserId: string | null;
        }>(
          `SELECT id, owner_user_id AS "ownerUserId"
           FROM facilities
           WHERE id = $1
             AND ($3 = 'OPS_ADMIN' OR country_code = $2)
           LIMIT 1`,
          [input.facilityId, countryCode, role],
        );
        const targetFacility = facRes.rows[0];
        if (!targetFacility) {
          throw new RecoveryBadRequestError(
            "FACILITY_NOT_FOUND_OR_CROSS_COUNTRY",
          );
        }
        const isPendingOnboarding =
          currentUserState?.accountStatus === "PENDING_APPROVAL" ||
          currentUserState?.credentialVerified === false;
        const canSelfAssign =
          role === "OPS_ADMIN" ||
          targetFacility.ownerUserId === userId ||
          currentUserState?.facilityId === input.facilityId ||
          isPendingOnboarding;
        if (!canSelfAssign) {
          throw new RecoveryBadRequestError(
            "FACILITY_REASSIGNMENT_REQUIRES_ADMIN",
          );
        }
        await client.query(
          `UPDATE users SET facility_id = $2 WHERE id = $1`,
          [userId, input.facilityId],
        );
      }
    }

    await appendAuditLog(client, {
      countryCode,
      actorId: userId,
      actorRole: role,
      action: "USER_PROFILE_UPDATED",
      resourceType: "user",
      resourceId: userId,
      metadata: {
        ...(input.facilityId !== undefined
          ? { facilityId: input.facilityId }
          : {}),
      },
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "23505"
    ) {
      throw new RecoveryBadRequestError(
        "This phone number is already associated with another MediSync account.",
      );
    }
    throw err;
  } finally {
    client.release();
  }

  await invalidateUserAuthCache(redis, userId);

  const user = await findUserById(pool, userId, s3Config);
  if (!user) {
    throw new RecoveryBadRequestError("USER_NOT_FOUND");
  }
  return AuthenticatedUserSchema.parse(user);
}

export async function changeUserPasswordRecord(
  pool: Pool,
  authSecret: string,
  claims: AuthTokenClaims,
  input: ChangePasswordInput,
  s3Config?: S3PresignConfig,
  redis?: Redis,
): Promise<AuthResponse> {
  const client = await pool.connect();
  let nextTokenVersion = 1;

  try {
    await client.query("BEGIN");
    const existingRes = await client.query<{
      passwordHash: string | null;
      countryCode: string;
      role: UserRole;
    }>(
      `SELECT
         password_hash AS "passwordHash",
         country_code AS "countryCode",
         role
       FROM users
       WHERE id = $1
       LIMIT 1
       FOR UPDATE`,
      [claims.sub],
    );
    const existing = existingRes.rows[0];
    if (!existing) {
      throw new RecoveryBadRequestError("USER_NOT_FOUND");
    }
    if (!existing.passwordHash) {
      throw new RecoveryBadRequestError(
        "PASSWORD_NOT_SET_USE_RESET",
      );
    }

    const matches = await verifyPassword(
      input.currentPassword,
      existing.passwordHash,
    );
    if (!matches) {
      throw new RecoveryBadRequestError("INVALID_CURRENT_PASSWORD");
    }

    const newHash = await hashPassword(input.newPassword);
    const updRes = await client.query<{ tokenVersion: number }>(
      `UPDATE users
       SET password_hash = $2,
           token_version = token_version + 1
       WHERE id = $1
       RETURNING token_version AS "tokenVersion"`,
      [claims.sub, newHash],
    );
    nextTokenVersion = updRes.rows[0]?.tokenVersion ?? 1;

    await appendAuditLog(client, {
      countryCode: existing.countryCode,
      actorId: claims.sub,
      actorRole: existing.role,
      action: "USER_PASSWORD_CHANGED",
      resourceType: "user",
      resourceId: claims.sub,
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

  const user = await findUserById(pool, claims.sub, s3Config);
  if (!user) {
    throw new RecoveryBadRequestError("USER_NOT_FOUND");
  }

  const token = signAuthToken(
    {
      sub: user.id,
      role: user.role,
      countryCode: user.countryCode,
      facilityId: user.facilityId,
      email: user.email,
      ...(user.phone ? { phone: user.phone } : {}),
      ver: nextTokenVersion,
    },
    authSecret,
  );

  return AuthResponseSchema.parse({ token, user });
}
