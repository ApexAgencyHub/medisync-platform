"use client";

import { useEffect, useState } from "react";

export interface RoadRouteGeometry {
  coordinates: ReadonlyArray<readonly [number, number]>;
  distanceMeters: number;
  durationSeconds: number;
  source: "osrm" | "fallback";
}

const CLIENT_ROUTE_TTL_MS = 5 * 60 * 1000;
const CLIENT_ROUTE_CACHE = new Map<
  string,
  { geometry: RoadRouteGeometry; expiresAtMs: number }
>();
const CLIENT_IN_FLIGHT_ROUTES = new Map<
  string,
  Promise<RoadRouteGeometry | null>
>();

export function computeHaversineMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusM = 6_371_000;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return earthRadiusM * c;
}

/**
 * Computes immediate fallback road metrics & route polyline synchronously so map ribbons,
 * distance, and ETA remain visible immediately on first paint and at every zoom level.
 */
export function estimateFallbackRoadRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): RoadRouteGeometry {
  const straightMeters = computeHaversineMeters(fromLat, fromLng, toLat, toLng);
  const roadDistanceMeters = Math.round(straightMeters * 1.26);
  const durationSeconds =
    roadDistanceMeters < 40
      ? 0
      : Math.max(60, Math.round(roadDistanceMeters / 9.8));
  return {
    coordinates: [
      [fromLng, fromLat],
      [toLng, toLat],
    ],
    distanceMeters: roadDistanceMeters,
    durationSeconds,
    source: "fallback",
  };
}

/**
 * Fetches and caches real street-following driving geometry between two points, falling back
 * immediately to synchronous road estimates when in-flight or zoomed to regional scale.
 */
export function useRoadRoute(
  fromLat: number | null,
  fromLng: number | null,
  toLat: number | null,
  toLng: number | null,
): RoadRouteGeometry | null {
  const valid =
    fromLat !== null &&
    fromLng !== null &&
    toLat !== null &&
    toLng !== null &&
    Number.isFinite(fromLat) &&
    Number.isFinite(fromLng) &&
    Number.isFinite(toLat) &&
    Number.isFinite(toLng);

  const routeKey = valid
    ? `${fromLat.toFixed(4)},${fromLng.toFixed(4)}->${toLat.toFixed(4)},${toLng.toFixed(4)}`
    : null;

  const [fetched, setFetched] = useState<{
    key: string;
    geometry: RoadRouteGeometry;
  } | null>(null);

  useEffect(() => {
    if (!routeKey) {
      return;
    }
    const existing = CLIENT_ROUTE_CACHE.get(routeKey);
    if (existing && existing.expiresAtMs > Date.now()) {
      return;
    }

    const [fromPart, toPart] = routeKey.split("->");
    const [fLatStr, fLngStr] = (fromPart ?? "").split(",");
    const [tLatStr, tLngStr] = (toPart ?? "").split(",");
    if (!fLatStr || !fLngStr || !tLatStr || !tLngStr) {
      return;
    }

    let cancelled = false;
    let pending = CLIENT_IN_FLIGHT_ROUTES.get(routeKey);
    if (!pending) {
      const qs = new URLSearchParams({
        fromLat: fLatStr,
        fromLng: fLngStr,
        toLat: tLatStr,
        toLng: tLngStr,
      });
      pending = fetch(`/api/route?${qs.toString()}`)
        .then(async (res) => {
          if (!res.ok) return null;
          const json = (await res.json()) as Partial<RoadRouteGeometry>;
          if (!Array.isArray(json.coordinates) || json.coordinates.length < 2) {
            return null;
          }
          return {
            coordinates: json.coordinates,
            distanceMeters: json.distanceMeters ?? 0,
            durationSeconds: json.durationSeconds ?? 0,
            source:
              json.source === "osrm" ? ("osrm" as const) : ("fallback" as const),
          };
        })
        .catch(() => null);
      CLIENT_IN_FLIGHT_ROUTES.set(routeKey, pending);
      pending.finally(() => {
        if (CLIENT_IN_FLIGHT_ROUTES.get(routeKey) === pending) {
          CLIENT_IN_FLIGHT_ROUTES.delete(routeKey);
        }
      });
    }

    void pending.then((geometry) => {
      if (!geometry || cancelled) return;
      if (CLIENT_ROUTE_CACHE.size > 300) {
        const oldest = CLIENT_ROUTE_CACHE.keys().next().value;
        if (oldest) CLIENT_ROUTE_CACHE.delete(oldest);
      }
      CLIENT_ROUTE_CACHE.set(routeKey, {
        geometry,
        expiresAtMs: Date.now() + CLIENT_ROUTE_TTL_MS,
      });
      setFetched({ key: routeKey, geometry });
    });

    return () => {
      cancelled = true;
    };
  }, [routeKey]);

  if (!routeKey || fromLat === null || fromLng === null || toLat === null || toLng === null) {
    return null;
  }
  const cached = CLIENT_ROUTE_CACHE.get(routeKey);
  if (cached && cached.expiresAtMs > Date.now()) return cached.geometry;
  if (fetched && fetched.key === routeKey) return fetched.geometry;
  return estimateFallbackRoadRoute(fromLat, fromLng, toLat, toLng);
}
