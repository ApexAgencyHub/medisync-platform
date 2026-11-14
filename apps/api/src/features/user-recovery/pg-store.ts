import crypto from "node:crypto";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import {
  AuthenticatedUserSchema,
  type AuthenticatedUser,
  type RecoveryPurpose,
  type RequestVerificationCodeResponse,
  type ResetPasswordWithCodeInput,
  type UpdateProfileInput,
  type UserRole,
  type VerifyAccountCodeInput,
} from "@medisync/contracts";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
  appendAuditLog,
  findUserById,
  hashPassword,
  invalidateUserAuthCache,
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
  code: string,
  authSecret: string,
): string {
  return crypto
    .createHmac("sha256", authSecret)
    .update(`otp:v1:${purpose}:${email.trim().toLowerCase()}:${code.trim()}`)
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
    otpCode,
    authSecret,
  );

  await pool.query(
    `INSERT INTO user_verification_codes (
       user_id, purpose, code_hash, target_contact, expires_at
     )
     VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval)`,
    [user.id, input.purpose, codeHash, targetContact, String(OTP_TTL_MINUTES)],
  );

  await appendAuditLog(pool, {
    countryCode: user.countryCode,
    actorId: user.id,
    actorRole: user.role,
    action: `RECOVERY_CODE_REQUESTED_${input.purpose}`,
    resourceType: "user",
    resourceId: user.id,
    metadata: { deliveryChannel },
  });

  const isProd = process.env.NODE_ENV === "production";
  return isProd
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
  expectedHash: string,
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
  const expectedHash = hashVerificationOtp(
    normalizedEmail,
    input.purpose,
    input.code,
    authSecret,
  );

  const client = await pool.connect();
  let userId = "";

  try {
    await client.query("BEGIN");

    const match = await verifyActiveOtpRow(
      client,
      normalizedEmail,
      input.purpose,
      expectedHash,
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
      const verifiedPhone = input.phone?.trim() ?? match.targetContact;
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
    await client.query("ROLLBACK");
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
  const expectedHash = hashVerificationOtp(
    normalizedEmail,
    "RESET_PASSWORD",
    input.code,
    authSecret,
  );
  const newPasswordHash = await hashPassword(input.newPassword);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const match = await verifyActiveOtpRow(
      client,
      normalizedEmail,
      "RESET_PASSWORD",
      expectedHash,
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
      await client.query(
        `UPDATE users SET phone = $2, phone_verified = FALSE WHERE id = $1`,
        [userId, input.phone],
      );
    }

    await appendAuditLog(client, {
      countryCode,
      actorId: userId,
      actorRole: role,
      action: "USER_PROFILE_UPDATED",
      resourceType: "user",
      resourceId: userId,
    });

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const user = await findUserById(pool, userId, s3Config);
  if (!user) {
    throw new RecoveryBadRequestError("USER_NOT_FOUND");
  }
  return AuthenticatedUserSchema.parse(user);
}
