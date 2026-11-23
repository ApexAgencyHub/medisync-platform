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
        `medisync:driver:off_duty:${entry.driverId}`,
        `medisync:dispatch:declined:${entry.driverId}`,
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

    // Two MA drivers ping Ouarzazate (~0.5km vs ~4.9km from patient center 30.9335, -6.9370, isolated from all 6 seeded metro hubs)
    await app.inject({
      method: "POST",
      url: "/v1/dispatch/drivers/ping",
      headers: { authorization: `Bearer ${driverFar.token}` },
      payload: { lat: 30.966, lng: -6.901, headingDeg: 90, status: "AVAILABLE" },
    });
    await app.inject({
      method: "POST",
      url: "/v1/dispatch/drivers/ping",
      headers: { authorization: `Bearer ${driverNear.token}` },
      payload: {
        lat: 30.938,
        lng: -6.939,
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
      url: "/v1/dispatch/drivers/nearby?lat=30.9335&lng=-6.937&radiusKm=20",
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
      payload: { lat: 30.966, lng: -6.901, status: "OFF_DUTY" },
    });
    const afterOffDuty = await app.inject({
      method: "GET",
      url: "/v1/dispatch/drivers/nearby?lat=30.9335&lng=-6.937&radiusKm=20",
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
        pickupLat: 31.6295,
        pickupLng: -7.9811,
        pickupAddress: "Gueliz Avenue Mohammed V, Marrakech",
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

    // Rapid accidental double-tap on identical pickup deduplicates to the same dispatch id
    const [dupA, dupB] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/v1/dispatch/requests",
        headers: { authorization: `Bearer ${patientMa.token}` },
        payload: {
          pickupLat: 31.6305,
          pickupLng: -7.9821,
          pickupAddress: "Gueliz Duplicate Guard Intersection",
          urgency: "URGENT",
        },
      }),
      app.inject({
        method: "POST",
        url: "/v1/dispatch/requests",
        headers: { authorization: `Bearer ${patientMa.token}` },
        payload: {
          pickupLat: 31.6305,
          pickupLng: -7.9821,
          pickupAddress: "Gueliz Duplicate Guard Intersection",
          urgency: "URGENT",
        },
      }),
    ]);
    expect(dupA.statusCode).toBe(201);
    expect(dupB.statusCode).toBe(201);
    const secondDispatch = dupA.json<{ dispatch: DispatchRequestSummary }>().dispatch;
    createdDispatchIds.push(secondDispatch.id);
    expect(dupB.json<{ dispatch: DispatchRequestSummary }>().dispatch.id).toBe(
      secondDispatch.id,
    );

    // Already-active winning driver cannot claim a second simultaneous ride
    const busyDriverSecondClaim = await app.inject({
      method: "PATCH",
      url: `/v1/dispatch/requests/${secondDispatch.id}/status`,
      headers: { authorization: `Bearer ${winningToken}` },
      payload: { status: "ASSIGNED" },
    });
    expect(busyDriverSecondClaim.statusCode).toBe(409);

    // Losing driver refuses secondDispatch: hidden from their queue while still REQUESTED for others
    const refusingToken =
      claimA.statusCode === 409 ? driverNear.token : driverFar.token;
    const declineRes = await app.inject({
      method: "POST",
      url: `/v1/dispatch/requests/${secondDispatch.id}/decline`,
      headers: { authorization: `Bearer ${refusingToken}` },
      payload: { reason: "Outside immediate shift coverage" },
    });
    expect(declineRes.statusCode).toBe(200);
    expect(declineRes.json()).toMatchObject({
      declined: true,
      dispatchId: secondDispatch.id,
      releasedToQueue: false,
    });

    const refusingFeed = await app.inject({
      method: "GET",
      url: "/v1/dispatch/requests?countryCode=MA",
      headers: { authorization: `Bearer ${refusingToken}` },
    });
    expect(refusingFeed.statusCode).toBe(200);
    const refusingIds = refusingFeed
      .json<{ dispatches: DispatchRequestSummary[] }>()
      .dispatches.map((item) => item.id);
    expect(refusingIds).not.toContain(secondDispatch.id);

    // Patient still sees secondDispatch as REQUESTED (decline did not cancel the broadcast)
    const patientFeed = await app.inject({
      method: "GET",
      url: "/v1/dispatch/requests?countryCode=MA",
      headers: { authorization: `Bearer ${patientMa.token}` },
    });
    expect(patientFeed.statusCode).toBe(200);
    const stillRequested = patientFeed
      .json<{ dispatches: DispatchRequestSummary[] }>()
      .dispatches.find((item) => item.id === secondDispatch.id);
    expect(stillRequested?.status).toBe("REQUESTED");
  });

  it("enforces live driver offer window: pushes offerExpiresAtIso over SSE, never resets on reload, and auto-refuses on timeout while keeping demand open for another driver", async () => {
    const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL;
    const redisUrl = process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL;
    const shortTtlMs = 450;
    const timedApp = await buildApiServer({
      databaseUrl,
      redisUrl,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://localhost:3000"],
      pool,
      redis,
      runDbMigrations: false,
      driverOfferTtlMs: shortTtlMs,
    });
    const timedBaseUrl = await timedApp.listen({ port: 0, host: "127.0.0.1" });

    const password = "StrongPassword!123";
    const localDriverIds: string[] = [];

    try {
      const register = async (prefix: string, role: "PATIENT" | "DRIVER") => {
        const res = await timedApp.inject({
          method: "POST",
          url: "/v1/auth/register",
          payload: {
            email: `${prefix}-ttl-${runSuffix}@medisync.test`,
            password,
            fullName: `Actor ${prefix}`,
            role,
            countryCode: "MA",
          },
        });
        expect(res.statusCode).toBe(201);
        const auth = res.json<AuthResponse>();
        createdUserIds.push(auth.user.id);
        if (role === "DRIVER") {
          localDriverIds.push(auth.user.id);
        }
        return auth;
      };

      const patient = await register("pat-offer", "PATIENT");
      const slowDriver = await register("drv-slow", "DRIVER");
      const fastDriver = await register("drv-fast", "DRIVER");

      // Open live SSE stream for slowDriver before patient creates demand
      const abortController = new AbortController();
      const sseRes = await fetch(
        `${timedBaseUrl}/v1/dispatch/stream?token=${encodeURIComponent(slowDriver.token)}`,
        {
          headers: { origin: "http://localhost:3000" },
          signal: abortController.signal,
        },
      );
      expect(sseRes.status).toBe(200);
      const reader = sseRes.body!.getReader();
      const snapshot = await readSseUntil(reader, (txt) =>
        txt.includes("event: snapshot"),
      );
      expect(snapshot).toContain("event: snapshot");

      // Patient creates a live dispatch demand
      const createRes = await timedApp.inject({
        method: "POST",
        url: "/v1/dispatch/requests",
        headers: { authorization: `Bearer ${patient.token}` },
        payload: {
          pickupLat: 33.584,
          pickupLng: -7.624,
          pickupAddress: "Anfa Live Timeout Test Corner",
          urgency: "URGENT",
        },
      });
      expect(createRes.statusCode).toBe(201);
      const liveDispatch = createRes.json<{ dispatch: DispatchRequestSummary }>()
        .dispatch;
      createdDispatchIds.push(liveDispatch.id);

      // slowDriver receives live SSE dispatch.updated with offerExpiresAtIso
      const sseOfferText = await readSseUntil(
        reader,
        (txt) =>
          txt.includes("event: dispatch.updated") &&
          txt.includes(liveDispatch.id),
      );
      expect(sseOfferText).toContain("offerExpiresAtIso");

      // Reloading GET /v1/dispatch/requests before timeout preserves the exact same offerExpiresAtIso
      const firstList = await timedApp.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=MA",
        headers: { authorization: `Bearer ${slowDriver.token}` },
      });
      expect(firstList.statusCode).toBe(200);
      const firstOffer = firstList
        .json<{ dispatches: DispatchRequestSummary[] }>()
        .dispatches.find((d) => d.id === liveDispatch.id);
      expect(firstOffer?.offerExpiresAtIso).toBeTruthy();

      const secondList = await timedApp.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=MA",
        headers: { authorization: `Bearer ${slowDriver.token}` },
      });
      const secondOffer = secondList
        .json<{ dispatches: DispatchRequestSummary[] }>()
        .dispatches.find((d) => d.id === liveDispatch.id);
      expect(secondOffer?.offerExpiresAtIso).toBe(firstOffer?.offerExpiresAtIso);

      // Do not accept or refuse: server emits dispatch.offer_expired automatically after TTL
      const sseExpiredText = await readSseUntil(
        reader,
        (txt) =>
          txt.includes("event: dispatch.offer_expired") &&
          txt.includes(liveDispatch.id),
        3000,
      );
      expect(sseExpiredText).toContain("event: dispatch.offer_expired");
      expect(sseExpiredText).toContain("AUTO_TIMEOUT_60S");

      abortController.abort();
      await reader.cancel().catch(() => undefined);

      // Late accept attempt by slowDriver is strictly rejected with 409 DISPATCH_OFFER_EXPIRED
      const lateAccept = await timedApp.inject({
        method: "PATCH",
        url: `/v1/dispatch/requests/${liveDispatch.id}/status`,
        headers: { authorization: `Bearer ${slowDriver.token}` },
        payload: { status: "ASSIGNED" },
      });
      expect(lateAccept.statusCode).toBe(409);
      expect(lateAccept.json<{ error: string }>().error).toBe(
        "DISPATCH_OFFER_EXPIRED",
      );

      // slowDriver no longer sees the expired demand on reload
      const afterTimeoutList = await timedApp.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=MA",
        headers: { authorization: `Bearer ${slowDriver.token}` },
      });
      expect(
        afterTimeoutList
          .json<{ dispatches: DispatchRequestSummary[] }>()
          .dispatches.some((d) => d.id === liveDispatch.id),
      ).toBe(false);

      // fastDriver STILL receives a fresh offer and accepts it cleanly before timeout
      const fastList = await timedApp.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=MA",
        headers: { authorization: `Bearer ${fastDriver.token}` },
      });
      const fastOffer = fastList
        .json<{ dispatches: DispatchRequestSummary[] }>()
        .dispatches.find((d) => d.id === liveDispatch.id);
      expect(fastOffer?.offerExpiresAtIso).toBeTruthy();

      const fastAccept = await timedApp.inject({
        method: "PATCH",
        url: `/v1/dispatch/requests/${liveDispatch.id}/status`,
        headers: { authorization: `Bearer ${fastDriver.token}` },
        payload: { status: "ASSIGNED" },
      });
      expect(fastAccept.statusCode).toBe(200);
      expect(
        fastAccept.json<{ dispatch: DispatchRequestSummary }>().dispatch
          .driverUserId,
      ).toBe(fastDriver.user.id);
    } finally {
      for (const drvId of localDriverIds) {
        await redis.del(`medisync:dispatch:declined:${drvId}`);
        await redis.del(`medisync:driver:off_duty:${drvId}`);
        await redis.zrem("medisync:geo:drivers:MA", drvId);
        await redis.del(`medisync:driver:state:MA:${drvId}`);
        for (const dispId of createdDispatchIds) {
          await redis.del(`medisync:dispatch:offer:${drvId}:${dispId}`);
          await redis.del(`medisync:dispatch:offer_res:${drvId}:${dispId}`);
        }
      }
      await timedApp.close();
    }
  });

  it("respects OFF_DUTY pause without burning 60s timers, hydrates SSE timers for pre-existing demands, broadcasts expiry to multi-tab SSE without duplicate audits, and keeps AUTO_TIMEOUT_60S decline idempotent", async () => {
    const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_TEST_DB_URL;
    const redisUrl = process.env.REDIS_URL ?? DEFAULT_TEST_REDIS_URL;
    const shortTtlMs = 550;
    const timedApp = await buildApiServer({
      databaseUrl,
      redisUrl,
      authSecret: TEST_AUTH_SECRET,
      corsOrigins: ["http://localhost:3000"],
      pool,
      redis,
      runDbMigrations: false,
      driverOfferTtlMs: shortTtlMs,
    });
    const timedBaseUrl = await timedApp.listen({ port: 0, host: "127.0.0.1" });

    const password = "StrongPassword!123";
    const localDriverIds: string[] = [];

    try {
      const register = async (prefix: string, role: "PATIENT" | "DRIVER") => {
        const res = await timedApp.inject({
          method: "POST",
          url: "/v1/auth/register",
          payload: {
            email: `${prefix}-edge-${runSuffix}@medisync.test`,
            password,
            fullName: `Actor ${prefix}`,
            role,
            countryCode: "MA",
          },
        });
        expect(res.statusCode).toBe(201);
        const auth = res.json<AuthResponse>();
        createdUserIds.push(auth.user.id);
        if (role === "DRIVER") {
          localDriverIds.push(auth.user.id);
        }
        return auth;
      };

      const patient = await register("pat-edge", "PATIENT");
      const offDutyDriver = await register("drv-offduty", "DRIVER");
      const multiTabDriver = await register("drv-multitab", "DRIVER");
      const winningDriver = await register("drv-winner", "DRIVER");

      // 1. Driver goes OFF_DUTY while keeping SSE open; demand created while OFF_DUTY must NOT start/burn offer timer
      await timedApp.inject({
        method: "POST",
        url: "/v1/dispatch/drivers/ping",
        headers: { authorization: `Bearer ${offDutyDriver.token}` },
        payload: { lat: 33.583, lng: -7.627, status: "OFF_DUTY" },
      });

      const offDutyAbort = new AbortController();
      const offDutySse = await fetch(
        `${timedBaseUrl}/v1/dispatch/stream?token=${encodeURIComponent(offDutyDriver.token)}`,
        {
          headers: { origin: "http://localhost:3000" },
          signal: offDutyAbort.signal,
        },
      );
      expect(offDutySse.status).toBe(200);
      const offDutyReader = offDutySse.body!.getReader();
      await readSseUntil(offDutyReader, (txt) => txt.includes("event: snapshot"));

      const offDutyCreate = await timedApp.inject({
        method: "POST",
        url: "/v1/dispatch/requests",
        headers: { authorization: `Bearer ${patient.token}` },
        payload: {
          pickupLat: 33.581,
          pickupLng: -7.621,
          pickupAddress: "Racine Off-Duty Isolation Corner",
          urgency: "URGENT",
        },
      });
      expect(offDutyCreate.statusCode).toBe(201);
      const offDutyDispatch = offDutyCreate.json<{
        dispatch: DispatchRequestSummary;
      }>().dispatch;
      createdDispatchIds.push(offDutyDispatch.id);

      // Wait longer than shortTtlMs while driver stays OFF_DUTY
      await new Promise((r) => setTimeout(r, shortTtlMs + 150));

      // While still OFF_DUTY, GET /requests omits REQUESTED offers
      const whileOffDutyList = await timedApp.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=MA",
        headers: { authorization: `Bearer ${offDutyDriver.token}` },
      });
      expect(
        whileOffDutyList
          .json<{ dispatches: DispatchRequestSummary[] }>()
          .dispatches.some((d) => d.id === offDutyDispatch.id),
      ).toBe(false);

      // Driver toggles back AVAILABLE -> receives fresh active offer (was NOT burned while OFF_DUTY)
      await timedApp.inject({
        method: "POST",
        url: "/v1/dispatch/drivers/ping",
        headers: { authorization: `Bearer ${offDutyDriver.token}` },
        payload: { lat: 33.583, lng: -7.627, status: "AVAILABLE" },
      });

      const onlineFirstList = await timedApp.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=MA",
        headers: { authorization: `Bearer ${offDutyDriver.token}` },
      });
      const freshOffer = onlineFirstList
        .json<{ dispatches: DispatchRequestSummary[] }>()
        .dispatches.find((d) => d.id === offDutyDispatch.id);
      expect(freshOffer?.offerExpiresAtIso).toBeTruthy();
      expect(freshOffer?.offerRemainingMs).toBeGreaterThan(0);

      // Toggling OFF_DUTY -> AVAILABLE mid-offer preserves the exact original offerExpiresAtIso (no reset!)
      await timedApp.inject({
        method: "POST",
        url: "/v1/dispatch/drivers/ping",
        headers: { authorization: `Bearer ${offDutyDriver.token}` },
        payload: { lat: 33.583, lng: -7.627, status: "OFF_DUTY" },
      });
      await timedApp.inject({
        method: "POST",
        url: "/v1/dispatch/drivers/ping",
        headers: { authorization: `Bearer ${offDutyDriver.token}` },
        payload: { lat: 33.583, lng: -7.627, status: "AVAILABLE" },
      });
      const onlineSecondList = await timedApp.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=MA",
        headers: { authorization: `Bearer ${offDutyDriver.token}` },
      });
      const preservedOffer = onlineSecondList
        .json<{ dispatches: DispatchRequestSummary[] }>()
        .dispatches.find((d) => d.id === offDutyDispatch.id);
      expect(preservedOffer?.offerExpiresAtIso).toBe(
        freshOffer?.offerExpiresAtIso,
      );

      offDutyAbort.abort();
      await offDutyReader.cancel().catch(() => undefined);

      // 2. Pre-existing demand BEFORE SSE opens: two concurrent SSE tabs BOTH receive dispatch.offer_expired,
      //    while audit_logs records exactly ONE DISPATCH_AUTO_REFUSED_TIMEOUT row (zero duplicates).
      const preExistCreate = await timedApp.inject({
        method: "POST",
        url: "/v1/dispatch/requests",
        headers: { authorization: `Bearer ${patient.token}` },
        payload: {
          pickupLat: 33.586,
          pickupLng: -7.631,
          pickupAddress: "Gauthier Pre-Existing Hydrated Timer Corner",
          urgency: "EMERGENCY",
        },
      });
      expect(preExistCreate.statusCode).toBe(201);
      const preExistDispatch = preExistCreate.json<{
        dispatch: DispatchRequestSummary;
      }>().dispatch;
      createdDispatchIds.push(preExistDispatch.id);

      const tab1Abort = new AbortController();
      const tab2Abort = new AbortController();
      const [tab1Res, tab2Res] = await Promise.all([
        fetch(
          `${timedBaseUrl}/v1/dispatch/stream?token=${encodeURIComponent(multiTabDriver.token)}`,
          { headers: { origin: "http://localhost:3000" }, signal: tab1Abort.signal },
        ),
        fetch(
          `${timedBaseUrl}/v1/dispatch/stream?token=${encodeURIComponent(multiTabDriver.token)}`,
          { headers: { origin: "http://localhost:3000" }, signal: tab2Abort.signal },
        ),
      ]);
      const tab1Reader = tab1Res.body!.getReader();
      const tab2Reader = tab2Res.body!.getReader();

      const [tab1Text, tab2Text] = await Promise.all([
        readSseUntil(
          tab1Reader,
          (txt) =>
            txt.includes("event: dispatch.offer_expired") &&
            txt.includes(preExistDispatch.id),
          3500,
        ),
        readSseUntil(
          tab2Reader,
          (txt) =>
            txt.includes("event: dispatch.offer_expired") &&
            txt.includes(preExistDispatch.id),
          3500,
        ),
      ]);
      expect(tab1Text).toContain("event: dispatch.offer_expired");
      expect(tab1Text).toContain(preExistDispatch.id);
      expect(tab2Text).toContain("event: dispatch.offer_expired");
      expect(tab2Text).toContain(preExistDispatch.id);

      tab1Abort.abort();
      tab2Abort.abort();
      await Promise.all([
        tab1Reader.cancel().catch(() => undefined),
        tab2Reader.cancel().catch(() => undefined),
      ]);

      // Client auto-timeout POST /decline racing after server auto-refuse writes ZERO duplicate audit rows
      const racingDecline = await timedApp.inject({
        method: "POST",
        url: `/v1/dispatch/requests/${preExistDispatch.id}/decline`,
        headers: { authorization: `Bearer ${multiTabDriver.token}` },
        payload: { reason: "AUTO_TIMEOUT_60S" },
      });
      expect(racingDecline.statusCode).toBe(200);

      const auditCountRes = await pool.query<{ action: string; cnt: string }>(
        `SELECT action, COUNT(*)::text AS cnt
         FROM audit_logs
         WHERE actor_id = $1 AND resource_id = $2
         GROUP BY action`,
        [multiTabDriver.user.id, preExistDispatch.id],
      );
      const timeoutAudit = auditCountRes.rows.find(
        (r) => r.action === "DISPATCH_AUTO_REFUSED_TIMEOUT",
      );
      const manualAudit = auditCountRes.rows.find(
        (r) => r.action === "DISPATCH_DECLINED_BY_DRIVER",
      );
      expect(Number(timeoutAudit?.cnt ?? 0)).toBe(1);
      expect(Number(manualAudit?.cnt ?? 0)).toBe(0);

      // Even after winningDriver claims preExistDispatch, a late AUTO_TIMEOUT_60S decline stays 200 idempotent
      const claimRes = await timedApp.inject({
        method: "PATCH",
        url: `/v1/dispatch/requests/${preExistDispatch.id}/status`,
        headers: { authorization: `Bearer ${winningDriver.token}` },
        payload: { status: "ASSIGNED" },
      });
      expect(claimRes.statusCode).toBe(200);

      const lateAutoDecline = await timedApp.inject({
        method: "POST",
        url: `/v1/dispatch/requests/${preExistDispatch.id}/decline`,
        headers: { authorization: `Bearer ${offDutyDriver.token}` },
        payload: { reason: "AUTO_TIMEOUT_60S" },
      });
      expect(lateAutoDecline.statusCode).toBe(200);
      expect(lateAutoDecline.json()).toMatchObject({
        declined: true,
        dispatchId: preExistDispatch.id,
        releasedToQueue: false,
      });
    } finally {
      for (const drvId of localDriverIds) {
        await redis.del(`medisync:dispatch:declined:${drvId}`);
        await redis.del(`medisync:driver:off_duty:${drvId}`);
        await redis.zrem("medisync:geo:drivers:MA", drvId);
        await redis.del(`medisync:driver:state:MA:${drvId}`);
        for (const dispId of createdDispatchIds) {
          await redis.del(`medisync:dispatch:offer:${drvId}:${dispId}`);
          await redis.del(`medisync:dispatch:offer_res:${drvId}:${dispId}`);
        }
      }
      await timedApp.close();
    }
  });

  it("reports persisted driverDutyStatus on GET /v1/dispatch/requests across OFF_DUTY, AVAILABLE, ASSIGNED, and EN_ROUTE even when dispatch list is empty", async () => {
    const password = "StrongPassword!123";
    const registerFr = async (prefix: string, role: "PATIENT" | "DRIVER") => {
      const res = await app.inject({
        method: "POST",
        url: "/v1/auth/register",
        payload: {
          email: `${prefix}-duty-${runSuffix}@medisync.test`,
          password,
          fullName: `Actor ${prefix}`,
          role,
          countryCode: "FR",
        },
      });
      expect(res.statusCode).toBe(201);
      const auth = res.json<AuthResponse>();
      createdUserIds.push(auth.user.id);
      if (role === "DRIVER") {
        cleanupRedisDriverIds.push({ countryCode: "FR", driverId: auth.user.id });
      }
      return auth;
    };

    const patientFr = await registerFr("pat-fr", "PATIENT");
    const driverFr = await registerFr("drv-fr", "DRIVER");

    try {
      // 1. Empty dispatch list: driver starts AVAILABLE
      const initialEmpty = await app.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=FR",
        headers: { authorization: `Bearer ${driverFr.token}` },
      });
      expect(initialEmpty.statusCode).toBe(200);
      expect(
        initialEmpty.json<{
          dispatches: DispatchRequestSummary[];
          driverDutyStatus?: string;
        }>(),
      ).toMatchObject({
        dispatches: [],
        driverDutyStatus: "AVAILABLE",
      });

      // 2. Driver toggles OFF_DUTY while dispatch list is EMPTY -> reload STILL reports OFF_DUTY
      const offDutyPing = await app.inject({
        method: "POST",
        url: "/v1/dispatch/drivers/ping",
        headers: { authorization: `Bearer ${driverFr.token}` },
        payload: { lat: 48.8566, lng: 2.3522, status: "OFF_DUTY" },
      });
      expect(offDutyPing.statusCode).toBe(200);

      const offDutyEmpty = await app.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=FR",
        headers: { authorization: `Bearer ${driverFr.token}` },
      });
      expect(offDutyEmpty.statusCode).toBe(200);
      expect(
        offDutyEmpty.json<{
          dispatches: DispatchRequestSummary[];
          driverDutyStatus?: string;
        }>(),
      ).toMatchObject({
        dispatches: [],
        driverDutyStatus: "OFF_DUTY",
      });

      // 3. Patient creates a demand while driver is OFF_DUTY -> suppressed & driverDutyStatus remains OFF_DUTY
      const createRes = await app.inject({
        method: "POST",
        url: "/v1/dispatch/requests",
        headers: { authorization: `Bearer ${patientFr.token}` },
        payload: {
          pickupLat: 48.86,
          pickupLng: 2.34,
          pickupAddress: "Rue de Rivoli Duty Reload Test",
          urgency: "URGENT",
        },
      });
      expect(createRes.statusCode).toBe(201);
      const frDispatch = createRes.json<{ dispatch: DispatchRequestSummary }>()
        .dispatch;
      createdDispatchIds.push(frDispatch.id);

      const offDutyWithDemand = await app.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=FR",
        headers: { authorization: `Bearer ${driverFr.token}` },
      });
      expect(offDutyWithDemand.statusCode).toBe(200);
      const offDutyBody = offDutyWithDemand.json<{
        dispatches: DispatchRequestSummary[];
        driverDutyStatus?: string;
      }>();
      expect(offDutyBody.driverDutyStatus).toBe("OFF_DUTY");
      expect(offDutyBody.dispatches.some((d) => d.id === frDispatch.id)).toBe(
        false,
      );

      // 4. Non-driver (PATIENT) does not receive driverDutyStatus
      const patientList = await app.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=FR",
        headers: { authorization: `Bearer ${patientFr.token}` },
      });
      expect(patientList.statusCode).toBe(200);
      expect(
        patientList.json<{ driverDutyStatus?: string }>().driverDutyStatus,
      ).toBeUndefined();

      // 5. Driver goes back AVAILABLE -> reports AVAILABLE and receives fresh offer
      const onlinePing = await app.inject({
        method: "POST",
        url: "/v1/dispatch/drivers/ping",
        headers: { authorization: `Bearer ${driverFr.token}` },
        payload: { lat: 48.8566, lng: 2.3522, status: "AVAILABLE" },
      });
      expect(onlinePing.statusCode).toBe(200);

      const onlineList = await app.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=FR",
        headers: { authorization: `Bearer ${driverFr.token}` },
      });
      expect(onlineList.statusCode).toBe(200);
      const onlineBody = onlineList.json<{
        dispatches: DispatchRequestSummary[];
        driverDutyStatus?: string;
      }>();
      expect(onlineBody.driverDutyStatus).toBe("AVAILABLE");
      expect(onlineBody.dispatches.some((d) => d.id === frDispatch.id)).toBe(
        true,
      );

      // 6. Active mission reflects ASSIGNED (even on filtered 0-row queries) and EN_ROUTE
      const assignRes = await app.inject({
        method: "PATCH",
        url: `/v1/dispatch/requests/${frDispatch.id}/status`,
        headers: { authorization: `Bearer ${driverFr.token}` },
        payload: { status: "ASSIGNED" },
      });
      expect(assignRes.statusCode).toBe(200);

      const filteredWhileAssigned = await app.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=FR&status=COMPLETED",
        headers: { authorization: `Bearer ${driverFr.token}` },
      });
      expect(filteredWhileAssigned.statusCode).toBe(200);
      expect(
        filteredWhileAssigned.json<{
          dispatches: DispatchRequestSummary[];
          driverDutyStatus?: string;
        }>(),
      ).toMatchObject({
        dispatches: [],
        driverDutyStatus: "ASSIGNED",
      });

      const enRouteRes = await app.inject({
        method: "PATCH",
        url: `/v1/dispatch/requests/${frDispatch.id}/status`,
        headers: { authorization: `Bearer ${driverFr.token}` },
        payload: { status: "EN_ROUTE" },
      });
      expect(enRouteRes.statusCode).toBe(200);

      const enRouteList = await app.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=FR",
        headers: { authorization: `Bearer ${driverFr.token}` },
      });
      expect(enRouteList.statusCode).toBe(200);
      expect(
        enRouteList.json<{ driverDutyStatus?: string }>().driverDutyStatus,
      ).toBe("EN_ROUTE");

      // 7. OFF_DUTY ping is rejected with 409 ACTIVE_MISSION_DUTY_LOCK while on an active mission
      //    and must neither evict the driver from Redis Geo nor poison off_duty after COMPLETED.
      const blockedOffDuty = await app.inject({
        method: "POST",
        url: "/v1/dispatch/drivers/ping",
        headers: { authorization: `Bearer ${driverFr.token}` },
        payload: { lat: 48.8566, lng: 2.3522, status: "OFF_DUTY" },
      });
      expect(blockedOffDuty.statusCode).toBe(409);
      expect(blockedOffDuty.json<{ error: string }>().error).toBe(
        "ACTIVE_MISSION_DUTY_LOCK",
      );
      expect(
        await redis.exists(`medisync:driver:off_duty:${driverFr.user.id}`),
      ).toBe(0);

      const arrivedRes = await app.inject({
        method: "PATCH",
        url: `/v1/dispatch/requests/${frDispatch.id}/status`,
        headers: { authorization: `Bearer ${driverFr.token}` },
        payload: { status: "ARRIVED" },
      });
      expect(arrivedRes.statusCode).toBe(200);

      const completedRes = await app.inject({
        method: "PATCH",
        url: `/v1/dispatch/requests/${frDispatch.id}/status`,
        headers: { authorization: `Bearer ${driverFr.token}` },
        payload: { status: "COMPLETED" },
      });
      expect(completedRes.statusCode).toBe(200);

      const afterCompleted = await app.inject({
        method: "GET",
        url: "/v1/dispatch/requests?countryCode=FR",
        headers: { authorization: `Bearer ${driverFr.token}` },
      });
      expect(afterCompleted.statusCode).toBe(200);
      expect(
        afterCompleted.json<{ driverDutyStatus?: string }>().driverDutyStatus,
      ).toBe("AVAILABLE");

      // 8. Assigning a mission clears any stale Redis off_duty key so completion returns to AVAILABLE
      const staleOffDutyRes = await app.inject({
        method: "POST",
        url: "/v1/dispatch/drivers/ping",
        headers: { authorization: `Bearer ${driverFr.token}` },
        payload: { lat: 48.8566, lng: 2.3522, status: "OFF_DUTY" },
      });
      expect(staleOffDutyRes.statusCode).toBe(200);

      const secondCreate = await app.inject({
        method: "POST",
        url: "/v1/dispatch/requests",
        headers: { authorization: `Bearer ${patientFr.token}` },
        payload: {
          pickupLat: 48.862,
          pickupLng: 2.345,
          pickupAddress: "Boulevard Haussmann Duty Clear Test",
          urgency: "URGENT",
        },
      });
      expect(secondCreate.statusCode).toBe(201);
      const secondFrDispatch = secondCreate.json<{
        dispatch: DispatchRequestSummary;
      }>().dispatch;
      createdDispatchIds.push(secondFrDispatch.id);

      const directAssign = await app.inject({
        method: "PATCH",
        url: `/v1/dispatch/requests/${secondFrDispatch.id}/status`,
        headers: { authorization: `Bearer ${driverFr.token}` },
        payload: { status: "ASSIGNED" },
      });
      expect(directAssign.statusCode).toBe(200);
      expect(
        await redis.exists(`medisync:driver:off_duty:${driverFr.user.id}`),
      ).toBe(0);
    } finally {
      await redis.del(`medisync:driver:off_duty:${driverFr.user.id}`);
      await redis.del(`medisync:dispatch:declined:${driverFr.user.id}`);
      for (const dispId of createdDispatchIds) {
        await redis.del(`medisync:dispatch:offer:${driverFr.user.id}:${dispId}`);
        await redis.del(`medisync:dispatch:offer_res:${driverFr.user.id}:${dispId}`);
      }
    }
  });
});
