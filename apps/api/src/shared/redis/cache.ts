import type { Redis } from "ioredis";

export const DIRECTORY_CACHE_GEN_KEY = "medisync:cache:gen:directory";

export async function getCacheGeneration(
  redis: Redis | undefined,
  genKey: string,
): Promise<string> {
  if (!redis) return "0";
  try {
    return (await redis.get(genKey)) ?? "0";
  } catch {
    return "0";
  }
}

export async function bumpCacheGeneration(
  redis: Redis | undefined,
  genKey: string = DIRECTORY_CACHE_GEN_KEY,
): Promise<void> {
  if (!redis) return;
  await redis.incr(genKey).catch(() => undefined);
}

/**
 * Reads a generation-scoped Redis JSON cache entry and populates it on miss.
 * Generation bumps provide O(1) prefix invalidation without KEYS/SCAN scans.
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

  const fresh = await loader();
  await redis
    .set(fullKey, JSON.stringify(fresh), "EX", ttlSeconds)
    .catch(() => undefined);
  return fresh;
}
