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
  rateLimitKeyPrefix?: string;
}

export async function buildApiServer(
  options: BuildServerOptions,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    bodyLimit: 1_048_576,
  });

  app.addHook("onSend", async (_request, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  });

  app.setErrorHandler((error, _request, reply) => {
    const errWithStatus = error as { statusCode?: number; message?: string };
    const statusCode =
      typeof errWithStatus.statusCode === "number" &&
      errWithStatus.statusCode >= 400 &&
      errWithStatus.statusCode < 500
        ? errWithStatus.statusCode
        : 500;

    if (statusCode >= 500) {
      return reply.status(500).send({ error: "INTERNAL_SERVER_ERROR" });
    }

    return reply.status(statusCode).send({
      error: "REQUEST_REJECTED",
      message: errWithStatus.message ?? "Request could not be processed.",
    });
  });
  const ownsPool = !options.pool;
  const ownsRedis = !options.redis;
  const pool = options.pool ?? createDbPool(options.databaseUrl);
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

  registerApiRateLimiterHook(app, {
    redis,
    maxRequestsPerMinute,
    ...(options.rateLimitKeyPrefix
      ? { keyPrefix: options.rateLimitKeyPrefix }
      : {}),
  });

  await registerFoundationRoutes(app, {
    pool,
    authSecret: options.authSecret,
    s3Config,
  });
  await registerCountryPackRoutes(app);
  await registerMapsDispatchRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    corsOrigins: allowedOrigins,
  });
  await registerBookingRoutes(app, {
    pool,
    authSecret: options.authSecret,
  });
  await registerClinicalRoutes(app, {
    pool,
    authSecret: options.authSecret,
    s3Config,
  });
  await registerAdminOpsRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
  });
  await registerMediaCertificationRoutes(app, {
    pool,
    authSecret: options.authSecret,
    s3Config,
  });
  await registerDirectoryRoutes(app, {
    pool,
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
