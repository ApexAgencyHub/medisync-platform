import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import type {
  AuthResponse,
  DispatchRequestSummary,
  FacilitySummary,
  FacilityViewportResponse,
  NearbyDriversResponse,
} from "@medisync/contracts";
import { buildApiServer } from "../../server.js";
import { createDbPool } from "../../shared/db/pool.js";
import { runMigrations } from "../../shared/db/migrate.js";
import { createRedisClient } from "../../shared/redis/client.js";
import { hashPassword } from "../foundation/index.js";

const DEFAULT_TEST_DB_URL =
  "postgresql://medisync:medisync_dev_password@127.0.0.1:5433/medisync";
const DEFAULT_TEST_REDIS_URL = "redis://127.0.0.1:6380";
const TEST_AUTH_SECRET =
  process.env.AUTH_SECRET ??
  "medisync-ci-ephemeral-test-secret-minimum-32-chars";

async function readSseUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  predicate: (collected: string) => boolean,
  timeoutMs = 5000,
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remaining = Math.max(50, deadline - Date.now());
    const result = await Promise.race([
      reader.read(),
      new Promise<{ timeout: true }>((resolve) =>
        setTimeout(() => resolve({ timeout: true }), remaining),
      ),
    ]);

    if ("timeout" in result) {
      break;
    }
    if (result.done) {
      break;
    }
    buffer += decoder.decode(result.value, { stream: true });
    if (predicate(buffer)) {
      return buffer;
    }
  }

  return buffer;
}

describe("api slice 2 maps-dispatch: PostGIS viewport, Redis Geo drivers & SSE stream", () => {
  let pool: Pool;
  let redis: Redis;
  let app: FastifyInstance;
  let baseUrl: string;

  const runSuffix = crypto.randomBytes(4).toString("hex");
  const licenseBase = Math.floor(200000 + crypto.randomInt(0, 700000));
  const createdUserIds: string[] = [];
  const createdFacilityIds: string[] = [];
  const createdDispatchIds: string[] = [];
  const cleanupRedisDriverIds: Array<{ countryCode: string; driverId: string }> =
    [];

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
      corsOrigins: ["http://localhost:3000"],
      pool,
      redis,
      runDbMigrations: true,
    });
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    baseUrl = address;
  });

  afterAll(async () => {
    for (const entry of cleanupRedisDriverIds) {
      await redis.zrem(
        `medisync:geo:drivers:${entry.countryCode}`,
        entry.driverId,
      );
      await redis.del(
        `medisync:driver:state:${entry.countryCode}:${entry.driverId}`,
      );
    }

    if (createdDispatchIds.length > 0) {
      await pool.query(
        "DELETE FROM dispatch_requests WHERE id = ANY($1::uuid[])",
        [createdDispatchIds],
      );
    }
    if (createdUserIds.length > 0 || createdFacilityIds.length > 0) {
      await pool.query(
        `DELETE FROM audit_logs
         WHERE actor_id = ANY($1::uuid[])
            OR resource_id = ANY($2::text[])`,
        [createdUserIds, [...createdFacilityIds, ...createdDispatchIds]],
      );
    }
    if (createdFacilityIds.length > 0) {
      await pool.query("DELETE FROM facilities WHERE id = ANY($1::uuid[])", [
        createdFacilityIds,
      ]);
    }
    if (createdUserIds.length > 0) {
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
        createdUserIds,
      ]);
    }

    await app.close();
    await redis.quit();
    await pool.end();
  });

  it("queries PostGIS verified viewport facilities in < 50ms with openNow & kind filtering", async () => {
    const password = "StrongPassword!123";
    const hospAdminRes = await app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: `hosp-${runSuffix}@medisync.test`,
        password,
        fullName: "Dr. Samira Bennani",
        role: "HOSPITAL_ADMIN",
        countryCode: "MA",
      },
    });
    expect(hospAdminRes.statusCode).toBe(201);
    const hospAuth = hospAdminRes.json<AuthResponse>();
    createdUserIds.push(hospAuth.user.id);

    // Seed OPS_ADMIN directly
    const opsHash = await hashPassword(password);
    const opsEmail = `ops-map-${runSuffix}@medisync.test`;
    const opsRow = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, country_code)
       VALUES ($1, $2, 'Map Ops Admin', 'OPS_ADMIN', 'INTL')
       RETURNING id`,
      [opsEmail, opsHash],
    );
    createdUserIds.push(opsRow.rows[0]!.id);
    const opsLogin = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: opsEmail, password },
    });
    const opsToken = opsLogin.json<AuthResponse>().token;

    // 1. Casablanca verified hospital (inside bbox)
    const facVerifiedRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${hospAuth.token}` },
      payload: {
        name: "CHU Ibn Rochd Casablanca",
        kind: "HOSPITAL",
        countryCode: "MA",
        licenseNumber: `MA-HOSP-${licenseBase}`,
        lat: 33.5731,
        lng: -7.5898,
        address: "Rue des Hopitaux, Casablanca",
      },
    });
    expect(facVerifiedRes.statusCode).toBe(201);
    const facVerified =
      facVerifiedRes.json<{ facility: FacilitySummary }>().facility;
    createdFacilityIds.push(facVerified.id);

    await app.inject({
      method: "PATCH",
      url: `/v1/admin/facilities/${facVerified.id}/verify`,
      headers: { authorization: `Bearer ${opsToken}` },
      payload: { status: "VERIFIED" },
    });

    // 2. Casablanca unverified clinic (should NEVER leak into public viewport)
    const facPendingRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${hospAuth.token}` },
      payload: {
        name: "Unverified Casablanca Clinic",
        kind: "CLINIC",
        countryCode: "MA",
        licenseNumber: `MA-CLIN-${licenseBase + 1}`,
        lat: 33.575,
        lng: -7.59,
        address: "Anfa, Casablanca",
      },
    });
    const facPending =
      facPendingRes.json<{ facility: FacilitySummary }>().facility;
    createdFacilityIds.push(facPending.id);

    // 3. Marrakech verified hospital (outside Casablanca bbox)
    const facFarRes = await app.inject({
      method: "POST",
      url: "/v1/facilities",
      headers: { authorization: `Bearer ${hospAuth.token}` },
      payload: {
        name: "CHU Mohammed VI Marrakech",
        kind: "HOSPITAL",
        countryCode: "MA",
        licenseNumber: `MA-HOSP-${licenseBase + 2}`,
        lat: 31.648,
        lng: -7.997,
        address: "Gueliz, Marrakech",
      },
    });
    const facFar = facFarRes.json<{ facility: FacilitySummary }>().facility;
    createdFacilityIds.push(facFar.id);
    await app.inject({
      method: "PATCH",
      url: `/v1/admin/facilities/${facFar.id}/verify`,
      headers: { authorization: `Bearer ${opsToken}` },
      payload: { status: "VERIFIED" },
    });

    // Viewport query on Casablanca returns ONLY CHU Ibn Rochd in < 50ms
    const vpRes = await app.inject({
      method: "GET",
      url: "/v1/maps/facilities/viewport?countryCode=MA&minLng=-7.70&minLat=33.48&maxLng=-7.48&maxLat=33.66&kind=HOSPITAL",
    });
    expect(vpRes.statusCode).toBe(200);
    const vpBody = vpRes.json<FacilityViewportResponse>();
    expect(vpBody.queryMs).toBeLessThan(50);
    expect(vpBody.facilities.some((f) => f.id === facVerified.id)).toBe(true);
    expect(vpBody.facilities.some((f) => f.id === facPending.id)).toBe(false);
    expect(vpBody.facilities.some((f) => f.id === facFar.id)).toBe(false);

    // Toggle operational status -> CLOSED hides when openNow=true
    const statusPatch = await app.inject({
      method: "PATCH",
      url: `/v1/maps/facilities/${facVerified.id}/operational-status`,
      headers: { authorization: `Bearer ${hospAuth.token}` },
      payload: { openStatus: "CLOSED", acceptsEmergency: true },
    });
    expect(statusPatch.statusCode).toBe(200);

    const openOnlyRes = await app.inject({
      method: "GET",
      url: "/v1/maps/facilities/viewport?countryCode=MA&minLng=-7.70&minLat=33.48&maxLng=-7.48&maxLat=33.66&openNow=true",
    });
    expect(openOnlyRes.statusCode).toBe(200);
    expect(
      openOnlyRes
        .json<FacilityViewportResponse>()
        .facilities.some((f) => f.id === facVerified.id),
    ).toBe(false);
  });

  it("streams live Redis Geo driver pings over SSE and protects concurrent dispatch claims", async () => {
    const password = "StrongPassword!123";

    const registerActor = async (
      prefix: string,
      role: "PATIENT" | "DRIVER",
      countryCode: string,
    ): Promise<AuthResponse> => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          email: `${prefix}-${runSuffix}@medisync.test`,
          password,
          fullName: `Actor ${prefix}`,
          role,
          countryCode,
        },
      });
      expect(res.statusCode).toBe(201);
      const auth = res.json<AuthResponse>();
      createdUserIds.push(auth.user.id);
      if (role === "DRIVER") {
        cleanupRedisDriverIds.push({
          countryCode,
          driverId: auth.user.id,
        });
      }
      return auth;
    };

    const patientMa = await registerActor("pat-sse", "PATIENT", "MA");
    const driverNear = await registerActor("drv-near", "DRIVER", "MA");
    const driverFar = await registerActor("drv-far", "DRIVER", "MA");
    const driverFr = await registerActor("drv-fr", "DRIVER", "FR");

    // Non-driver cannot transmit GPS pings
    const forbiddenPing = await app.inject({
      method: "POST",
      url: "/v1/dispatch/drivers/ping",
      headers: { authorization: `Bearer ${patientMa.token}` },
      payload: { lat: 33.5731, lng: -7.5898, status: "AVAILABLE" },
    });
    expect(forbiddenPing.statusCode).toBe(403);

    // Open real SSE connection with CORS origin check before pinging
    const abortController = new AbortController();
    const sseRes = await fetch(
      `${baseUrl}/v1/dispatch/stream?token=${encodeURIComponent(patientMa.token)}`,
      {
        headers: { origin: "http://localhost:3000" },
        signal: abortController.signal,
      },
    );
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get("content-type")).toContain("text/event-stream");
    expect(sseRes.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );

    const reader = sseRes.body!.getReader();
    const snapshotText = await readSseUntil(reader, (txt) =>
      txt.includes("event: snapshot"),
    );
    expect(snapshotText).toContain("event: snapshot");

    // French driver pings Paris -> must NOT appear in MA nearby query or MA SSE stream
    await app.inject({
      method: "POST",
      url: "/v1/dispatch/drivers/ping",
      headers: { authorization: `Bearer ${driverFr.token}` },
      payload: { lat: 48.8566, lng: 2.3522, status: "AVAILABLE" },
    });

    // Two MA drivers ping Casablanca (~0.8km vs ~4km from patient center 33.5731, -7.5898)
    await app.inject({
      method: "POST",
      url: "/v1/dispatch/drivers/ping",
      headers: { authorization: `Bearer ${driverFar.token}` },
      payload: { lat: 33.605, lng: -7.55, headingDeg: 90, status: "AVAILABLE" },
    });
    await app.inject({
      method: "POST",
      url: "/v1/dispatch/drivers/ping",
      headers: { authorization: `Bearer ${driverNear.token}` },
      payload: {
        lat: 33.578,
        lng: -7.592,
        headingDeg: 180,
        status: "AVAILABLE",
      },
    });

    // Confirm real-time SSE delivered driver.location event
    const sseUpdateText = await readSseUntil(
      reader,
      (txt) =>
        txt.includes("event: driver.location") && txt.includes(driverNear.user.id),
    );
    expect(sseUpdateText).toContain(driverNear.user.id);
    expect(sseUpdateText).not.toContain(driverFr.user.id);

    abortController.abort();
    await reader.cancel().catch(() => undefined);

    // Nearby drivers sorted ascending by distanceKm + strict country isolation
    const crossCountryNearby = await app.inject({
      method: "GET",
      url: "/v1/dispatch/drivers/nearby?countryCode=FR&lat=48.8566&lng=2.3522",
      headers: { authorization: `Bearer ${patientMa.token}` },
    });
    expect(crossCountryNearby.statusCode).toBe(403);

    const nearbyRes = await app.inject({
      method: "GET",
      url: "/v1/dispatch/drivers/nearby?lat=33.5731&lng=-7.5898&radiusKm=20",
      headers: { authorization: `Bearer ${patientMa.token}` },
    });
    expect(nearbyRes.statusCode).toBe(200);
    const nearby = nearbyRes.json<NearbyDriversResponse>();
    expect(nearby.drivers.length).toBe(2);
    expect(nearby.drivers[0]!.driverId).toBe(driverNear.user.id);
    expect(nearby.drivers[1]!.driverId).toBe(driverFar.user.id);
    expect(nearby.drivers[0]!.distanceKm).toBeLessThan(
      nearby.drivers[1]!.distanceKm,
    );

    // OFF_DUTY immediately evicts driver from Redis Geo index
    await app.inject({
      method: "POST",
      url: "/v1/dispatch/drivers/ping",
      headers: { authorization: `Bearer ${driverFar.token}` },
      payload: { lat: 33.605, lng: -7.55, status: "OFF_DUTY" },
    });
    const afterOffDuty = await app.inject({
      method: "GET",
      url: "/v1/dispatch/drivers/nearby?lat=33.5731&lng=-7.5898&radiusKm=20",
      headers: { authorization: `Bearer ${patientMa.token}` },
    });
    expect(
      afterOffDuty
        .json<NearbyDriversResponse>()
        .drivers.some((d) => d.driverId === driverFar.user.id),
    ).toBe(false);

    // Dispatch creation + concurrent double-claim race protection
    const dispatchCreate = await app.inject({
      method: "POST",
      url: "/v1/dispatch/requests",
      headers: { authorization: `Bearer ${patientMa.token}` },
      payload: {
        pickupLat: 33.5731,
        pickupLng: -7.5898,
        pickupAddress: "145 Boulevard d'Anfa, Casablanca",
        urgency: "EMERGENCY",
        notes: "Chest pain rapid transport",
      },
    });
    expect(dispatchCreate.statusCode).toBe(201);
    const { dispatch } = dispatchCreate.json<{
      dispatch: DispatchRequestSummary;
    }>();
    createdDispatchIds.push(dispatch.id);

    const [claimA, claimB] = await Promise.all([
      app.inject({
        method: "PATCH",
        url: `/v1/dispatch/requests/${dispatch.id}/status`,
        headers: { authorization: `Bearer ${driverNear.token}` },
        payload: { status: "ASSIGNED" },
      }),
      app.inject({
        method: "PATCH",
        url: `/v1/dispatch/requests/${dispatch.id}/status`,
        headers: { authorization: `Bearer ${driverFar.token}` },
        payload: { status: "ASSIGNED" },
      }),
    ]);

    const statuses = [claimA.statusCode, claimB.statusCode].sort();
    expect(statuses).toEqual([200, 409]);

    const winningToken =
      claimA.statusCode === 200 ? driverNear.token : driverFar.token;

    const enRoute = await app.inject({
      method: "PATCH",
      url: `/v1/dispatch/requests/${dispatch.id}/status`,
      headers: { authorization: `Bearer ${winningToken}` },
      payload: { status: "EN_ROUTE" },
    });
    expect(enRoute.statusCode).toBe(200);
    expect(
      enRoute.json<{ dispatch: DispatchRequestSummary }>().dispatch.status,
    ).toBe("EN_ROUTE");
  });
});
