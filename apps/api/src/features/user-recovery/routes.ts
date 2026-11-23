import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import {
  ChangePasswordSchema,
  DeleteAccountInputSchema,
  RecordConsentInputSchema,
  RequestVerificationCodeSchema,
  ResetPasswordWithCodeSchema,
  UpdateProfileSchema,
  UserConsentsResponseSchema,
  VerifyAccountCodeSchema,
} from "@medisync/contracts";
import {
  bumpCacheGeneration,
  DIRECTORY_CACHE_GEN_KEY,
  SCHEDULES_CACHE_GEN_KEY,
} from "../../shared/redis/cache.js";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import {
  authenticateRequest,
  clearSessionCookie,
  setSessionCookie,
} from "../foundation/index.js";
import {
  anonymizeAndDeleteAccount,
  ComplianceBadRequestError,
  ComplianceConflictError,
  exportUserPersonalData,
  listUserConsents,
  recordUserConsent,
} from "./compliance-store.js";
import {
  changeUserPasswordRecord,
  confirmAccountVerificationCode,
  RecoveryBadRequestError,
  RecoveryRateLimitError,
  requestAccountVerificationCode,
  resetUserPasswordWithCode,
  updateUserProfileRecord,
} from "./pg-store.js";

export async function registerUserRecoveryRoutes(
  app: FastifyInstance,
  deps: {
    pool: Pool;
    redis: Redis;
    authSecret: string;
    s3Config?: S3PresignConfig;
  },
): Promise<void> {
  app.post("/v1/auth/verification/request", async (request, reply) => {
    const parsed = RequestVerificationCodeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const payload = {
        email: parsed.data.email,
        purpose: parsed.data.purpose,
        ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
      };
      const result = await requestAccountVerificationCode(
        deps.pool,
        deps.redis,
        deps.authSecret,
        payload,
      );
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof RecoveryRateLimitError) {
        return reply.status(429).send({ error: err.message });
      }
      if (err instanceof RecoveryBadRequestError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post("/v1/auth/verification/confirm", async (request, reply) => {
    const parsed = VerifyAccountCodeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const user = await confirmAccountVerificationCode(
        deps.pool,
        deps.authSecret,
        parsed.data,
        deps.s3Config,
      );
      return reply.status(200).send({ user });
    } catch (err) {
      if (err instanceof RecoveryRateLimitError) {
        return reply.status(429).send({ error: err.message });
      }
      if (err instanceof RecoveryBadRequestError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post("/v1/auth/password-reset", async (request, reply) => {
    const parsed = ResetPasswordWithCodeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const result = await resetUserPasswordWithCode(
        deps.pool,
        deps.authSecret,
        parsed.data,
        deps.redis,
      );
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof RecoveryRateLimitError) {
        return reply.status(429).send({ error: err.message });
      }
      if (err instanceof RecoveryBadRequestError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  app.patch("/v1/auth/profile", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    const parsed = UpdateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const user = await updateUserProfileRecord(
        deps.pool,
        claims.sub,
        claims.countryCode,
        claims.role,
        parsed.data,
        deps.s3Config,
        deps.redis,
      );
      await Promise.all([
        bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY),
        bumpCacheGeneration(deps.redis, SCHEDULES_CACHE_GEN_KEY),
      ]);
      return reply.status(200).send({ user });
    } catch (err) {
      if (err instanceof RecoveryBadRequestError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });

  app.post("/v1/auth/change-password", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    const parsed = ChangePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    try {
      const auth = await changeUserPasswordRecord(
        deps.pool,
        deps.authSecret,
        claims,
        parsed.data,
        deps.s3Config,
        deps.redis,
      );
      setSessionCookie(reply, auth.token);
      return reply.status(200).send(auth);
    } catch (err) {
      if (err instanceof RecoveryBadRequestError) {
        const statusCode =
          err.message === "INVALID_CURRENT_PASSWORD" ? 401 : 400;
        return reply.status(statusCode).send({ error: err.message });
      }
      throw err;
    }
  });

  app.get("/v1/users/me/consents", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    const consents = await listUserConsents(deps.pool, claims.sub);
    return reply.status(200).send(UserConsentsResponseSchema.parse({ consents }));
  });

  app.put("/v1/users/me/consents", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    const parsed = RecordConsentInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    const consent = await recordUserConsent(deps.pool, claims, parsed.data, {
      ip: request.ip,
      userAgent:
        typeof request.headers["user-agent"] === "string"
          ? request.headers["user-agent"]
          : undefined,
    });
    return reply.status(200).send({ consent });
  });

  app.get("/v1/users/me/data-export", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    try {
      const exported = await exportUserPersonalData(
        deps.pool,
        claims,
        deps.s3Config,
      );
      reply.header("Cache-Control", "private, no-store");
      if (
        typeof request.query === "object" &&
        request.query !== null &&
        (request.query as { download?: string }).download === "1"
      ) {
        reply.header(
          "Content-Disposition",
          `attachment; filename="medisync-data-export-${claims.sub.slice(0, 8)}.json"`,
        );
      }
      return reply.status(200).send(exported);
    } catch (err) {
      if (err instanceof ComplianceBadRequestError) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
  });

  app.delete("/v1/users/me/account", async (request, reply) => {
    const claims = await authenticateRequest(request, reply, {
      authSecret: deps.authSecret,
      pool: deps.pool,
      redis: deps.redis,
    });
    if (!claims) return;

    const parsed = DeleteAccountInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "DELETE_CONFIRMATION_REQUIRED",
        message: "Confirm erasure by passing { confirmation: 'DELETE_MY_ACCOUNT' }.",
      });
    }

    try {
      const res = await anonymizeAndDeleteAccount(
        deps.pool,
        claims,
        deps.redis,
      );
      await Promise.all([
        bumpCacheGeneration(deps.redis, DIRECTORY_CACHE_GEN_KEY),
        bumpCacheGeneration(deps.redis, SCHEDULES_CACHE_GEN_KEY),
      ]);
      clearSessionCookie(reply);
      return reply.status(200).send(res);
    } catch (err) {
      if (err instanceof ComplianceConflictError) {
        return reply.status(409).send({ error: err.message });
      }
      if (err instanceof ComplianceBadRequestError) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
  });
}
