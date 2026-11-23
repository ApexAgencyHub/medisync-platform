import type { Redis } from "ioredis";

export const DIRECTORY_CACHE_GEN_KEY = "medisync:cache:gen:directory";
export const SCHEDULES_CACHE_GEN_KEY = "medisync:cache:gen:schedules";

const GEN_L1_TTL_MS = 3_000;
const genCacheByRedis = new WeakMap<
  Redis,
  Map<string, { value: string; expiresAt: number }>
>();
const inFlightByRedis = new WeakMap<Redis, Map<string, Promise<unknown>>>();

function getGenL1Map(redis: Redis): Map<string, { value: string; expiresAt: number }> {
  let map = genCacheByRedis.get(redis);
  if (!map) {
    map = new Map();
    genCacheByRedis.set(redis, map);
  }
  return map;
}

function getInFlightMap(redis: Redis): Map<string, Promise<unknown>> {
  let map = inFlightByRedis.get(redis);
  if (!map) {
    map = new Map();
    inFlightByRedis.set(redis, map);
  }
  return map;
}

export async function getCacheGeneration(
  redis: Redis | undefined,
  genKey: string,
): Promise<string> {
  if (!redis) return "0";
  const l1 = getGenL1Map(redis);
  const now = Date.now();
  const hit = l1.get(genKey);
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }
  try {
    const val = (await redis.get(genKey)) ?? "0";
    l1.set(genKey, { value: val, expiresAt: now + GEN_L1_TTL_MS });
    return val;
  } catch {
    return "0";
  }
}

export async function bumpCacheGeneration(
  redis: Redis | undefined,
  genKey: string = DIRECTORY_CACHE_GEN_KEY,
): Promise<void> {
  if (!redis) return;
  getGenL1Map(redis).delete(genKey);
  const next = await redis.incr(genKey).catch(() => null);
  if (next !== null) {
    getGenL1Map(redis).set(genKey, {
      value: String(next),
      expiresAt: Date.now() + GEN_L1_TTL_MS,
    });
  }
}

/**
 * Reads a generation-scoped Redis JSON cache entry with L1 generation caching
 * and singleflight in-flight deduplication to prevent thundering-herd stampedes.
 */
export async function withGenerationCache<T>(
  redis: Redis | undefined,
  genKey: string,
  cacheSubKey: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  if (!redis) {
    return loader();
  }

  const gen = await getCacheGeneration(redis, genKey);
  const fullKey = `${genKey}:v${gen}:${cacheSubKey}`;

  try {
    const cached = await redis.get(fullKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Fall back safely to primary database on cache decode or Redis error.
  }

  const inFlight = getInFlightMap(redis);
  const existingPromise = inFlight.get(fullKey);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  const work = (async () => {
    const fresh = await loader();
    await redis
      .set(fullKey, JSON.stringify(fresh), "EX", ttlSeconds)
      .catch(() => undefined);
    return fresh;
  })();

  inFlight.set(fullKey, work);
  try {
    return await work;
  } finally {
    if (inFlight.get(fullKey) === work) {
      inFlight.delete(fullKey);
    }
  }
}
