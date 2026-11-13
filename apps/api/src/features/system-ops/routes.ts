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

export async function registerSystemOpsRoutes(
  app: FastifyInstance,
  deps: { pool: Pool; redis: Redis },
): Promise<void> {
  app.get("/v1/metrics", async (_request, reply) => {
    const pgStart = performance.now();
    let pgStatus: "OK" | "DEGRADED" = "OK";
    let counts: MetricsCountsRow = {
      users_count: 0,
      verified_facilities_count: 0,
      active_dispatches_count: 0,
      pharmacy_orders_count: 0,
      clinical_media_count: 0,
    };

    try {
      const result = await deps.pool.query<MetricsCountsRow>(`
        SELECT
          (SELECT COUNT(*)::int FROM users) AS users_count,
          (SELECT COUNT(*)::int FROM facilities WHERE verification_status = 'VERIFIED') AS verified_facilities_count,
          (SELECT COUNT(*)::int FROM dispatch_requests WHERE status IN ('REQUESTED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED')) AS active_dispatches_count,
          (SELECT COUNT(*)::int FROM pharmacy_orders) AS pharmacy_orders_count,
          (SELECT COUNT(*)::int FROM clinical_media_objects) AS clinical_media_count
      `);
      if (result.rows[0]) {
        counts = result.rows[0];
      }
    } catch {
      pgStatus = "DEGRADED";
    }
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
}
