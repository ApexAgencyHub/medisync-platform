import { buildApiServer } from "./server.js";
import { loadApiEnv } from "./shared/env.js";

const env = loadApiEnv();
const server = await buildApiServer({
  databaseUrl: env.DATABASE_URL,
  redisUrl: env.REDIS_URL,
  authSecret: env.AUTH_SECRET,
  corsOrigins: env.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  runDbMigrations: true,
});

await server.listen({ port: env.PORT, host: env.HOST });
