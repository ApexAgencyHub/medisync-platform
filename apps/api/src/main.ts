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
  s3Config: {
    endpoint: env.S3_ENDPOINT,
    ...(env.S3_PUBLIC_ENDPOINT ? { publicEndpoint: env.S3_PUBLIC_ENDPOINT } : {}),
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    expiresInSeconds: env.S3_PRESIGN_EXPIRES_SECONDS,
  },
  runDbMigrations: true,
  seedDemoWorld:
    env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_SEED === "true",
  rateLimitMaxPerMinute: env.RATE_LIMIT_MAX_PER_MIN,
});

await server.listen({ port: env.PORT, host: env.HOST });
