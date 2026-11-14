import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { z } from "zod";
import {
  CreateFacilitySchema,
  FacilityListQuerySchema,
  LoginSchema,
  LogoutResponseSchema,
  RegisterUserSchema,
  UserRoleSchema,
  VerifyFacilitySchema,
  type UserRole,
} from "@medisync/contracts";
import { validateFacilityLicense } from "@medisync/country-packs";
import {
  hashPassword,
  signAuthToken,
  verifyPassword,
} from "./auth-crypto.js";
import { authenticateRequest, revokeJwtToken } from "./guard.js";
import {
  checkS3Health,
  type S3PresignConfig,
} from "../../shared/storage/s3-presign.js";
import {
  appendAuditLog,
  DuplicateConflictError,
  findUserByEmail,
  findUserById,
  insertFacility,
  insertUser,
  listAuditLogs,
  listFacilitiesScoped,
  pingDatabase,
  recordUserLoginTimestamp,
  updateFacilityVerification,
} from "./store.js";

const FACILITY_ONBOARDING_ROLES: readonly UserRole[] = [
  "DOCTOR",
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

export async function registerFoundationRoutes(
  app: FastifyInstance,
  deps: {
    pool: Pool;
    redis?: Redis;
    authSecret: string;
    s3Config?: S3PresignConfig;
    allowPublicRegistration?: boolean;
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

    try {
      const passwordHash = await hashPassword(parsed.data.password);
      const user = await insertUser(deps.pool, parsed.data, passwordHash);

      await appendAuditLog(deps.pool, {
        countryCode: user.countryCode,
        actorId: user.id,
        actorRole: user.role,
        action: "USER_REGISTERED",
        resourceType: "user",
        resourceId: user.id,
      });

      if (user.role === "DOCTOR") {
        await deps.redis?.incr("medisync:cache:gen:directory").catch(() => undefined);
      }

      const token = signAuthToken(
        {
          sub: user.id,
          role: user.role,
          countryCode: user.countryCode,
          facilityId: user.facilityId,
          email: user.email,
          ver: 1,
        },
        deps.authSecret,
      );
      return reply.status(201).send({ token, user });
    } catch (err) {
      if (err instanceof DuplicateConflictError) {
        return reply.status(409).send({ error: "EMAIL_ALREADY_REGISTERED" });
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

    const stored = await findUserByEmail(
      deps.pool,
      parsed.data.email,
      deps.s3Config,
    );
    if (!stored) {
      return reply.status(401).send({ error: "INVALID_CREDENTIALS" });
    }

    const passwordMatches = await verifyPassword(
      parsed.data.password,
      stored.passwordHash,
    );
    if (!passwordMatches) {
      return reply.status(401).send({ error: "INVALID_CREDENTIALS" });
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
        ver: stored.tokenVersion,
      },
      deps.authSecret,
    );
    return { token, user };
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

    return LogoutResponseSchema.parse({ revoked: true });
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
      await deps.redis?.incr("medisync:cache:gen:directory").catch(() => undefined);

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
    await deps.redis?.incr("medisync:cache:gen:directory").catch(() => undefined);

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
