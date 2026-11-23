import crypto from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import compress from "@fastify/compress";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import {
  registerFoundationRoutes,
  SESSION_COOKIE_NAME,
} from "./features/foundation/index.js";
import { registerCountryPackRoutes } from "./features/country-packs/index.js";
import { registerMapsDispatchRoutes } from "./features/maps-dispatch/index.js";
import { registerBookingRoutes } from "./features/booking/index.js";
import { registerTelehealthRoutes } from "./features/telehealth/index.js";
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
  recordHttpMetric,
  registerApiRateLimiterHook,
  registerSystemOpsRoutes,
} from "./features/system-ops/index.js";
import { createDbPool } from "./shared/db/pool.js";
import { runMigrations } from "./shared/db/migrate.js";
import { readOptionalEnvBool, readOptionalEnvString } from "./shared/env.js";
import { createRedisClient } from "./shared/redis/client.js";
import { closeRedisPubSubHub } from "./shared/redis/pubsub-hub.js";
import {
  DEFAULT_DEV_S3_CONFIG,
  ensureS3BucketCors,
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
  googleClientId?: string;
  googleTokenVerifier?: (idToken: string) => Promise<{
    sub: string;
    email: string | null;
    emailVerified: boolean;
    fullName: string | null;
  } | null>;
  dbPoolMax?: number;
  dbStatementTimeoutMs?: number;
  trustProxy?: boolean;
  enableRequestLogs?: boolean;
  allowSimulatedPayments?: boolean | undefined;
  paymentWebhookSecret?: string | undefined;
  driverOfferTtlMs?: number | undefined;
  s3AutoConfigureCors?: boolean | undefined;
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
    const existingCacheControl = reply.getHeader("cache-control");
    if (
      !existingCacheControl &&
      (request.url.startsWith("/v1/auth") ||
        request.url.startsWith("/v1/users") ||
        request.url.startsWith("/v1/clinical") ||
        request.url.startsWith("/v1/admin") ||
        request.url.startsWith("/v1/billing") ||
        request.url.startsWith("/v1/pharmacy/orders") ||
        request.url.startsWith("/v1/dispatch") ||
        request.url.startsWith("/v1/booking") ||
        request.url.startsWith("/v1/telehealth") ||
        request.url.startsWith("/v1/media") ||
        request.url.startsWith("/v1/facilities"))
    ) {
      reply.header("Cache-Control", "private, no-store");
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    recordHttpMetric(request.method, reply.statusCode, reply.elapsedTime);
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
  await app.register(cookie);
  await app.register(compress, {
    global: true,
    threshold: 1024,
  });

  // CSRF origin guard for HttpOnly cookie-authenticated state-changing requests
  app.addHook("onRequest", async (request, reply) => {
    if (
      request.method === "GET" ||
      request.method === "HEAD" ||
      request.method === "OPTIONS"
    ) {
      return;
    }
    if (request.headers.authorization) {
      return;
    }
    const sessionCookie = request.cookies?.[SESSION_COOKIE_NAME];
    if (!sessionCookie) {
      return;
    }
    const originHeader =
      typeof request.headers.origin === "string"
        ? request.headers.origin
        : undefined;
    const refererHeader =
      typeof request.headers.referer === "string"
        ? request.headers.referer
        : undefined;
    const secFetchSite =
      typeof request.headers["sec-fetch-site"] === "string"
        ? request.headers["sec-fetch-site"].toLowerCase()
        : undefined;
    if (secFetchSite === "cross-site") {
      return reply.status(403).send({
        error: "CSRF_ORIGIN_REJECTED",
        message: "Cross-site state-changing cookie requests are forbidden.",
      });
    }
    let effectiveOrigin = originHeader;
    if (!effectiveOrigin && refererHeader) {
      try {
        effectiveOrigin = new URL(refererHeader).origin;
      } catch {
        effectiveOrigin = undefined;
      }
    }
    if (
      effectiveOrigin &&
      allowedOrigins.length > 0 &&
      !allowedOrigins.includes(effectiveOrigin)
    ) {
      return reply.status(403).send({
        error: "CSRF_ORIGIN_REJECTED",
        message: "Cross-site state-changing cookie requests are forbidden.",
      });
    }
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Requested-With",
      "X-MediSync-Signature",
    ],
    credentials: true,
  });

  const s3Config = options.s3Config ?? DEFAULT_DEV_S3_CONFIG;
  await ensureS3BucketExists(s3Config);
  const autoConfigureS3Cors =
    options.s3AutoConfigureCors ??
    readOptionalEnvBool("S3_AUTO_CONFIGURE_CORS") ??
    false;
  if (autoConfigureS3Cors && allowedOrigins.length > 0) {
    const corsOk = await ensureS3BucketCors(s3Config, allowedOrigins);
    if (!corsOk) {
      app.log.warn(
        { bucket: s3Config.bucket, endpoint: s3Config.endpoint },
        "S3 PutBucketCors did not succeed (MinIO configures CORS via MINIO_API_CORS_ALLOW_ORIGIN; on AWS S3/R2 check s3:PutBucketCORS permission).",
      );
    }
  }

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
    (readOptionalEnvBool("ALLOW_PUBLIC_REGISTRATION") ?? true);
  const requireProviderVerification =
    options.requireProviderVerification ??
    (readOptionalEnvBool("REQUIRE_PROVIDER_VERIFICATION") ?? !isTestEnv);

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

  const resolvedGoogleClientId =
    options.googleClientId ?? readOptionalEnvString("GOOGLE_CLIENT_ID");

  await registerFoundationRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
    allowPublicRegistration,
    requireProviderVerification,
    ...(resolvedGoogleClientId ? { googleClientId: resolvedGoogleClientId } : {}),
    ...(options.googleTokenVerifier
      ? { googleTokenVerifier: options.googleTokenVerifier }
      : {}),
  });
  await registerCountryPackRoutes(app);
  await registerMapsDispatchRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    corsOrigins: allowedOrigins,
    requireProviderVerification,
    ...(options.driverOfferTtlMs !== undefined
      ? { driverOfferTtlMs: options.driverOfferTtlMs }
      : {}),
  });
  await registerBookingRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
    requireProviderVerification,
  });
  await registerTelehealthRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    corsOrigins: allowedOrigins,
    s3Config,
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
    allowSimulatedPayments: options.allowSimulatedPayments,
  });
  await registerAdminOpsRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
    requireProviderVerification,
  });
  await registerMediaCertificationRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
    requireProviderVerification,
  });
  await registerDirectoryRoutes(app, {
    pool,
    redis,
    authSecret: options.authSecret,
    s3Config,
    requireProviderVerification,
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
    requireProviderVerification,
    allowSimulatedPayments: options.allowSimulatedPayments,
    paymentWebhookSecret: options.paymentWebhookSecret,
  });
  await registerSystemOpsRoutes(app, { pool, redis });

  if (options.seedDemoWorld) {
    await seedRealisticWorld(pool, redis, options.authSecret);
  }

  // Drain hijacked SSE streams before Fastify's server.close() waits on open sockets.
  app.addHook("preClose", async () => {
    await closeRedisPubSubHub(redis).catch(() => undefined);
    app.server.closeIdleConnections?.();
  });

  app.addHook("onClose", async () => {
    await closeRedisPubSubHub(redis).catch(() => undefined);
    if (ownsRedis) {
      await redis.quit().catch(() => undefined);
    }
    if (ownsPool) {
      await pool.end();
    }
  });

  return app;
}
