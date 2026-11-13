import { z } from "zod";

const ApiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().min(1).default("127.0.0.1"),
  DEFAULT_COUNTRY_CODE: z.string().regex(/^[A-Z]{2,4}$/).default("INTL"),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  CORS_ORIGINS: z
    .string()
    .default("http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3100"),
});

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

export function loadApiEnv(raw: NodeJS.ProcessEnv = process.env): ApiEnv {
  return ApiEnvSchema.parse(raw);
}
