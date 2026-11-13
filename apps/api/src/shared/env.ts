import { z } from "zod";

const ApiEnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().min(1).default("127.0.0.1"),
  DEFAULT_COUNTRY_CODE: z.string().regex(/^[A-Z]{2,4}$/).default("INTL"),
});

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

export function loadApiEnv(raw: NodeJS.ProcessEnv = process.env): ApiEnv {
  return ApiEnvSchema.parse(raw);
}
