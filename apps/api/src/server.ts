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
}

export async function buildApiServer(
  options: BuildServerOptions,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
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
