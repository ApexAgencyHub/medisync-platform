import { runMigrations } from "./migrate.js";
import { createDbPool } from "./pool.js";
import { createRedisClient } from "../redis/client.js";
import { loadApiEnv } from "../env.js";
import { seedRealisticWorld } from "../../features/directory/index.js";

const env = loadApiEnv();
const pool = createDbPool(env.DATABASE_URL);
const redis = createRedisClient(env.REDIS_URL);

try {
  await runMigrations(pool);
  const result = await seedRealisticWorld(pool, redis, env.AUTH_SECRET);
  process.stdout.write(`Seeded MediSync world: ${JSON.stringify(result)}\n`);
} finally {
  await redis.quit().catch(() => undefined);
  await pool.end();
}
