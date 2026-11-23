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
    urlStyle: env.S3_URL_STYLE,
  },
  runDbMigrations: true,
  seedDemoWorld:
    env.NODE_ENV !== "production" || process.env.ALLOW_DEV_SEED === "true",
  rateLimitMaxPerMinute: env.RATE_LIMIT_MAX_PER_MIN,
  authRateLimitMaxPerMinute: env.AUTH_RATE_LIMIT_MAX_PER_MIN,
  allowPublicRegistration: env.ALLOW_PUBLIC_REGISTRATION,
  requireProviderVerification: env.REQUIRE_PROVIDER_VERIFICATION,
  ...(env.GOOGLE_CLIENT_ID ? { googleClientId: env.GOOGLE_CLIENT_ID } : {}),
  dbPoolMax: env.DB_POOL_MAX,
  dbStatementTimeoutMs: env.DB_STATEMENT_TIMEOUT_MS,
  trustProxy: env.TRUST_PROXY,
  enableRequestLogs: env.ENABLE_REQUEST_LOGS,
  allowSimulatedPayments: env.ALLOW_SIMULATED_PAYMENTS,
  paymentWebhookSecret: env.PAYMENT_WEBHOOK_SECRET,
  s3AutoConfigureCors: env.S3_AUTO_CONFIGURE_CORS,
});

await server.listen({ port: env.PORT, host: env.HOST });

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await server.close();
  } finally {
    server.log.info(`MediSync API closed cleanly on ${signal}.`);
    process.exit(0);
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
