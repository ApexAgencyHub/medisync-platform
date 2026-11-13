import { z } from "zod";

const ApiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().min(1).default("127.0.0.1"),
  DEFAULT_COUNTRY_CODE: z.string().regex(/^[A-Z]{2,4}$/).default("INTL"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://127.0.0.1:6380"),
  AUTH_SECRET: z.string().min(32),
  CORS_ORIGINS: z
    .string()
    .default("http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3100"),
  S3_ENDPOINT: z.string().url().default("https://s3.sovereign.medisync.local"),
  S3_REGION: z.string().min(1).default("auto"),
  S3_BUCKET: z.string().min(1).default("medisync-clinical-media"),
  S3_ACCESS_KEY_ID: z.string().min(8).default("medisync-dev-s3-access-key"),
  S3_SECRET_ACCESS_KEY: z
    .string()
    .min(16)
    .default("medisync-dev-s3-secret-key-min-32-chars"),
  S3_PRESIGN_EXPIRES_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
});

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

export function loadApiEnv(raw: NodeJS.ProcessEnv = process.env): ApiEnv {
  return ApiEnvSchema.parse(raw);
}
