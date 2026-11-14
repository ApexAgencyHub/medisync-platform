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
    .default(
      "http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3210,http://localhost:3210",
    ),
  S3_ENDPOINT: z.string().url().default("http://127.0.0.1:9010"),
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: z.string().min(1).default("medisync-clinical-media"),
  S3_ACCESS_KEY_ID: z.string().min(8).default("medisync-dev-s3-access-key"),
  S3_SECRET_ACCESS_KEY: z
    .string()
    .min(16)
    .default("medisync-dev-s3-secret-key-min-32-chars"),
  S3_PRESIGN_EXPIRES_SECONDS: z.coerce.number().int().min(60).max(86400).default(900),
  RATE_LIMIT_MAX_PER_MIN: z.coerce.number().int().min(10).max(10000).default(600),
  AUTH_RATE_LIMIT_MAX_PER_MIN: z.coerce.number().int().min(5).max(1000).default(40),
  WRITE_RATE_LIMIT_MAX_PER_MIN: z.coerce.number().int().min(10).max(5000).default(180),
  ALLOW_PUBLIC_REGISTRATION: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  REQUIRE_PROVIDER_VERIFICATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  DB_POOL_MAX: z.coerce.number().int().min(5).max(100).default(25),
  DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  ENABLE_REQUEST_LOGS: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

export function loadApiEnv(raw: NodeJS.ProcessEnv = process.env): ApiEnv {
  return ApiEnvSchema.parse(raw);
}
