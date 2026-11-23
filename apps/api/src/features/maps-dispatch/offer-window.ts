import type { Redis } from "ioredis";
import { z } from "zod";
import { DRIVER_OFFER_WINDOW_SECONDS } from "@medisync/contracts";

export const DEFAULT_DRIVER_OFFER_TTL_MS = DRIVER_OFFER_WINDOW_SECONDS * 1000;
const OFFER_RECORD_TTL_SECONDS = 86_400;

const StoredOfferSchema = z.object({
  offeredAtMs: z.number().int().positive(),
  expiresAtMs: z.number().int().positive(),
  resolution: z.enum(["MANUAL_DECLINED", "AUTO_EXPIRED"]).optional(),
});

type StoredOffer = z.infer<typeof StoredOfferSchema>;

export function driverDeclinedSetKey(driverId: string): string {
  return `medisync:dispatch:declined:${driverId}`;
}

export function driverOfferKey(driverId: string, dispatchId: string): string {
  return `medisync:dispatch:offer:${driverId}:${dispatchId}`;
}

export function driverOfferResolutionKey(
  driverId: string,
  dispatchId: string,
): string {
  return `medisync:dispatch:offer_res:${driverId}:${dispatchId}`;
}

function parseStoredOffer(raw: string | null): StoredOffer | null {
  if (!raw) return null;
  try {
    const parsed = StoredOfferSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface AutoRefuseOfferResult {
  newlyExpired: boolean;
  wasAutoExpired: boolean;
}

/**
 * Atomically marks a driver offer as auto-refused due to 60s timeout.
 * Uses an atomic SET NX resolution lock so multi-tab SSE timers never race:
 * exactly one caller gets `newlyExpired: true` (single audit row), every tab
 * gets `wasAutoExpired: true` (all tabs emit `dispatch.offer_expired`), and
 * manually declined offers never emit false timeout events.
 */
export async function markDriverOfferAutoRefused(
  redis: Redis,
  driverId: string,
  dispatchId: string,
  nowMs: number = Date.now(),
): Promise<AutoRefuseOfferResult> {
  const offerKey = driverOfferKey(driverId, dispatchId);
  const resKey = driverOfferResolutionKey(driverId, dispatchId);
  const declineKey = driverDeclinedSetKey(driverId);

  const claimed = await redis.set(
    resKey,
    "AUTO_EXPIRED",
    "EX",
    OFFER_RECORD_TTL_SECONDS,
    "NX",
  );

  if (claimed === "OK") {
    const stored = parseStoredOffer(await redis.get(offerKey));
    if (stored?.resolution === "MANUAL_DECLINED") {
      await redis.set(
        resKey,
        "MANUAL_DECLINED",
        "EX",
        OFFER_RECORD_TTL_SECONDS,
      );
      return { newlyExpired: false, wasAutoExpired: false };
    }

    await redis.sadd(declineKey, dispatchId);
    await redis.expire(declineKey, OFFER_RECORD_TTL_SECONDS);

    const updated: StoredOffer = {
      offeredAtMs: stored?.offeredAtMs ?? nowMs,
      expiresAtMs: stored?.expiresAtMs ?? nowMs,
      resolution: "AUTO_EXPIRED",
    };
    await redis.set(
      offerKey,
      JSON.stringify(updated),
      "EX",
      OFFER_RECORD_TTL_SECONDS,
    );

    return { newlyExpired: true, wasAutoExpired: true };
  }

  const existingResolution = await redis.get(resKey);
  if (existingResolution === "AUTO_EXPIRED") {
    await redis.sadd(declineKey, dispatchId);
    await redis.expire(declineKey, OFFER_RECORD_TTL_SECONDS);
    return { newlyExpired: false, wasAutoExpired: true };
  }

  return { newlyExpired: false, wasAutoExpired: false };
}

/**
 * Marks a driver offer as manually declined (or released).
 * Idempotent: returns `newlyDeclined: false` if already declined or auto-expired.
 */
export async function markDriverOfferManualDeclined(
  redis: Redis,
  driverId: string,
  dispatchId: string,
  nowMs: number = Date.now(),
): Promise<{ newlyDeclined: boolean }> {
  const resKey = driverOfferResolutionKey(driverId, dispatchId);
  const declineKey = driverDeclinedSetKey(driverId);

  const claimed = await redis.set(
    resKey,
    "MANUAL_DECLINED",
    "EX",
    OFFER_RECORD_TTL_SECONDS,
    "NX",
  );
  await redis.sadd(declineKey, dispatchId);
  await redis.expire(declineKey, OFFER_RECORD_TTL_SECONDS);

  if (claimed === "OK") {
    const offerKey = driverOfferKey(driverId, dispatchId);
    const stored = parseStoredOffer(await redis.get(offerKey));
    const updated: StoredOffer = {
      offeredAtMs: stored?.offeredAtMs ?? nowMs,
      expiresAtMs: stored?.expiresAtMs ?? nowMs,
      resolution: "MANUAL_DECLINED",
    };
    await redis.set(
      offerKey,
      JSON.stringify(updated),
      "EX",
      OFFER_RECORD_TTL_SECONDS,
    );
    return { newlyDeclined: true };
  }

  return { newlyDeclined: false };
}

export type EnsureOfferWindowResult =
  | { status: "DECLINED" }
  | { status: "EXPIRED"; newlyExpired: boolean; expiresAtMs: number }
  | {
      status: "ACTIVE";
      offeredAtMs: number;
      expiresAtMs: number;
      offerExpiresAtIso: string;
      offerWindowSeconds: number;
      offerRemainingMs: number;
    };

/**
 * Ensures a per-driver 60-second offer lease exists for an incoming REQUESTED dispatch.
 * - Never resets the deadline across page reloads, off-duty toggles, or duplicate SSE pushes.
 * - Automatically marks the dispatch refused in Redis once the 60-second window passes.
 */
export async function ensureDriverOfferWindow(
  redis: Redis,
  driverId: string,
  dispatchId: string,
  offerTtlMs: number = DEFAULT_DRIVER_OFFER_TTL_MS,
  nowMs: number = Date.now(),
): Promise<EnsureOfferWindowResult> {
  const declineKey = driverDeclinedSetKey(driverId);
  const resKey = driverOfferResolutionKey(driverId, dispatchId);
  const [alreadyDeclined, existingRes] = await Promise.all([
    redis.sismember(declineKey, dispatchId),
    redis.get(resKey),
  ]);
  if (alreadyDeclined === 1 || existingRes !== null) {
    return { status: "DECLINED" };
  }

  const key = driverOfferKey(driverId, dispatchId);
  let stored = parseStoredOffer(await redis.get(key));

  if (!stored) {
    const candidate: StoredOffer = {
      offeredAtMs: nowMs,
      expiresAtMs: nowMs + offerTtlMs,
    };
    const setRes = await redis.set(
      key,
      JSON.stringify(candidate),
      "EX",
      OFFER_RECORD_TTL_SECONDS,
      "NX",
    );
    if (setRes === "OK") {
      stored = candidate;
    } else {
      stored = parseStoredOffer(await redis.get(key)) ?? candidate;
    }
  }

  if (nowMs >= stored.expiresAtMs) {
    const autoRes = await markDriverOfferAutoRefused(
      redis,
      driverId,
      dispatchId,
      nowMs,
    );
    return {
      status: "EXPIRED",
      newlyExpired: autoRes.newlyExpired,
      expiresAtMs: stored.expiresAtMs,
    };
  }

  return {
    status: "ACTIVE",
    offeredAtMs: stored.offeredAtMs,
    expiresAtMs: stored.expiresAtMs,
    offerExpiresAtIso: new Date(stored.expiresAtMs).toISOString(),
    offerWindowSeconds: Math.max(1, Math.ceil(offerTtlMs / 1000)),
    offerRemainingMs: Math.max(0, stored.expiresAtMs - nowMs),
  };
}

export type CheckOfferBeforeAcceptResult =
  | { allowed: true }
  | { allowed: false; newlyExpired: boolean; reason: "DECLINED" | "EXPIRED" };

/**
 * Enforces server-side that a driver cannot accept a dispatch they previously declined
 * or whose 60-second offer window has already elapsed (strict <= 60s boundary).
 */
export async function checkDriverOfferBeforeAccept(
  redis: Redis,
  driverId: string,
  dispatchId: string,
  nowMs: number = Date.now(),
): Promise<CheckOfferBeforeAcceptResult> {
  const declineKey = driverDeclinedSetKey(driverId);
  const resKey = driverOfferResolutionKey(driverId, dispatchId);
  const [alreadyDeclined, rawStored, existingRes] = await Promise.all([
    redis.sismember(declineKey, dispatchId),
    redis.get(driverOfferKey(driverId, dispatchId)),
    redis.get(resKey),
  ]);
  const stored = parseStoredOffer(rawStored);

  if (alreadyDeclined === 1 || existingRes !== null) {
    return {
      allowed: false,
      newlyExpired: false,
      reason:
        existingRes === "AUTO_EXPIRED" || stored?.resolution === "AUTO_EXPIRED"
          ? "EXPIRED"
          : "DECLINED",
    };
  }

  if (stored && nowMs >= stored.expiresAtMs) {
    const autoRes = await markDriverOfferAutoRefused(
      redis,
      driverId,
      dispatchId,
      nowMs,
    );
    return {
      allowed: false,
      newlyExpired: autoRes.newlyExpired,
      reason: "EXPIRED",
    };
  }

  return { allowed: true };
}
