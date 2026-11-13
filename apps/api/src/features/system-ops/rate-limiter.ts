import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";

export interface RateLimiterOptions {
  redis: Redis;
  maxRequestsPerMinute: number;
  keyPrefix?: string;
}

export function registerApiRateLimiterHook(
  app: FastifyInstance,
  options: RateLimiterOptions,
): void {
  const windowSeconds = 60;
  const maxRequests = Math.max(1, options.maxRequestsPerMinute);
  const keyPrefix = options.keyPrefix ?? "medisync:ratelimit:ip";

  app.addHook("onRequest", async (request, reply) => {
    const pathname = request.url.split("?")[0] ?? request.url;
    if (!pathname.startsWith("/v1/")) {
      return;
    }

    const forwarded = request.headers["x-forwarded-for"];
    const clientIp =
      (typeof forwarded === "string"
        ? forwarded.split(",")[0]?.trim()
        : undefined) ??
      request.ip ??
      "unknown";

    const minuteBucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const redisKey = `${keyPrefix}:${clientIp}:${minuteBucket}`;

    try {
      const hits = await options.redis.incr(redisKey);
      if (hits === 1) {
        await options.redis.expire(redisKey, windowSeconds);
      }
      const remaining = Math.max(0, maxRequests - hits);
      reply.header("X-RateLimit-Limit", String(maxRequests));
      reply.header("X-RateLimit-Remaining", String(remaining));

      if (hits > maxRequests) {
        const ttl = await options.redis.ttl(redisKey);
        const retryAfter = ttl > 0 ? ttl : windowSeconds;
        reply.header("Retry-After", String(retryAfter));
        return reply.status(429).send({
          error: "RATE_LIMIT_EXCEEDED",
          message: `Rate limit exceeded (${maxRequests} requests/minute).`,
          retryAfterSeconds: retryAfter,
        });
      }
    } catch {
      // Fail open if Redis is temporarily unavailable so clinical ops never stall.
    }
  });
}
