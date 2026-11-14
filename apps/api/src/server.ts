import crypto from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { registerFoundationRoutes } from "./features/foundation/index.js";
import { registerCountryPackRoutes } from "./features/country-packs/index.js";
import { registerMapsDispatchRoutes } from "./features/maps-dispatch/index.js";
import { registerBookingRoutes } from "./features/booking/index.js";
import { registerClinicalRoutes } from "./features/clinical-pharmacy-labs/index.js";
import { registerAdminOpsRoutes } from "./features/admin-ops/index.js";
import { registerMediaCertificationRoutes } from "./features/media-certifications/index.js";
import {
  registerDirectoryRoutes,
  seedRealisticWorld,
} from "./features/directory/index.js";
import { registerUserRecoveryRoutes } from "./features/user-recovery/index.js";
import { registerPharmacyCommerceRoutes } from "./features/pharmacy-commerce/index.js";
import { registerMedicalPlatformRoutes } from "./features/medical-platform/index.js";
import {
  registerApiRateLimiterHook,
  registerSystemOpsRoutes,
} from "./features/system-ops/index.js";
import { createDbPool } from "./shared/db/pool.js";
import { runMigrations } from "./shared/db/migrate.js";
import { createRedisClient } from "./shared/redis/client.js";
import {
  DEFAULT_DEV_S3_CONFIG,
  ensureS3BucketExists,
  type S3PresignConfig,
} from "./shared/storage/s3-presign.js";

export interface BuildServerOptions {
  databaseUrl: string;
  redisUrl?: string;
  authSecret: string;
  corsOrigins?: readonly string[];
  s3Config?: S3PresignConfig;
  pool?: Pool;
  redis?: Redis;
  runDbMigrations?: boolean;
  seedDemoWorld?: boolean;
  rateLimitMaxPerMinute?: number;
  authRateLimitMaxPerMinute?: number;
  rateLimitKeyPrefix?: string;
  allowPublicRegistration?: boolean;
  requireProviderVerification?: boolean;
  dbPoolMax?: number;
  dbStatementTimeoutMs?: number;
  trustProxy?: boolean;
  enableRequestLogs?: boolean;
}

export async function buildApiServer(
  options: BuildServerOptions,
): Promise<FastifyInstance> {
  const loggerConfig = options.enableRequestLogs
    ? {
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "*.password",
            "*.newPassword",
            "*.code",
            "*.qrToken",
          ],
          remove: true,
        },
      }
    : false;

  const app = Fastify({
    logger: loggerConfig,
    trustProxy: options.trustProxy ?? false,
    requestTimeout: 30_000,
    connectionTimeout: 10_000,
    keepAliveTimeout: 65_000,
    bodyLimit: 1_048_576,
  });

  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    reply.header(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );
    reply.header("Cross-Origin-Opener-Policy", "same-origin");
    reply.header("Cross-Origin-Resource-Policy", "cross-origin");
    if (process.env.NODE_ENV === "production") {
      reply.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const errWithStatus = error as { statusCode?: number; message?: string };
    const statusCode =
      typeof errWithStatus.statusCode === "number" &&
      errWithStatus.statusCode >= 400 &&
      errWithStatus.statusCode < 500
        ? errWithStatus.statusCode
        : 500;

    if (statusCode >= 500) {
      request.log.error({ err: error, reqId: request.id }, "Unhandled API error");
      return reply.status(500).send({ error: "INTERNAL_SERVER_ERROR" });
    }

    return reply.status(statusCode).send({
      error: "REQUEST_REJECTED",
      message: errWithStatus.message ?? "Request could not be processed.",
    });
  });
  const ownsPool = !options.pool;
  const ownsRedis = !options.redis;
  const pool =
    options.pool ??
    createDbPool(options.databaseUrl, {
      ...(options.dbPoolMax !== undefined ? { max: options.dbPoolMax } : {}),
      ...(options.dbStatementTimeoutMs !== undefined
        ? { statementTimeoutMs: options.dbStatementTimeoutMs }
        : {}),
    });
  const redis =
    options.redis ??
    createRedisClient(
      options.redisUrl ?? process.env.REDIS_URL ?? "redis://127.0.0.1:6380",
    );

  if (options.runDbMigrations !== false) {
    await runMigrations(pool);
  }

  const allowedOrigins = options.corsOrigins ?? [];
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"), false);
    },
    credentials: true,
  });

  const s3Config = options.s3Config ?? DEFAULT_DEV_S3_CONFIG;
  await ensureS3BucketExists(s3Config);

  const envRateLimit = Number.parseInt(
    process.env.RATE_LIMIT_MAX_PER_MIN ?? "600",
    10,
  );
  const maxRequestsPerMinute =
    options.rateLimitMaxPerMinute ??
    (Number.isFinite(envRateLimit) && envRateLimit > 0 ? envRateLimit : 600);

  const envAuthRateLimit = Number.parseInt(
    process.env.AUTH_RATE_LIMIT_MAX_PER_MIN ?? "40",
    10,
  );
  const isTestEnv =
    process.env.VITEST === "true" || process.env.NODE_ENV === "test";
  const authMaxRequestsPerMinute =
    options.authRateLimitMaxPerMinute ??
    (options.rateLimitMaxPerMinute !== undefined
      ? options.rateLimitMaxPerMinute
      : isTestEnv
        ? maxRequestsPerMinute
        : Number.isFinite(envAuthRateLimit) && envAuthRateLimit > 0
          ? envAuthRateLimit
          : 40);

  const allowPublicRegistration =
    options.allowPublicRegistration ??
    process.env.ALLOW_PUBLIC_REGISTRATION !== "false";
  const requireProviderVerification =
    options.requireProviderVerification ??
    process.env.REQUIRE_PROVIDER_VERIFICATION === "true";

  const resolvedRateLimitKeyPrefix =
    options.rateLimitKeyPrefix ??
    (isTestEnv
      ? `medisync:ratelimit:test:${crypto.randomBytes(4).toString("hex")}`
      : undefined);

  registerApiRateLimiterHook(app, {
    redis,
    maxRequestsPerMinute,
    authMaxRequestsPerMinute,
    ...(resolvedRateLimitKeyPrefix
      ? { keyPrefix: resolvedRateLimitKeyPrefix }
      : {}),
  });

  await registerFoundationRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
    allowPublicRegistration,
  });
  await registerCountryPackRoutes(app);
  await registerMapsDispatchRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    corsOrigins: allowedOrigins,
    requireProviderVerification,
  });
  await registerBookingRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    requireProviderVerification,
  });
  await registerClinicalRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
    requireProviderVerification,
  });
  await registerMedicalPlatformRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    requireProviderVerification,
  });
  await registerAdminOpsRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
  });
  await registerMediaCertificationRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
  });
  await registerDirectoryRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
  });
  await registerUserRecoveryRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
  });
  await registerPharmacyCommerceRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
  });
  await registerSystemOpsRoutes(app, { pool, redis });

  if (options.seedDemoWorld) {
    await seedRealisticWorld(pool, redis, options.authSecret);
  }

  if (ownsPool || ownsRedis) {
    app.addHook("onClose", async () => {
      if (ownsRedis) {
        await redis.quit().catch(() => undefined);
      }
      if (ownsPool) {
        await pool.end();
      }
    });
  }

  return app;
}
