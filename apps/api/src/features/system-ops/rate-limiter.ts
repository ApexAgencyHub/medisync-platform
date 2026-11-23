import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";

export interface RateLimiterOptions {
  redis: Redis;
  maxRequestsPerMinute: number;
  authMaxRequestsPerMinute?: number;
  keyPrefix?: string;
}

const ATOMIC_INCR_EXPIRE_LUA = `
local current = redis.call("INCR", KEYS[1])
local ttl = redis.call("TTL", KEYS[1])
if current == 1 or ttl < 0 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

function isAuthSensitiveRoute(method: string, urlPath: string): boolean {
  if (method !== "POST") return false;
  return (
    urlPath === "/v1/auth/login" ||
    urlPath === "/v1/auth/register" ||
    urlPath === "/v1/auth/password-reset" ||
    urlPath === "/v1/auth/change-password" ||
    urlPath === "/v1/auth/phone/request-otp" ||
    urlPath === "/v1/auth/phone/verify-otp" ||
    urlPath === "/v1/auth/google" ||
    urlPath.startsWith("/v1/auth/verification/")
  );
}

async function consumeBucket(
  redis: Redis,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ count: number; ttlSeconds: number; exceeded: boolean }> {
  const res = (await redis.eval(
    ATOMIC_INCR_EXPIRE_LUA,
    1,
    key,
    String(windowSeconds),
  )) as [number | string, number | string];

  const count = Number(res[0] ?? 1);
  const rawTtl = Number(res[1] ?? windowSeconds);
  const ttlSeconds = rawTtl > 0 ? rawTtl : windowSeconds;
  return {
    count,
    ttlSeconds,
    exceeded: count > limit,
  };
}

export function registerApiRateLimiterHook(
  app: FastifyInstance,
  options: RateLimiterOptions,
): void {
  const prefix = options.keyPrefix ?? "medisync:ratelimit";
  const generalMaxPerMinute = Math.max(1, options.maxRequestsPerMinute);
  const authMaxPerMinute = Math.max(
    1,
    options.authMaxRequestsPerMinute ??
      Math.min(generalMaxPerMinute, 40),
  );

  app.addHook("onRequest", async (request, reply) => {
    const rawUrl = request.url;
    const urlPath = rawUrl.split("?")[0] ?? rawUrl;
    if (!urlPath.startsWith("/v1/")) {
      return;
    }

    const clientIp = (request.ip || "127.0.0.1").replace(/[^a-zA-Z0-9.:_-]/g, "_");
    const generalKey = `${prefix}:${clientIp}`;

    try {
      // Stricter sub-bucket for authentication & credential recovery endpoints
      if (isAuthSensitiveRoute(request.method, urlPath)) {
        const authKey = `${prefix}:auth:${clientIp}`;
        const authResult = await consumeBucket(
          options.redis,
          authKey,
          authMaxPerMinute,
          60,
        );
        if (authResult.exceeded) {
          reply.header("x-ratelimit-tier", "auth");
          reply.header("x-ratelimit-limit", String(authMaxPerMinute));
          reply.header("x-ratelimit-remaining", "0");
          reply.header("retry-after", String(authResult.ttlSeconds));
          return reply.status(429).send({
            error: "AUTH_RATE_LIMIT_EXCEEDED",
            message:
              "Too many authentication attempts. Please retry after the cooldown.",
            retryAfterSeconds: authResult.ttlSeconds,
          });
        }
      }

      const result = await consumeBucket(
        options.redis,
        generalKey,
        generalMaxPerMinute,
        60,
      );
      const remaining = Math.max(0, generalMaxPerMinute - result.count);
      reply.header("x-ratelimit-limit", String(generalMaxPerMinute));
      reply.header("x-ratelimit-remaining", String(remaining));
      reply.header("x-ratelimit-reset", String(result.ttlSeconds));

      if (result.exceeded) {
        reply.header("retry-after", String(result.ttlSeconds));
        return reply.status(429).send({
          error: "RATE_LIMIT_EXCEEDED",
          message:
            "Too many requests from this IP. Please slow down and retry shortly.",
          retryAfterSeconds: result.ttlSeconds,
        });
      }
    } catch {
      // Fail-open so temporary Redis hiccups never block live clinical operations.
    }
  });
}
