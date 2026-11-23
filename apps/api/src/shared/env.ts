import { z } from "zod";
import { TelehealthIceServerSchema } from "@medisync/contracts";

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalTrimmedString = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

const optionalTrimmedUrl = z.preprocess(
  emptyToUndefined,
  z.string().trim().url().optional(),
);

const optionalBooleanFlag = z.preprocess(
  emptyToUndefined,
  z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
);

const optionalIceServersJson = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .refine(
      (raw) => {
        try {
          const parsed = z
            .array(TelehealthIceServerSchema)
            .min(1)
            .safeParse(JSON.parse(raw));
          return parsed.success;
        } catch {
          return false;
        }
      },
      {
        message:
          "TELEHEALTH_ICE_SERVERS_JSON must be a valid non-empty JSON array of ICE server objects.",
      },
    )
    .optional(),
);

const PLACEHOLDER_SECRET_PATTERN =
  /(CHANGE_ME|replace-with-|medisync_dev_password|medisync-dev-s3)/i;

const ApiEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
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
    S3_PUBLIC_ENDPOINT: optionalTrimmedUrl,
    S3_REGION: z.string().min(1).default("us-east-1"),
    S3_BUCKET: z.string().min(1).default("medisync-clinical-media"),
    S3_ACCESS_KEY_ID: z.string().min(8).default("medisync-dev-s3-access-key"),
    S3_SECRET_ACCESS_KEY: z
      .string()
      .min(16)
      .default("medisync-dev-s3-secret-key-min-32-chars"),
    S3_PRESIGN_EXPIRES_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(86400)
      .default(900),
    S3_URL_STYLE: z.enum(["path", "virtual-host"]).default("path"),
    S3_AUTO_CONFIGURE_CORS: optionalBooleanFlag,
    RATE_LIMIT_MAX_PER_MIN: z.coerce
      .number()
      .int()
      .min(10)
      .max(10000)
      .default(600),
    AUTH_RATE_LIMIT_MAX_PER_MIN: z.coerce
      .number()
      .int()
      .min(5)
      .max(1000)
      .default(40),
    WRITE_RATE_LIMIT_MAX_PER_MIN: z.coerce
      .number()
      .int()
      .min(10)
      .max(5000)
      .default(180),
    ALLOW_PUBLIC_REGISTRATION: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    REQUIRE_PROVIDER_VERIFICATION: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    GOOGLE_CLIENT_ID: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(10).optional(),
    ),
    DB_POOL_MAX: z.coerce.number().int().min(5).max(100).default(25),
    DB_STATEMENT_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(60000)
      .default(15000),
    TRUST_PROXY: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    ENABLE_REQUEST_LOGS: z.preprocess(
      emptyToUndefined,
      z
        .enum(["true", "false"])
        .optional()
        .transform((value) => value === "true"),
    ),
    ALLOW_SIMULATED_PAYMENTS: optionalBooleanFlag,
    ENABLE_DEV_OTP_PREVIEW: optionalBooleanFlag,
    COOKIE_SECURE: optionalBooleanFlag,
    SMTP_WEBHOOK_URL: optionalTrimmedUrl,
    SMS_WEBHOOK_URL: optionalTrimmedUrl,
    PAYMENT_WEBHOOK_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(16).optional(),
    ),
    TELEHEALTH_ICE_SERVERS_JSON: optionalIceServersJson,
    TELEHEALTH_STUN_URLS: optionalTrimmedString,
    TELEHEALTH_TURN_URLS: optionalTrimmedString,
    TELEHEALTH_TURN_STATIC_AUTH_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(16).optional(),
    ),
    TELEHEALTH_TURN_USERNAME: optionalTrimmedString,
    TELEHEALTH_TURN_CREDENTIAL: optionalTrimmedString,
    TELEHEALTH_TURN_TTL_SECONDS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(60).max(86400).optional(),
    ),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    const secretFields: Array<[keyof typeof env, string | undefined]> = [
      ["AUTH_SECRET", env.AUTH_SECRET],
      ["DATABASE_URL", env.DATABASE_URL],
      ["S3_ACCESS_KEY_ID", env.S3_ACCESS_KEY_ID],
      ["S3_SECRET_ACCESS_KEY", env.S3_SECRET_ACCESS_KEY],
      ["PAYMENT_WEBHOOK_SECRET", env.PAYMENT_WEBHOOK_SECRET],
      [
        "TELEHEALTH_TURN_STATIC_AUTH_SECRET",
        env.TELEHEALTH_TURN_STATIC_AUTH_SECRET,
      ],
      ["TELEHEALTH_TURN_CREDENTIAL", env.TELEHEALTH_TURN_CREDENTIAL],
    ];
    for (const [field, value] of secretFields) {
      if (value && PLACEHOLDER_SECRET_PATTERN.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} contains an unprovisioned placeholder or dev credential in NODE_ENV=production.`,
        });
      }
    }
  });

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

/**
 * Safely reads an optional string env variable, treating blank/whitespace values as undefined.
 */
export function readOptionalEnvString(
  name: string,
  raw: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const val = raw[name];
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Safely reads an optional boolean env flag ("true"/"false"), treating blank values as undefined
 * so empty `KEY=` lines in `.env.production` never override secure defaults.
 */
export function readOptionalEnvBool(
  name: string,
  raw: NodeJS.ProcessEnv = process.env,
): boolean | undefined {
  const val = readOptionalEnvString(name, raw);
  if (val === "true") return true;
  if (val === "false") return false;
  return undefined;
}

export function loadApiEnv(raw: NodeJS.ProcessEnv = process.env): ApiEnv {
  return ApiEnvSchema.parse(raw);
}
