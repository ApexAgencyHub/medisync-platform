import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import type {
  AuthResponse,
  RequestVerificationCodeResponse,
} from "@medisync/contracts";
import { buildApiServer } from "../../server.js";
import { createDbPool } from "../../shared/db/pool.js";
import { runMigrations } from "../../shared/db/migrate.js";
import { createRedisClient } from "../../shared/redis/client.js";

const DEFAULT_TEST_DB_URL =
  "postgresql://medisync:medisync_dev_password@127.0.0.1:5433/medisync";
const DEFAULT_TEST_REDIS_URL = "redis://127.0.0.1:6380";
const TEST_AUTH_SECRET =
  process.env.AUTH_SECRET ??
  "medisync-ci-ephemeral-test-secret-minimum-32-chars";

describe("api slice 8 user-recovery: email/SMS OTP verification, password reset & rate limit", () => {
  let pool: Pool;
  let redis: Redis;
  let app: FastifyInstance;

  const runSuffix = crypto.randomBytes(4).toString("hex");
  const createdUserIds: string[] = [];
  const rateLimitKeysToDelete: string[] = [];

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
    for (const key of rateLimitKeysToDelete) {
      await redis.del(key);
    }
    if (createdUserIds.length > 0) {
      await pool.query(
        "DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[])",
        [createdUserIds],
      );
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
    }
    await app.close();
    await redis.quit();
    await pool.end();
  });

  it("verifies email & phone OTP, resets password securely, updates profile, and throttles OTP spam", async () => {
    const email = `recovery-${runSuffix}@medisync.test`;
    rateLimitKeysToDelete.push(
      `medisync:otp:rl:VERIFY_EMAIL:${email}`,
      `medisync:otp:rl:VERIFY_PHONE:${email}`,
      `medisync:otp:rl:RESET_PASSWORD:${email}`,
      `medisync:auth:login_fail:${email}`,
    );

    const regRes = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email,
        password: "InitialPassword!123",
        fullName: "Nadia El Amrani",
        role: "PATIENT",
        countryCode: "MA",
      },
    });
    expect(regRes.statusCode).toBe(201);
    const regBody = regRes.json<AuthResponse>();
    createdUserIds.push(regBody.user.id);
    expect(regBody.user.emailVerified).toBe(false);

    // 1. Request email OTP -> confirm -> check emailVerified: true
    const reqEmailOtp = await app.inject({
      method: "POST",
      url: "/v1/auth/verification/request",
      payload: { email, purpose: "VERIFY_EMAIL" },
    });
    expect(reqEmailOtp.statusCode).toBe(200);
    const otpEmailBody = reqEmailOtp.json<RequestVerificationCodeResponse>();
    expect(otpEmailBody.sent).toBe(true);
    expect(otpEmailBody.deliveryChannel).toBe("EMAIL");
    expect(otpEmailBody.devPreviewCode).toMatch(/^\d{6}$/);

    const badVerify = await app.inject({
      method: "POST",
      url: "/v1/auth/verification/confirm",
      payload: {
        email,
        purpose: "VERIFY_EMAIL",
        code: "000000",
      },
    });
    expect(badVerify.statusCode).toBe(400);

    const verifyEmailRes = await app.inject({
      method: "POST",
      url: "/v1/auth/verification/confirm",
      payload: {
        email,
        purpose: "VERIFY_EMAIL",
        code: otpEmailBody.devPreviewCode!,
      },
    });
    expect(verifyEmailRes.statusCode).toBe(200);
    expect(verifyEmailRes.json<{ user: AuthResponse["user"] }>().user.emailVerified).toBe(true);

    // 2. Request SMS phone OTP -> confirm
    const phone = "+212661223344";
    const reqSmsRes = await app.inject({
      method: "POST",
      url: "/v1/auth/verification/request",
      payload: { email, purpose: "VERIFY_PHONE", phone },
    });
    expect(reqSmsRes.statusCode).toBe(200);
    const smsOtpBody = reqSmsRes.json<RequestVerificationCodeResponse>();
    expect(smsOtpBody.deliveryChannel).toBe("SMS");

    const verifySmsRes = await app.inject({
      method: "POST",
      url: "/v1/auth/verification/confirm",
      payload: {
        email,
        purpose: "VERIFY_PHONE",
        phone,
        code: smsOtpBody.devPreviewCode!,
      },
    });
    expect(verifySmsRes.statusCode).toBe(200);
    const verifiedUser = verifySmsRes.json<{ user: AuthResponse["user"] }>().user;
    expect(verifiedUser.phoneVerified).toBe(true);
    expect(verifiedUser.phone).toBe(phone);

    // 3. Password reset flow -> old password fails -> new password succeeds
    const resetReqRes = await app.inject({
      method: "POST",
      url: "/v1/auth/verification/request",
      payload: { email, purpose: "RESET_PASSWORD" },
    });
    expect(resetReqRes.statusCode).toBe(200);
    const resetCode = resetReqRes.json<RequestVerificationCodeResponse>().devPreviewCode!;

    const resetConfirmRes = await app.inject({
      method: "POST",
      url: "/v1/auth/password-reset",
      payload: {
        email,
        code: resetCode,
        newPassword: "RotatedStrongPassword!456",
      },
    });
    expect(resetConfirmRes.statusCode).toBe(200);

    const oldLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: "InitialPassword!123" },
    });
    expect(oldLogin.statusCode).toBe(401);

    const newLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: "RotatedStrongPassword!456" },
    });
    expect(newLogin.statusCode).toBe(200);
    const newToken = newLogin.json<AuthResponse>().token;

    // 4. Authenticated password change rotates token version & issues fresh working JWT
    const badChangePw = await app.inject({
      method: "POST",
      url: "/v1/auth/change-password",
      headers: { authorization: `Bearer ${newToken}` },
      payload: {
        currentPassword: "WrongCurrentPassword!",
        newPassword: "RotatedAgainPassword!789",
      },
    });
    expect(badChangePw.statusCode).toBe(401);

    const changePwRes = await app.inject({
      method: "POST",
      url: "/v1/auth/change-password",
      headers: { authorization: `Bearer ${newToken}` },
      payload: {
        currentPassword: "RotatedStrongPassword!456",
        newPassword: "RotatedAgainPassword!789",
      },
    });
    expect(changePwRes.statusCode).toBe(200);
    const rotatedToken = changePwRes.json<AuthResponse>().token;

    const staleTokenMe = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${newToken}` },
    });
    expect(staleTokenMe.statusCode).toBe(401);

    const freshTokenMe = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${rotatedToken}` },
    });
    expect(freshTokenMe.statusCode).toBe(200);

    // 4b. Revoke all other sessions rotates token version and keeps current device active
    const revokeAllRes = await app.inject({
      method: "POST",
      url: "/v1/auth/revoke-sessions",
      headers: { authorization: `Bearer ${rotatedToken}` },
    });
    expect(revokeAllRes.statusCode).toBe(200);
    const activeTokenAfterRevoke = revokeAllRes.json<{
      revoked: boolean;
      token: string;
    }>().token;
    const oldAfterRevoke = await app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { authorization: `Bearer ${rotatedToken}` },
    });
    expect(oldAfterRevoke.statusCode).toBe(401);

    // 5. Profile update resets phoneVerified when phone changes
    const profilePatch = await app.inject({
      method: "PATCH",
      url: "/v1/auth/profile",
      headers: { authorization: `Bearer ${activeTokenAfterRevoke}` },
      payload: { fullName: "Nadia El Amrani Updated", phone: "+212661998877" },
    });
    expect(profilePatch.statusCode).toBe(200);
    const patchedUser = profilePatch.json<{ user: AuthResponse["user"] }>().user;
    expect(patchedUser.fullName).toBe("Nadia El Amrani Updated");
    expect(patchedUser.phoneVerified).toBe(false);

    // 6. Brute-force login protection locks account identifier after 6 bad attempts
    for (let i = 0; i < 6; i++) {
      const failAttempt = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email, password: "BadGuessPassword!" },
      });
      expect(failAttempt.statusCode).toBe(401);
    }
    const lockedAttempt = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: "RotatedAgainPassword!789" },
    });
    expect(lockedAttempt.statusCode).toBe(429);

    // 7. Redis sliding-window rate limit triggers 429 on excess OTP requests (>5)
    for (let i = 0; i < 4; i++) {
      const okAttempt = await app.inject({
        method: "POST",
        url: "/v1/auth/verification/request",
        payload: { email, purpose: "RESET_PASSWORD" },
      });
      expect(okAttempt.statusCode).toBe(200);
    }
    const throttled = await app.inject({
      method: "POST",
      url: "/v1/auth/verification/request",
      payload: { email, purpose: "RESET_PASSWORD" },
    });
    expect(throttled.statusCode).toBe(429);
  });
});
