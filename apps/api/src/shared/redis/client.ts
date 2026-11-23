import { Redis } from "ioredis";

export function createRedisClient(redisUrl: string): Redis {
  const client = new Redis(redisUrl, {
    family: 0,
    maxRetriesPerRequest: 3,
    connectTimeout: 5_000,
    commandTimeout: 3_000,
    enableReadyCheck: true,
    retryStrategy(times) {
      return Math.min(times * 100, 2_000);
    },
  });

  // Prevent unhandled socket 'error' events from crashing API workers during brief reconnects.
  client.on("error", () => undefined);
  return client;
}
