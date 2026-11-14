import type { Redis } from "ioredis";
import { z } from "zod";
import {
  DriverStatusSchema,
  LiveDriverMarkerSchema,
  type DispatchRequestSummary,
  type DriverStatus,
  type LiveDriverMarker,
} from "@medisync/contracts";

const DRIVER_STATE_TTL_SECONDS = 120;

const StoredDriverStateSchema = z.object({
  driverId: z.string().uuid(),
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  lat: z.number(),
  lng: z.number(),
  headingDeg: z.number().nullable(),
  status: DriverStatusSchema,
  recordedAtIso: z.string().datetime(),
});

function driverGeoKey(countryCode: string): string {
  return `medisync:geo:drivers:${countryCode}`;
}

function driverStateKey(countryCode: string, driverId: string): string {
  return `medisync:driver:state:${countryCode}:${driverId}`;
}

export function dispatchPubSubChannel(countryCode: string): string {
  return `medisync:pubsub:dispatch:${countryCode}`;
}

export async function upsertDriverLocation(
  redis: Redis,
  input: {
    driverId: string;
    countryCode: string;
    lat: number;
    lng: number;
    headingDeg?: number | undefined;
    status: DriverStatus;
  },
): Promise<LiveDriverMarker> {
  const recordedAtIso = new Date().toISOString();
  const state: z.infer<typeof StoredDriverStateSchema> = {
    driverId: input.driverId,
    countryCode: input.countryCode,
    lat: input.lat,
    lng: input.lng,
    headingDeg: input.headingDeg ?? null,
    status: input.status,
    recordedAtIso,
  };

  const geoKey = driverGeoKey(input.countryCode);
  const stateKey = driverStateKey(input.countryCode, input.driverId);

  if (input.status === "OFF_DUTY") {
    await redis.multi().zrem(geoKey, input.driverId).del(stateKey).exec();
  } else {
    await redis
      .multi()
      .geoadd(geoKey, input.lng, input.lat, input.driverId)
      .set(stateKey, JSON.stringify(state), "EX", DRIVER_STATE_TTL_SECONDS)
      .exec();
  }

  const marker: LiveDriverMarker = {
    ...state,
    distanceKm: 0,
  };

  await redis.publish(
    dispatchPubSubChannel(input.countryCode),
    JSON.stringify({ type: "driver.location", driver: marker }),
  );

  return marker;
}

export async function findNearbyDrivers(
  redis: Redis,
  query: {
    countryCode: string;
    lat: number;
    lng: number;
    radiusKm: number;
    limit: number;
  },
): Promise<{ drivers: LiveDriverMarker[]; queryMs: number }> {
  const startNs = process.hrtime.bigint();
  const geoKey = driverGeoKey(query.countryCode);

  const rawResults: unknown = await redis.geosearch(
    geoKey,
    "FROMLONLAT",
    query.lng,
    query.lat,
    "BYRADIUS",
    query.radiusKm,
    "km",
    "ASC",
    "COUNT",
    query.limit,
    "WITHCOORD",
    "WITHDIST",
  );

  if (!Array.isArray(rawResults) || rawResults.length === 0) {
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    return { drivers: [], queryMs: Number(elapsedMs.toFixed(2)) };
  }

  const hits: Array<{
    driverId: string;
    distanceKm: number;
    lng: number;
    lat: number;
  }> = [];

  for (const row of rawResults) {
    if (!Array.isArray(row) || row.length < 3) continue;
    const driverId = typeof row[0] === "string" ? row[0] : null;
    const dist = Number(row[1]);
    const coord = Array.isArray(row[2]) ? row[2] : null;
    if (!driverId || !Number.isFinite(dist) || !coord || coord.length < 2) {
      continue;
    }
    const lng = Number(coord[0]);
    const lat = Number(coord[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    hits.push({ driverId, distanceKm: dist, lng, lat });
  }

  if (hits.length === 0) {
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    return { drivers: [], queryMs: Number(elapsedMs.toFixed(2)) };
  }

  const stateValues = await redis.mget(
    ...hits.map((h) => driverStateKey(query.countryCode, h.driverId)),
  );

  const drivers: LiveDriverMarker[] = [];
  const staleIds: string[] = [];

  hits.forEach((hit, index) => {
    const rawState = stateValues[index];
    if (!rawState) {
      staleIds.push(hit.driverId);
      return;
    }
    try {
      const parsed = StoredDriverStateSchema.parse(JSON.parse(rawState));
      drivers.push(
        LiveDriverMarkerSchema.parse({
          driverId: parsed.driverId,
          countryCode: parsed.countryCode,
          lat: hit.lat,
          lng: hit.lng,
          headingDeg: parsed.headingDeg,
          status: parsed.status,
          distanceKm: Number(hit.distanceKm.toFixed(3)),
          recordedAtIso: parsed.recordedAtIso,
        }),
      );
    } catch {
      staleIds.push(hit.driverId);
    }
  });

  if (staleIds.length > 0) {
    await redis.zrem(geoKey, ...staleIds);
  }

  const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
  return { drivers, queryMs: Number(elapsedMs.toFixed(2)) };
}

export async function readDriverStatuses(
  redis: Redis,
  drivers: ReadonlyArray<{ driverId: string; countryCode: string }>,
): Promise<Map<string, DriverStatus>> {
  const statuses = new Map<string, DriverStatus>();
  if (drivers.length === 0) return statuses;

  const keys = drivers.map((d) => driverStateKey(d.countryCode, d.driverId));
  const rawValues = await redis.mget(...keys);

  drivers.forEach((driver, index) => {
    const raw = rawValues[index];
    if (!raw) return;
    try {
      const parsed = StoredDriverStateSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        statuses.set(driver.driverId, parsed.data.status);
      }
    } catch {
      // Ignore malformed cached telemetry frames
    }
  });

  return statuses;
}

export async function publishDispatchUpdate(
  redis: Redis,
  dispatch: DispatchRequestSummary,
): Promise<void> {
  await redis.publish(
    dispatchPubSubChannel(dispatch.countryCode),
    JSON.stringify({ type: "dispatch.updated", dispatch }),
  );
}
