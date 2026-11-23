import { NextResponse } from "next/server";

const OSRM_TIMEOUT_MS = 2800;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 400;
const MAX_ROUTE_KM = 500;

interface CachedRoute {
  coordinates: ReadonlyArray<readonly [number, number]>;
  distanceMeters: number;
  durationSeconds: number;
  source: "osrm" | "fallback";
  expiresAtMs: number;
}

const routeCache = new Map<string, CachedRoute>();
const inFlightRoutes = new Map<string, Promise<CachedRoute>>();

function storeRouteCache(key: string, entry: CachedRoute): void {
  if (routeCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = routeCache.keys().next().value;
    if (oldestKey) routeCache.delete(oldestKey);
  }
  routeCache.set(key, entry);
}

function parseCoord(raw: string | null, min: number, max: number): number | null {
  if (!raw) return null;
  const num = Number.parseFloat(raw);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

function buildManhattanFallbackRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
): CachedRoute {
  const midLng = (fromLng + toLng) / 2;
  const midLat = (fromLat + toLat) / 2;
  const dLat = (toLat - fromLat) * 111_320;
  const dLng =
    (toLng - fromLng) *
    111_320 *
    Math.cos(((fromLat + toLat) / 2) * (Math.PI / 180));
  const roadEstimateMeters = Math.round(Math.hypot(dLat, dLng) * 1.25);
  return {
    coordinates: [
      [fromLng, fromLat],
      [midLng, fromLat],
      [midLng, midLat],
      [toLng, midLat],
      [toLng, toLat],
    ],
    distanceMeters: roadEstimateMeters,
    durationSeconds: Math.max(30, Math.round(roadEstimateMeters / 9.5)),
    source: "fallback",
    expiresAtMs: Date.now() + 60_000,
  };
}

/**
 * Proxies driving navigation polylines (OSRM OpenStreetMap road geometry) with
 * quantized in-memory caching so map panning/zooming never hammers upstream routers.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const fromLat = parseCoord(searchParams.get("fromLat"), -90, 90);
  const fromLng = parseCoord(searchParams.get("fromLng"), -180, 180);
  const toLat = parseCoord(searchParams.get("toLat"), -90, 90);
  const toLng = parseCoord(searchParams.get("toLng"), -180, 180);

  if (
    fromLat === null ||
    fromLng === null ||
    toLat === null ||
    toLng === null
  ) {
    return NextResponse.json(
      { error: "INVALID_ROUTE_COORDINATES" },
      { status: 400 },
    );
  }

  if (
    Math.abs(fromLat - toLat) < 0.0001 &&
    Math.abs(fromLng - toLng) < 0.0001
  ) {
    return NextResponse.json({
      coordinates: [
        [fromLng, fromLat],
        [toLng, toLat],
      ],
      distanceMeters: 0,
      durationSeconds: 0,
      source: "fallback",
    });
  }

  const approxKm =
    Math.hypot(
      (toLat - fromLat) * 111.32,
      (toLng - fromLng) *
        111.32 *
        Math.cos(((fromLat + toLat) / 2) * (Math.PI / 180)),
    );
  if (approxKm > MAX_ROUTE_KM) {
    const fallback = buildManhattanFallbackRoute(fromLng, fromLat, toLng, toLat);
    return NextResponse.json(
      {
        coordinates: fallback.coordinates,
        distanceMeters: fallback.distanceMeters,
        durationSeconds: fallback.durationSeconds,
        source: fallback.source,
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  }

  const cacheKey = `${fromLat.toFixed(4)},${fromLng.toFixed(4)}->${toLat.toFixed(4)},${toLng.toFixed(4)}`;
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now()) {
    return NextResponse.json(
      {
        coordinates: cached.coordinates,
        distanceMeters: cached.distanceMeters,
        durationSeconds: cached.durationSeconds,
        source: cached.source,
      },
      {
        headers: {
          "Cache-Control":
            cached.source === "osrm"
              ? "public, max-age=300, s-maxage=300, stale-while-revalidate=600"
              : "public, max-age=60",
          "X-Route-Cache": "HIT",
        },
      },
    );
  }

  let pending = inFlightRoutes.get(cacheKey);
  if (!pending) {
    pending = (async (): Promise<CachedRoute> => {
      try {
        const upstreamBase =
          process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org";
        const upstreamUrl = `${upstreamBase.replace(/\/+$/, "")}/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=simplified&geometries=geojson`;
        const upstreamRes = await fetch(upstreamUrl, {
          signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
          headers: {
            "User-Agent": "MediSyncGlobal/1.0 (clinical-routing)",
            Accept: "application/json",
          },
        });

        if (upstreamRes.ok) {
          const payload = (await upstreamRes.json()) as {
            code?: string;
            routes?: Array<{
              distance?: number;
              duration?: number;
              geometry?: { coordinates?: unknown };
            }>;
          };
          const primary = payload.routes?.[0];
          const rawCoords = primary?.geometry?.coordinates;
          if (
            payload.code === "Ok" &&
            Array.isArray(rawCoords) &&
            rawCoords.length >= 2
          ) {
            const cleanCoords: Array<readonly [number, number]> = [];
            for (const pair of rawCoords) {
              if (
                Array.isArray(pair) &&
                pair.length >= 2 &&
                typeof pair[0] === "number" &&
                typeof pair[1] === "number"
              ) {
                cleanCoords.push([pair[0], pair[1]]);
              }
            }
            if (cleanCoords.length >= 2) {
              const entry: CachedRoute = {
                coordinates: cleanCoords,
                distanceMeters: Math.round(primary?.distance ?? 0),
                durationSeconds: Math.round(primary?.duration ?? 0),
                source: "osrm",
                expiresAtMs: Date.now() + CACHE_TTL_MS,
              };
              storeRouteCache(cacheKey, entry);
              return entry;
            }
          }
        }
      } catch {
        // Fall back to bounded street-turn interpolation cleanly when upstream OSRM is unreachable.
      }

      const fallback = buildManhattanFallbackRoute(
        fromLng,
        fromLat,
        toLng,
        toLat,
      );
      storeRouteCache(cacheKey, fallback);
      return fallback;
    })();
    inFlightRoutes.set(cacheKey, pending);
    pending.finally(() => {
      if (inFlightRoutes.get(cacheKey) === pending) {
        inFlightRoutes.delete(cacheKey);
      }
    });
  }

  const entry = await pending;
  return NextResponse.json(
    {
      coordinates: entry.coordinates,
      distanceMeters: entry.distanceMeters,
      durationSeconds: entry.durationSeconds,
      source: entry.source,
    },
    {
      headers: {
        "Cache-Control":
          entry.source === "osrm"
            ? "public, max-age=300, s-maxage=300, stale-while-revalidate=600"
            : "public, max-age=60",
        "X-Route-Cache": "MISS",
      },
    },
  );
}
