import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import {
  RequestVerificationCodeSchema,
  ResetPasswordWithCodeSchema,
  UpdateProfileSchema,
  VerifyAccountCodeSchema,
} from "@medisync/contracts";
import type { S3PresignConfig } from "../../shared/storage/s3-presign.js";
import { authenticateRequest } from "../foundation/index.js";
import {
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
      );
      return reply.status(200).send({ user });
    } catch (err) {
      if (err instanceof RecoveryBadRequestError) {
        return reply.status(400).send({ error: err.message });
      }
      throw err;
    }
  });
}
