import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { PlatformMetricsResponseSchema } from "@medisync/contracts";
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

describe("api slice 9 system-ops: health metrics, mobile telemetry & Redis rate limiter", () => {
  let pool: Pool;
  let redis: Redis;
  let app: FastifyInstance;
  const keyPrefix = `medisync:test:ratelimit:${crypto.randomBytes(4).toString("hex")}`;

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
      pool,
      redis,
      runDbMigrations: false,
      rateLimitMaxPerMinute: 4,
      rateLimitKeyPrefix: keyPrefix,
    });
  });

  afterAll(async () => {
    const keys = await redis.keys(`${keyPrefix}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await app.close();
    await redis.quit();
    await pool.end();
  });

  it("exposes live database & Redis metrics and validates mobile telemetry heartbeats", async () => {
    const metricsRes = await app.inject({
      method: "GET",
      url: "/v1/metrics",
    });
    expect(metricsRes.statusCode).toBe(200);
    expect(metricsRes.headers["x-ratelimit-limit"]).toBe("4");
    expect(metricsRes.headers["x-ratelimit-remaining"]).toBe("3");

    const parsed = PlatformMetricsResponseSchema.parse(metricsRes.json());
    expect(parsed.service).toBe("medisync-api");
    expect(parsed.dependencies.postgres.status).toBe("OK");
    expect(parsed.dependencies.redis.status).toBe("OK");
    expect(parsed.counts.users).toBeGreaterThanOrEqual(0);

    const invalidTelemetry = await app.inject({
      method: "POST",
      url: "/v1/telemetry/mobile",
      payload: { platform: "blackberry" },
    });
    expect(invalidTelemetry.statusCode).toBe(400);

    const validTelemetry = await app.inject({
      method: "POST",
      url: "/v1/telemetry/mobile",
      payload: {
        platform: "ios",
        appVersion: "2.0.0",
        countryCode: "MA",
        capabilities: {
          cameraQr: true,
          backgroundLocation: true,
          binaryMediaPicker: true,
        },
      },
    });
    expect(validTelemetry.statusCode).toBe(202);
    expect(validTelemetry.json()).toMatchObject({ accepted: true });
  });

  it("enforces Redis IP rate limit (429) on /v1/* while keeping /health exempt", async () => {
    // Prior test made 3 /v1/* calls against a limit of 4; 4th call succeeds, 5th hits 429.
    const fourth = await app.inject({
      method: "GET",
      url: "/v1/metrics",
    });
    expect(fourth.statusCode).toBe(200);
    expect(fourth.headers["x-ratelimit-remaining"]).toBe("0");

    const fifth = await app.inject({
      method: "GET",
      url: "/v1/metrics",
    });
    expect(fifth.statusCode).toBe(429);
    expect(fifth.json()).toMatchObject({
      error: "RATE_LIMIT_EXCEEDED",
    });

    const health = await app.inject({
      method: "GET",
      url: "/health",
    });
    expect(health.statusCode).toBe(200);
  });
});
