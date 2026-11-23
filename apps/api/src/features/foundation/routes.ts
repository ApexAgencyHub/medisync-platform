import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import {
  CreateFacilitySchema,
  FacilityListQuerySchema,
  GoogleAuthSchema,
  isStaffWorkerRole,
  LoginSchema,
  LogoutResponseSchema,
  normalizePhoneIdentifier,
  RegisterUserSchema,
  RequestPhoneOtpLoginResponseSchema,
  RequestPhoneOtpLoginSchema,
  RevokeSessionsResponseSchema,
  UserRoleSchema,
  VerifyFacilitySchema,
  VerifyPhoneOtpLoginSchema,
  type UserRole,
} from "@medisync/contracts";
import { validateFacilityLicense } from "@medisync/country-packs";
import {
  hashPassword,
  signAuthToken,
  verifyPassword,
} from "./auth-crypto.js";
import {
  authenticateRequest,
  clearSessionCookie,
  invalidateUserAuthCache,
  revokeJwtToken,
  setSessionCookie,
} from "./guard.js";
import { dispatchVerificationNotification } from "../../shared/notifications/dispatcher.js";
import { readOptionalEnvBool } from "../../shared/env.js";
import {
  bumpCacheGeneration,
  DIRECTORY_CACHE_GEN_KEY,
} from "../../shared/redis/cache.js";
import {
  hasTurnRelayConfigured,
  resolveConfiguredIceServers,
} from "../telehealth/index.js";
import {
  checkS3Health,
  type S3PresignConfig,
} from "../../shared/storage/s3-presign.js";
import {
  appendAuditLog,
  bumpUserTokenVersion,
  DuplicateConflictError,
  findUserById,
  findUserByIdentifier,
  insertFacility,
  insertUser,
  listAuditLogs,
  listFacilitiesScoped,
  pingDatabase,
  recordUserLoginTimestamp,
  StaffPortalRequiredError,
  updateFacilityVerification,
  upsertPatientFromGoogle,
  upsertPatientFromPhoneOtp,
} from "./store.js";

const FACILITY_ONBOARDING_ROLES: readonly UserRole[] = [
  "DOCTOR",
  "NURSE",
  "CLINIC_STAFF",
  "HOSPITAL_ADMIN",
  "PHARMACIST",
  "LAB_TECH",
  "OPS_ADMIN",
];

const FacilityIdParamSchema = z.object({
  id: z.string().uuid(),
});

const AuditQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2,4}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const PHONE_OTP_TTL_SEC = 10 * 60;
const PHONE_OTP_MAX_ATTEMPTS = 5;
const PHONE_OTP_RL_WINDOW_SEC = 15 * 60;
const PHONE_OTP_RL_MAX = 5;
const LOGIN_FAIL_WINDOW_SEC = 15 * 60;
const LOGIN_FAIL_MAX = 6;

const PHONE_OTP_RL_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

function hashPhoneOtp(
  normalizedPhone: string,
  code: string,
  authSecret: string,
): string {
  return crypto
    .createHmac("sha256", authSecret)
    .update(`${normalizedPhone}:${code}`, "utf8")
    .digest("hex");
}

function timingSafeHexEqual(aHex: string, bHex: string): boolean {
  const aBuf = Buffer.from(aHex, "hex");
  const bBuf = Buffer.from(bHex, "hex");
  if (aBuf.length === 0 || aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export interface GoogleTokenProfile {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  fullName: string | null;
}

async function verifyGoogleIdTokenDefault(
  idToken: string,
  expectedClientId: string,
): Promise<GoogleTokenProfile | null> {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const aud = typeof data.aud === "string" ? data.aud : "";
  const sub = typeof data.sub === "string" ? data.sub : "";
  const emailVerified =
    data.email_verified === true || data.email_verified === "true";
  const expSec =
    typeof data.exp === "string"
      ? Number.parseInt(data.exp, 10)
      : typeof data.exp === "number"
        ? data.exp
        : 0;
  if (!sub || aud !== expectedClientId || !emailVerified) {
    return null;
  }
  if (!Number.isFinite(expSec) || expSec <= Math.floor(Date.now() / 1000)) {
    return null;
  }
  return {
    sub,
    email: typeof data.email === "string" ? data.email : null,
    emailVerified,
    fullName: typeof data.name === "string" ? data.name : null,
  };
}

export async function registerFoundationRoutes(
  app: FastifyInstance,
  deps: {
    pool: Pool;
    redis?: Redis;
    authSecret: string;
    s3Config?: S3PresignConfig;
    allowPublicRegistration?: boolean;
    requireProviderVerification?: boolean;
    googleClientId?: string;
    googleTokenVerifier?: (idToken: string) => Promise<GoogleTokenProfile | null>;
  },
): Promise<void> {
  app.get("/health", async (_request, reply) => {
    const dbOk = await pingDatabase(deps.pool).catch(() => false);
    if (!dbOk) {
      return reply.status(503).send({ status: "degraded", db: false });
    }
    return {
      status: "ok",
      service: "medisync-api",
      db: true,
      rolesCount: UserRoleSchema.options.length,
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/ready", async (_request, reply) => {
    const dbOk = await pingDatabase(deps.pool).catch(() => false);

    let redisStatus: "OK" | "DEGRADED" | "SKIPPED" = "SKIPPED";
    if (deps.redis) {
      try {
        redisStatus = (await deps.redis.ping()) === "PONG" ? "OK" : "DEGRADED";
      } catch {
        redisStatus = "DEGRADED";
      }
    }

    const s3Health = deps.s3Config
      ? await checkS3Health(deps.s3Config)
      : { status: "SKIPPED" as const, bucketReady: false };

    const allHealthy =
      dbOk && redisStatus !== "DEGRADED" && s3Health.status !== "DEGRADED";

    return reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? "ready" : "degraded",
      service: "medisync-api",
      checks: {
        postgres: dbOk ? "OK" : "DEGRADED",
        redis: redisStatus,
        minio: s3Health.status,
        minioBucketReady: s3Health.bucketReady,
        telehealthTurnConfigured: hasTurnRelayConfigured(
          resolveConfiguredIceServers(),
        ),
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/v1/auth/register", async (request, reply) => {
    if (deps.allowPublicRegistration === false) {
      return reply.status(403).send({
        error: "PUBLIC_REGISTRATION_DISABLED",
        message:
          "Public self-registration is disabled in organization mode. Contact OPS_ADMIN to provision an account.",
      });
    }

    const parsed = RegisterUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }
    if (parsed.data.acceptedTerms === false) {
      return reply.status(400).send({
        error: "TERMS_ACCEPTANCE_REQUIRED",
        message: "You must accept the Terms of Service and Health Data Privacy Policy.",
      });
    }

    try {
      const passwordHash = await hashPassword(parsed.data.password);
      const isPendingStaff =
        Boolean(deps.requireProviderVerification) &&
        isStaffWorkerRole(parsed.data.role);
      const user = await insertUser(deps.pool, parsed.data, passwordHash, {
        accountStatus: isPendingStaff ? "PENDING_APPROVAL" : "ACTIVE",
        credentialVerified: false,
      });

      const portalSource = isStaffWorkerRole(user.role) ? "STAFF" : "PATIENT";
      const ipHash = request.ip
        ? crypto.createHash("sha256").update(request.ip).digest("hex")
        : null;
      await deps.pool
        .query(
          `INSERT INTO user_consents (
             user_id, consent_type, consent_version, granted, source_portal, ip_hash, user_agent
           )
           VALUES ($1, 'TERMS_PRIVACY', $2, TRUE, $3, $4, $5)
           ON CONFLICT (user_id, consent_type) DO UPDATE SET
             consent_version = EXCLUDED.consent_version,
             granted = TRUE,
             revoked_at = NULL`,
          [
            user.id,
            parsed.data.consentVersion ?? "2026-11",
            portalSource,
            ipHash,
            typeof request.headers["user-agent"] === "string"
              ? request.headers["user-agent"].slice(0, 240)
              : null,
          ],
        )
        .catch(() => undefined);

      await appendAuditLog(deps.pool, {
        countryCode: user.countryCode,
        actorId: user.id,
        actorRole: user.role,
        action: "USER_REGISTERED",
        resourceType: "user",
        resourceId: user.id,
      });

      if (
        user.role === "DOCTOR" ||
        user.role === "NURSE" ||
        user.role === "DRIVER"
      ) {
        await bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY);
      }

      const token = signAuthToken(
        {
          sub: user.id,
          role: user.role,
          countryCode: user.countryCode,
          facilityId: user.facilityId,
          email: user.email,
          ...(user.phone ? { phone: user.phone } : {}),
          ver: 1,
        },
        deps.authSecret,
      );
      setSessionCookie(reply, token);
      return reply.status(201).send({ token, user });
    } catch (err) {
      if (err instanceof DuplicateConflictError) {
        return reply.status(409).send({
          error: err.message.includes("Phone")
            ? "PHONE_ALREADY_REGISTERED"
            : "EMAIL_ALREADY_REGISTERED",
          message: err.message,
        });
      }
      throw err;
    }
  });

  app.post("/v1/auth/login", async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    const loginIdentifier =
      parsed.data.identifier ?? parsed.data.email ?? parsed.data.phone ?? "";
    const failKey = `medisync:auth:login_fail:${loginIdentifier.trim().toLowerCase()}`;
    if (deps.redis) {
      try {
        const failedCount = Number((await deps.redis.get(failKey)) ?? "0");
        if (failedCount >= LOGIN_FAIL_MAX) {
          return reply.status(429).send({
            error: "LOGIN_LOCKED_TEMPORARILY",
            message:
              "Too many failed sign-in attempts. Please wait 15 minutes or reset your password.",
          });
        }
      } catch {
        // Proceed safely if Redis cache check fails transiently.
      }
    }

    const stored = await findUserByIdentifier(
      deps.pool,
      loginIdentifier,
      deps.s3Config,
    );
    const passwordMatches =
      stored && stored.passwordHash
        ? await verifyPassword(parsed.data.password, stored.passwordHash)
        : false;
    if (!stored || !stored.passwordHash || !passwordMatches) {
      if (deps.redis) {
        try {
          const attempts = Number(
            await deps.redis.eval(
              PHONE_OTP_RL_LUA,
              1,
              failKey,
              String(LOGIN_FAIL_WINDOW_SEC),
            ),
          );
          if (attempts >= LOGIN_FAIL_MAX && stored) {
            await appendAuditLog(deps.pool, {
              countryCode: stored.countryCode,
              actorId: stored.id,
              actorRole: stored.role,
              action: "USER_LOGIN_LOCKED",
              resourceType: "user",
              resourceId: stored.id,
            }).catch(() => undefined);
          }
        } catch {
          // Ignore transient limiter error
        }
      }
      return reply.status(401).send({ error: "INVALID_CREDENTIALS" });
    }
    if (deps.redis) {
      await deps.redis.del(failKey).catch(() => undefined);
    }

    if (parsed.data.portalTrack === "PATIENT") {
      if (stored.role !== "PATIENT" && stored.role !== "CAREGIVER") {
        return reply.status(403).send({
          error: "USE_STAFF_PORTAL",
          message:
            "Healthcare staff and admin accounts must sign in using MediSync Pro (/pro).",
        });
      }
    } else if (parsed.data.portalTrack === "STAFF") {
      if (stored.role === "PATIENT" || stored.role === "CAREGIVER") {
        return reply.status(403).send({
          error: "USE_PATIENT_PORTAL",
          message:
            "Patient accounts must sign in using the Patient Access portal (/portal).",
        });
      }
    }

    if (stored.accountStatus === "SUSPENDED") {
      return reply.status(403).send({
        error: "ACCOUNT_SUSPENDED",
        message: "This account has been suspended by an administrator.",
      });
    }

    const loginIso = new Date().toISOString();
    await recordUserLoginTimestamp(deps.pool, stored.id);

    const user = {
      id: stored.id,
      email: stored.email,
      fullName: stored.fullName,
      role: stored.role,
      countryCode: stored.countryCode,
      facilityId: stored.facilityId,
      avatarUrl: stored.avatarUrl,
      emailVerified: stored.emailVerified,
      phone: stored.phone,
      phoneVerified: stored.phoneVerified,
      authProvider: stored.authProvider,
      accountStatus: stored.accountStatus,
      credentialVerified: stored.credentialVerified,
      lastLoginAtIso: loginIso,
      createdAtIso: stored.createdAtIso,
    };

    await appendAuditLog(deps.pool, {
      countryCode: user.countryCode,
      actorId: user.id,
      actorRole: user.role,
      action: "USER_LOGIN",
      resourceType: "user",
      resourceId: user.id,
    });

    const token = signAuthToken(
      {
        sub: user.id,
        role: user.role,
        countryCode: user.countryCode,
        facilityId: user.facilityId,
        email: user.email,
        ...(user.phone ? { phone: user.phone } : {}),
        ver: stored.tokenVersion,
      },
      deps.authSecret,
    );
    setSessionCookie(reply, token);
    return { token, user };
  });

  app.post("/v1/auth/phone/request-otp", async (request, reply) => {
    const parsed = RequestPhoneOtpLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    if (!deps.redis) {
      return reply.status(503).send({
        error: "PHONE_OTP_UNAVAILABLE",
        message: "SMS verification service is unavailable.",
      });
    }

    const normalizedPhone = normalizePhoneIdentifier(parsed.data.phone);
    if (normalizedPhone.length < 7) {
      return reply.status(400).send({
        error: "INVALID_PHONE",
        message: "Enter a valid mobile phone number including digits.",
      });
    }

    const existing = await findUserByIdentifier(
      deps.pool,
      normalizedPhone,
      deps.s3Config,
    );
    if (
      existing &&
      existing.role !== "PATIENT" &&
      existing.role !== "CAREGIVER"
    ) {
      return reply.status(403).send({
        error: "USE_STAFF_PORTAL",
        message:
          "Healthcare staff accounts must sign in through the Healthcare Staff portal.",
      });
    }

    const rlKey = `medisync:auth:phone_otp:rl:${normalizedPhone}`;
    const attempts = Number(
      await deps.redis.eval(
        PHONE_OTP_RL_LUA,
        1,
        rlKey,
        String(PHONE_OTP_RL_WINDOW_SEC),
      ),
    );
    if (attempts > PHONE_OTP_RL_MAX) {
      return reply.status(429).send({
        error: "OTP_RATE_LIMITED",
        message: "Too many SMS code requests. Wait 15 minutes before retrying.",
      });
    }

    const code = String(crypto.randomInt(100_000, 1_000_000));
    const codeHash = hashPhoneOtp(normalizedPhone, code, deps.authSecret);
    const otpKey = `medisync:auth:phone_otp:${normalizedPhone}`;
    await deps.redis.set(
      otpKey,
      JSON.stringify({ codeHash, attempts: 0 }),
      "EX",
      PHONE_OTP_TTL_SEC,
    );

    await dispatchVerificationNotification({
      channel: "SMS",
      recipient: normalizedPhone,
      purpose: "LOGIN_OTP",
      code,
      expiresInMinutes: 10,
    });

    const allowPreview =
      readOptionalEnvBool("ENABLE_DEV_OTP_PREVIEW") ??
      process.env.NODE_ENV !== "production";

    return reply.status(200).send(
      RequestPhoneOtpLoginResponseSchema.parse({
        sent: true,
        expiresInMinutes: 10,
        normalizedPhone,
        ...(allowPreview ? { devPreviewCode: code } : {}),
      }),
    );
  });

  app.post("/v1/auth/phone/verify-otp", async (request, reply) => {
    const parsed = VerifyPhoneOtpLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    if (!deps.redis) {
      return reply.status(503).send({ error: "PHONE_OTP_UNAVAILABLE" });
    }

    const normalizedPhone = normalizePhoneIdentifier(parsed.data.phone);
    const otpKey = `medisync:auth:phone_otp:${normalizedPhone}`;
    const rawChallenge = await deps.redis.get(otpKey);
    if (!rawChallenge) {
      return reply.status(400).send({ error: "INVALID_OR_EXPIRED_CODE" });
    }

    let challenge: { codeHash: string; attempts: number };
    try {
      challenge = JSON.parse(rawChallenge) as {
        codeHash: string;
        attempts: number;
      };
    } catch {
      await deps.redis.del(otpKey);
      return reply.status(400).send({ error: "INVALID_OR_EXPIRED_CODE" });
    }

    if (challenge.attempts >= PHONE_OTP_MAX_ATTEMPTS) {
      await deps.redis.del(otpKey);
      return reply.status(429).send({ error: "OTP_ATTEMPTS_EXCEEDED" });
    }

    const expectedHash = hashPhoneOtp(
      normalizedPhone,
      parsed.data.code,
      deps.authSecret,
    );
    if (!timingSafeHexEqual(challenge.codeHash, expectedHash)) {
      const nextAttempts = challenge.attempts + 1;
      if (nextAttempts >= PHONE_OTP_MAX_ATTEMPTS) {
        await deps.redis.del(otpKey);
        return reply.status(429).send({ error: "OTP_ATTEMPTS_EXCEEDED" });
      }
      const ttl = await deps.redis.ttl(otpKey);
      await deps.redis.set(
        otpKey,
        JSON.stringify({ codeHash: challenge.codeHash, attempts: nextAttempts }),
        "EX",
        ttl > 0 ? ttl : PHONE_OTP_TTL_SEC,
      );
      return reply.status(400).send({ error: "INVALID_OR_EXPIRED_CODE" });
    }

    await deps.redis.del(otpKey);

    try {
      const result = await upsertPatientFromPhoneOtp(
        deps.pool,
        {
          phone: normalizedPhone,
          ...(parsed.data.fullName ? { fullName: parsed.data.fullName } : {}),
          countryCode: parsed.data.countryCode,
          role: parsed.data.role,
        },
        deps.s3Config,
      );

      if (result.user.accountStatus === "SUSPENDED") {
        return reply.status(403).send({
          error: "ACCOUNT_SUSPENDED",
          message: "This account has been suspended by an administrator.",
        });
      }

      await appendAuditLog(deps.pool, {
        countryCode: result.user.countryCode,
        actorId: result.user.id,
        actorRole: result.user.role,
        action: result.created
          ? "PATIENT_PHONE_OTP_REGISTERED"
          : "PATIENT_PHONE_OTP_LOGIN",
        resourceType: "user",
        resourceId: result.user.id,
      });

      const token = signAuthToken(
        {
          sub: result.user.id,
          role: result.user.role,
          countryCode: result.user.countryCode,
          facilityId: result.user.facilityId,
          email: result.user.email,
          ...(result.user.phone ? { phone: result.user.phone } : {}),
          ver: result.tokenVersion,
        },
        deps.authSecret,
      );

      if (result.created) {
        await deps.pool
          .query(
            `INSERT INTO user_consents (user_id, consent_type, consent_version, granted, source_portal)
             VALUES ($1, 'TERMS_PRIVACY', '2026-11', TRUE, 'PATIENT')
             ON CONFLICT (user_id, consent_type) DO NOTHING`,
            [result.user.id],
          )
          .catch(() => undefined);
      }

      setSessionCookie(reply, token);
      return reply.status(result.created ? 201 : 200).send({
        token,
        user: result.user,
      });
    } catch (err) {
      if (err instanceof StaffPortalRequiredError) {
        return reply.status(403).send({
          error: "USE_STAFF_PORTAL",
          message: err.message,
        });
      }
      throw err;
    }
  });

  app.post("/v1/auth/google", async (request, reply) => {
    const parsed = GoogleAuthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    if (!deps.googleTokenVerifier && !deps.googleClientId) {
      return reply.status(503).send({
        error: "GOOGLE_OAUTH_NOT_CONFIGURED",
        message:
          "Google Sign-In requires GOOGLE_CLIENT_ID on the API server. Sign in using your Phone Number or Email.",
      });
    }

    const verifiedProfile = deps.googleTokenVerifier
      ? await deps.googleTokenVerifier(parsed.data.idToken).catch(() => null)
      : await verifyGoogleIdTokenDefault(
          parsed.data.idToken,
          deps.googleClientId!,
        ).catch(() => null);

    if (!verifiedProfile || !verifiedProfile.sub) {
      return reply.status(401).send({
        error: "INVALID_GOOGLE_TOKEN",
        message: "Google ID token could not be verified.",
      });
    }

    try {
      const result = await upsertPatientFromGoogle(
        deps.pool,
        {
          googleSub: verifiedProfile.sub,
          email: verifiedProfile.email,
          emailVerified: verifiedProfile.emailVerified,
          fullName: verifiedProfile.fullName,
          countryCode: parsed.data.countryCode,
          role: parsed.data.role,
        },
        deps.s3Config,
      );

      if (result.user.accountStatus === "SUSPENDED") {
        return reply.status(403).send({
          error: "ACCOUNT_SUSPENDED",
          message: "This account has been suspended by an administrator.",
        });
      }

      await appendAuditLog(deps.pool, {
        countryCode: result.user.countryCode,
        actorId: result.user.id,
        actorRole: result.user.role,
        action: result.created
          ? "PATIENT_GOOGLE_REGISTERED"
          : "PATIENT_GOOGLE_LOGIN",
        resourceType: "user",
        resourceId: result.user.id,
      });

      const token = signAuthToken(
        {
          sub: result.user.id,
          role: result.user.role,
          countryCode: result.user.countryCode,
          facilityId: result.user.facilityId,
          email: result.user.email,
          ...(result.user.phone ? { phone: result.user.phone } : {}),
          ver: result.tokenVersion,
        },
        deps.authSecret,
      );

      if (result.created) {
        await deps.pool
          .query(
            `INSERT INTO user_consents (user_id, consent_type, consent_version, granted, source_portal)
             VALUES ($1, 'TERMS_PRIVACY', '2026-11', TRUE, 'PATIENT')
             ON CONFLICT (user_id, consent_type) DO NOTHING`,
            [result.user.id],
          )
          .catch(() => undefined);
      }

      setSessionCookie(reply, token);
      return reply.status(result.created ? 201 : 200).send({
        token,
        user: result.user,
      });
    } catch (err) {
      if (err instanceof StaffPortalRequiredError) {
        return reply.status(403).send({
          error: "USE_STAFF_PORTAL",
          message: err.message,
        });
      }
      throw err;
    }
  });

  app.post("/v1/auth/logout", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    await revokeJwtToken(deps.redis, claims);
    await appendAuditLog(deps.pool, {
      countryCode: claims.countryCode,
      actorId: claims.sub,
      actorRole: claims.role,
      action: "USER_LOGOUT",
      resourceType: "user",
      resourceId: claims.sub,
    });
    clearSessionCookie(reply);

    return LogoutResponseSchema.parse({ revoked: true });
  });

  app.post("/v1/auth/revoke-sessions", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    const nextVersion = await bumpUserTokenVersion(deps.pool, claims.sub);
    if (nextVersion === null) {
      return reply.status(401).send({ error: "ACCOUNT_NOT_FOUND" });
    }

    await revokeJwtToken(deps.redis, claims);
    await invalidateUserAuthCache(deps.redis, claims.sub);

    await appendAuditLog(deps.pool, {
      countryCode: claims.countryCode,
      actorId: claims.sub,
      actorRole: claims.role,
      action: "USER_SESSIONS_REVOKED",
      resourceType: "user",
      resourceId: claims.sub,
      metadata: { tokenVersion: nextVersion },
    });

    const freshToken = signAuthToken(
      {
        sub: claims.sub,
        role: claims.role,
        countryCode: claims.countryCode,
        facilityId: claims.facilityId,
        email: claims.email,
        ...(claims.phone ? { phone: claims.phone } : {}),
        ver: nextVersion,
      },
      deps.authSecret,
    );
    setSessionCookie(reply, freshToken);

    return RevokeSessionsResponseSchema.parse({
      revoked: true,
      token: freshToken,
    });
  });

  app.get("/v1/auth/me", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    const user = await findUserById(deps.pool, claims.sub, deps.s3Config);
    if (!user) {
      return reply.status(401).send({ error: "ACCOUNT_NOT_FOUND" });
    }
    return { user };
  });

  app.post("/v1/facilities", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      FACILITY_ONBOARDING_ROLES,
    );
    if (!claims) return;

    const parsed = CreateFacilitySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    if (
      claims.role !== "OPS_ADMIN" &&
      parsed.data.countryCode !== claims.countryCode
    ) {
      return reply.status(403).send({ error: "CROSS_COUNTRY_FORBIDDEN" });
    }

    const licenseValid = validateFacilityLicense(
      parsed.data.countryCode,
      parsed.data.licenseNumber,
    );
    if (!licenseValid) {
      return reply.status(422).send({
        error: "INVALID_JURISDICTION_LICENSE",
        countryCode: parsed.data.countryCode,
      });
    }

    try {
      const facility = await insertFacility(
        deps.pool,
        parsed.data,
        claims.sub,
      );

      await appendAuditLog(deps.pool, {
        countryCode: facility.countryCode,
        actorId: claims.sub,
        actorRole: claims.role,
        action: "FACILITY_CREATED",
        resourceType: "facility",
        resourceId: facility.id,
        metadata: { kind: facility.kind, licenseNumber: facility.licenseNumber },
      });
      await bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY);

      return reply.status(201).send({ facility });
    } catch (err) {
      if (err instanceof DuplicateConflictError) {
        return reply.status(409).send({ error: "DUPLICATE_FACILITY_LICENSE" });
      }
      throw err;
    }
  });

  app.get("/v1/facilities", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    const parsed = FacilityListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_QUERY",
        issues: parsed.error.issues,
      });
    }

    const facilities = await listFacilitiesScoped(deps.pool, parsed.data, {
      userId: claims.sub,
      role: claims.role,
      countryCode: claims.countryCode,
    });
    return { facilities };
  });

  app.patch("/v1/admin/facilities/:id/verify", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      ["OPS_ADMIN"],
      { requireVerifiedProvider: Boolean(deps.requireProviderVerification) },
    );
    if (!claims) return;

    const paramParsed = FacilityIdParamSchema.safeParse(request.params);
    const bodyParsed = VerifyFacilitySchema.safeParse(request.body);
    if (!paramParsed.success || !bodyParsed.success) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD" });
    }

    const facility = await updateFacilityVerification(
      deps.pool,
      paramParsed.data.id,
      bodyParsed.data.status,
    );
    if (!facility) {
      return reply.status(404).send({ error: "FACILITY_NOT_FOUND" });
    }

    await appendAuditLog(deps.pool, {
      countryCode: facility.countryCode,
      actorId: claims.sub,
      actorRole: claims.role,
      action: "FACILITY_VERIFICATION_UPDATED",
      resourceType: "facility",
      resourceId: facility.id,
      metadata: {
        status: facility.verificationStatus,
        note: bodyParsed.data.note ?? null,
      },
    });
    await bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY);

    return { facility };
  });

  app.get("/v1/admin/audit-logs", async (request, reply) => {
    const claims = await authenticateRequest(
      request,
      reply,
      { authSecret: deps.authSecret, pool: deps.pool, redis: deps.redis },
      ["OPS_ADMIN"],
    );
    if (!claims) return;

    const parsed = AuditQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "INVALID_QUERY" });
    }

    const logs = await listAuditLogs(deps.pool, {
      countryCode: parsed.data.countryCode,
      limit: parsed.data.limit,
    });
    return { logs };
  });
}
