import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import {
  MobileTelemetryHeartbeatSchema,
  PlatformMetricsResponseSchema,
  type PlatformMetricsResponse,
} from "@medisync/contracts";

interface MetricsCountsRow {
  users_count: number;
  verified_facilities_count: number;
  active_dispatches_count: number;
  pharmacy_orders_count: number;
  clinical_media_count: number;
}

const httpMetrics = {
  totalRequests: 0,
  errorRequests: 0,
  totalDurationMs: 0,
  byMethodStatus: new Map<string, number>(),
};

export function recordHttpMetric(
  method: string,
  statusCode: number,
  durationMs: number,
): void {
  httpMetrics.totalRequests += 1;
  if (statusCode >= 500) {
    httpMetrics.errorRequests += 1;
  }
  httpMetrics.totalDurationMs += Number.isFinite(durationMs) ? durationMs : 0;
  const bucket = `${method.toUpperCase()}_${Math.floor(statusCode / 100)}xx`;
  httpMetrics.byMethodStatus.set(bucket, (httpMetrics.byMethodStatus.get(bucket) ?? 0) + 1);
  if (httpMetrics.byMethodStatus.size > 64) {
    const first = httpMetrics.byMethodStatus.keys().next().value;
    if (first) httpMetrics.byMethodStatus.delete(first);
  }
}

const METRICS_COUNTS_CACHE_KEY = "medisync:metrics:counts:v1";

async function loadCachedMetricsCounts(
  pool: Pool,
  redis: Redis,
): Promise<{ counts: MetricsCountsRow; pgOk: boolean }> {
  try {
    const cached = await redis.get(METRICS_COUNTS_CACHE_KEY);
    if (cached) {
      return { counts: JSON.parse(cached) as MetricsCountsRow, pgOk: true };
    }
  } catch {
    // Fall through to PostgreSQL
  }

  try {
    const result = await pool.query<MetricsCountsRow>(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users_count,
        (SELECT COUNT(*)::int FROM facilities WHERE verification_status = 'VERIFIED') AS verified_facilities_count,
        (SELECT COUNT(*)::int FROM dispatch_requests WHERE status IN ('REQUESTED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED')) AS active_dispatches_count,
        (SELECT COUNT(*)::int FROM pharmacy_orders) AS pharmacy_orders_count,
        (SELECT COUNT(*)::int FROM clinical_media_objects) AS clinical_media_count
    `);
    const counts = result.rows[0] ?? {
      users_count: 0,
      verified_facilities_count: 0,
      active_dispatches_count: 0,
      pharmacy_orders_count: 0,
      clinical_media_count: 0,
    };
    await redis
      .set(METRICS_COUNTS_CACHE_KEY, JSON.stringify(counts), "EX", 10)
      .catch(() => undefined);
    return { counts, pgOk: true };
  } catch {
    return {
      counts: {
        users_count: 0,
        verified_facilities_count: 0,
        active_dispatches_count: 0,
        pharmacy_orders_count: 0,
        clinical_media_count: 0,
      },
      pgOk: false,
    };
  }
}

export async function registerSystemOpsRoutes(
  app: FastifyInstance,
  deps: { pool: Pool; redis: Redis },
): Promise<void> {
  app.get("/v1/metrics", async (_request, reply) => {
    const pgStart = performance.now();
    const { counts, pgOk } = await loadCachedMetricsCounts(deps.pool, deps.redis);
    const pgStatus: "OK" | "DEGRADED" = pgOk ? "OK" : "DEGRADED";
    const pgLatencyMs = Number((performance.now() - pgStart).toFixed(2));

    const redisStart = performance.now();
    let redisStatus: "OK" | "DEGRADED" = "OK";
    try {
      const pong = await deps.redis.ping();
      if (pong !== "PONG") {
        redisStatus = "DEGRADED";
      }
    } catch {
      redisStatus = "DEGRADED";
    }
    const redisLatencyMs = Number((performance.now() - redisStart).toFixed(2));

    const payload: PlatformMetricsResponse = PlatformMetricsResponseSchema.parse({
      service: "medisync-api",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      dependencies: {
        postgres: { status: pgStatus, latencyMs: pgLatencyMs },
        redis: { status: redisStatus, latencyMs: redisLatencyMs },
      },
      counts: {
        users: counts.users_count,
        verifiedFacilities: counts.verified_facilities_count,
        activeDispatches: counts.active_dispatches_count,
        pharmacyOrders: counts.pharmacy_orders_count,
        clinicalMediaObjects: counts.clinical_media_count,
      },
    });

    const httpStatus = pgStatus === "OK" && redisStatus === "OK" ? 200 : 503;
    return reply.status(httpStatus).send(payload);
  });

  app.post("/v1/telemetry/mobile", async (request, reply) => {
    const parsed = MobileTelemetryHeartbeatSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_PAYLOAD",
        issues: parsed.error.issues,
      });
    }

    const receivedAt = new Date().toISOString();
    try {
      await deps.redis.set(
        `medisync:telemetry:mobile:${parsed.data.platform}:${parsed.data.countryCode}`,
        JSON.stringify({ ...parsed.data, receivedAt }),
        "EX",
        86400,
      );
    } catch {
      // Telemetry storage failure is non-fatal.
    }

    return reply.status(202).send({
      accepted: true,
      receivedAt,
    });
  });

  app.get("/metrics", async (_request, reply) => {
    const { counts, pgOk } = await loadCachedMetricsCounts(deps.pool, deps.redis);
    const pgUp = pgOk ? 1 : 0;
    let redisUp = 1;

    try {
      if ((await deps.redis.ping()) !== "PONG") redisUp = 0;
    } catch {
      redisUp = 0;
    }

    const avgMs =
      httpMetrics.totalRequests > 0
        ? (httpMetrics.totalDurationMs / httpMetrics.totalRequests).toFixed(2)
        : "0";

    const lines = [
      "# HELP medisync_dependency_up Dependency health status (1=up, 0=down)",
      "# TYPE medisync_dependency_up gauge",
      `medisync_dependency_up{dependency="postgres"} ${pgUp}`,
      `medisync_dependency_up{dependency="redis"} ${redisUp}`,
      "# HELP medisync_process_uptime_seconds API process uptime in seconds",
      "# TYPE medisync_process_uptime_seconds gauge",
      `medisync_process_uptime_seconds ${process.uptime().toFixed(2)}`,
      "# HELP medisync_http_requests_total Total HTTP requests handled since start",
      "# TYPE medisync_http_requests_total counter",
      `medisync_http_requests_total ${httpMetrics.totalRequests}`,
      "# HELP medisync_http_5xx_total Total 5xx responses",
      "# TYPE medisync_http_5xx_total counter",
      `medisync_http_5xx_total ${httpMetrics.errorRequests}`,
      "# HELP medisync_http_request_duration_ms_avg Mean HTTP response latency (ms)",
      "# TYPE medisync_http_request_duration_ms_avg gauge",
      `medisync_http_request_duration_ms_avg ${avgMs}`,
      "# HELP medisync_entities_total Core database entity totals",
      "# TYPE medisync_entities_total gauge",
      `medisync_entities_total{entity="users"} ${counts.users_count}`,
      `medisync_entities_total{entity="verified_facilities"} ${counts.verified_facilities_count}`,
      `medisync_entities_total{entity="active_dispatches"} ${counts.active_dispatches_count}`,
      `medisync_entities_total{entity="pharmacy_orders"} ${counts.pharmacy_orders_count}`,
      `medisync_entities_total{entity="clinical_media"} ${counts.clinical_media_count}`,
    ];

    for (const [bucket, count] of httpMetrics.byMethodStatus.entries()) {
      lines.push(`medisync_http_requests_bucket{bucket="${bucket}"} ${count}`);
    }

    reply.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    reply.header("Cache-Control", "no-store");
    return reply.status(200).send(`${lines.join("\n")}\n`);
  });
}
