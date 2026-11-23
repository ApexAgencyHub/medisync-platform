#!/usr/bin/env node
/**
 * MediSync Global — Production Environment Provisioner & Preflight Validator
 *
 * Usage:
 *   node deploy/provision-env.mjs --init --domain app.yourdomain.ma [--turn-host turn.yourdomain.ma] [--mode external-s3|self-hosted-s3] [--out .env.production] [--force]
 *   node deploy/provision-env.mjs --check [--file .env.production]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const PLACEHOLDER_REGEX =
  /(CHANGE_ME|replace-with-|medisync_dev_password|medisync-dev-s3)/i;
const FORBIDDEN_PROD_HOST_REGEX = /(localhost|127\.0\.0\.1|example\.com)/i;

export function parseEnvFileContent(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function generateProductionEnv(options) {
  const domain = options.domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    throw new Error(
      `Invalid --domain "${options.domain}". Provide a real FQDN such as app.medisync.ma.`,
    );
  }

  const turnHost = (options.turnHost || `turn.${domain}`)
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  const mode = options.mode === "self-hosted-s3" ? "self-hosted-s3" : "external-s3";
  const postgresUser = options.postgresUser || "medisync";
  const postgresPassword = crypto.randomBytes(24).toString("hex");
  const authSecret = crypto.randomBytes(32).toString("hex");
  const paymentWebhookSecret = crypto.randomBytes(24).toString("hex");
  const turnSecret = crypto.randomBytes(24).toString("hex");
  const s3AccessKey =
    mode === "self-hosted-s3"
      ? `ms${crypto.randomBytes(10).toString("hex")}`
      : options.s3AccessKey || "CHANGE_ME_S3_ACCESS_KEY";
  const s3SecretKey =
    mode === "self-hosted-s3"
      ? crypto.randomBytes(24).toString("hex")
      : options.s3SecretKey || "CHANGE_ME_S3_SECRET_MIN_32_CHARS";
  const s3Endpoint =
    options.s3Endpoint ||
    (mode === "self-hosted-s3"
      ? "http://minio:9000"
      : "https://s3.eu-west-1.amazonaws.com");
  const s3PublicEndpoint =
    options.s3PublicEndpoint || `https://media.${domain}`;
  const s3PublicDomain =
    mode === "self-hosted-s3" ? new URL(s3PublicEndpoint).hostname : "";
  const s3AutoConfigureCors = mode === "self-hosted-s3" ? "false" : "true";
  const s3Region = options.s3Region || "eu-west-1";
  const s3Bucket = options.s3Bucket || "medisync-clinical-media-prod";
  const turnExternalIp = (options.turnExternalIp || "").trim();

  const origin = `https://${domain}`;
  const turnUrlsList = [
    `turn:${turnHost}:3478?transport=udp`,
    `turn:${turnHost}:3478?transport=tcp`,
  ];
  if (options.turnTls) {
    turnUrlsList.push(`turns:${turnHost}:5349?transport=tcp`);
  }
  const turnUrls = turnUrlsList.join(",");

  const lines = [
    "# MediSync Global — Provisioned Production Environment",
    `# Generated on ${new Date().toISOString()} for ${domain}`,
    "NODE_ENV=production",
    "PORT=4000",
    "HOST=0.0.0.0",
    "TRUST_PROXY=true",
    "ENABLE_REQUEST_LOGS=true",
    "DEFAULT_COUNTRY_CODE=MA",
    "",
    "# Public Domain & Automatic HTTPS/TLS (Caddy)",
    `APP_DOMAIN=${domain}`,
    `CORS_ORIGINS=${origin}`,
    `NEXT_PUBLIC_API_URL=${origin}`,
    "NEXT_PUBLIC_DEFAULT_COUNTRY=MA",
    "",
    "# PostgreSQL + PostGIS & Redis",
    `POSTGRES_USER=${postgresUser}`,
    `POSTGRES_PASSWORD=${postgresPassword}`,
    `DATABASE_URL=postgresql://${postgresUser}:${postgresPassword}@postgres:5432/medisync`,
    "DB_POOL_MAX=35",
    "DB_STATEMENT_TIMEOUT_MS=12000",
    "REDIS_URL=redis://redis:6379",
    "",
    "# Cryptography & Session Cookies",
    `AUTH_SECRET=${authSecret}`,
    "COOKIE_SECURE=true",
    "",
    "# Object Storage (AWS S3 / Cloudflare R2 / Self-Hosted MinIO)",
    `S3_ENDPOINT=${s3Endpoint}`,
    `S3_PUBLIC_ENDPOINT=${s3PublicEndpoint}`,
    `S3_PUBLIC_DOMAIN=${s3PublicDomain}`,
    `S3_REGION=${s3Region}`,
    `S3_BUCKET=${s3Bucket}`,
    `S3_ACCESS_KEY_ID=${s3AccessKey}`,
    `S3_SECRET_ACCESS_KEY=${s3SecretKey}`,
    "S3_PRESIGN_EXPIRES_SECONDS=900",
    `S3_AUTO_CONFIGURE_CORS=${s3AutoConfigureCors}`,
    "",
    "# Telehealth WebRTC TURN/STUN Relay (coturn ephemeral HMAC-SHA1 credentials)",
    `TURN_REALM=${turnHost}`,
    `TURN_EXTERNAL_IP=${turnExternalIp}`,
    "TURN_TLS_CERT=",
    "TURN_TLS_PKEY=",
    `TELEHEALTH_TURN_URLS=${turnUrls}`,
    `TELEHEALTH_TURN_STATIC_AUTH_SECRET=${turnSecret}`,
    "TELEHEALTH_TURN_TTL_SECONDS=3600",
    "TELEHEALTH_STUN_URLS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302",
    "# Optional explicit JSON override (takes precedence over TELEHEALTH_TURN_URLS when non-empty):",
    "TELEHEALTH_ICE_SERVERS_JSON=",
    "",
    "# Regulatory & Verification Gates (NEVER enable ALLOW_DEV_SEED in production)",
    "ALLOW_PUBLIC_REGISTRATION=true",
    "REQUIRE_PROVIDER_VERIFICATION=true",
    "ENABLE_DEV_OTP_PREVIEW=false",
    "ALLOW_SIMULATED_PAYMENTS=false",
    "",
    "# External Transactional & Payment Webhooks",
    `SMTP_WEBHOOK_URL=https://notifications.${domain}/email-otp`,
    `SMS_WEBHOOK_URL=https://notifications.${domain}/sms-otp`,
    `PAYMENT_WEBHOOK_SECRET=${paymentWebhookSecret}`,
    "GOOGLE_CLIENT_ID=",
    "",
    "# Rate Limits",
    "RATE_LIMIT_MAX_PER_MIN=600",
    "AUTH_RATE_LIMIT_MAX_PER_MIN=30",
    "",
  ];

  return lines.join("\n");
}

export function validateProductionEnv(env) {
  const errors = [];
  const warnings = [];

  const required = [
    "APP_DOMAIN",
    "POSTGRES_PASSWORD",
    "DATABASE_URL",
    "REDIS_URL",
    "AUTH_SECRET",
    "CORS_ORIGINS",
    "NEXT_PUBLIC_API_URL",
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "PAYMENT_WEBHOOK_SECRET",
  ];

  for (const key of required) {
    if (!env[key] || env[key].trim().length === 0) {
      errors.push(`Missing required production variable: ${key}`);
    }
  }

  for (const [key, value] of Object.entries(env)) {
    if (value && PLACEHOLDER_REGEX.test(value)) {
      errors.push(`${key} still contains a placeholder or dev credential.`);
    }
  }

  if (env.NODE_ENV !== "production") {
    errors.push(`NODE_ENV must be "production" (got "${env.NODE_ENV ?? ""}").`);
  }
  if (env.TRUST_PROXY !== "true") {
    errors.push("TRUST_PROXY must be true behind Caddy/Nginx/Cloudflare/ALB.");
  }
  if (env.COOKIE_SECURE !== "true") {
    errors.push("COOKIE_SECURE must be true in production HTTPS deployments.");
  }
  if (env.REQUIRE_PROVIDER_VERIFICATION !== "true") {
    errors.push("REQUIRE_PROVIDER_VERIFICATION must be true in production.");
  }
  if (env.ENABLE_DEV_OTP_PREVIEW === "true") {
    errors.push("ENABLE_DEV_OTP_PREVIEW must be false in production.");
  }
  if (env.ALLOW_SIMULATED_PAYMENTS === "true") {
    errors.push("ALLOW_SIMULATED_PAYMENTS must be false in production.");
  }
  if (env.ALLOW_DEV_SEED === "true") {
    errors.push("ALLOW_DEV_SEED must never be true in production.");
  }

  if (env.AUTH_SECRET && env.AUTH_SECRET.length < 32) {
    errors.push("AUTH_SECRET must be at least 32 characters.");
  }
  if (env.POSTGRES_PASSWORD && env.POSTGRES_PASSWORD.length < 16) {
    errors.push("POSTGRES_PASSWORD must be at least 16 characters.");
  }
  if (env.PAYMENT_WEBHOOK_SECRET && env.PAYMENT_WEBHOOK_SECRET.length < 16) {
    errors.push("PAYMENT_WEBHOOK_SECRET must be at least 16 characters.");
  }
  if (env.S3_SECRET_ACCESS_KEY && env.S3_SECRET_ACCESS_KEY.length < 16) {
    errors.push("S3_SECRET_ACCESS_KEY must be at least 16 characters.");
  }

  if (env.APP_DOMAIN) {
    const appDomain = env.APP_DOMAIN.trim();
    if (appDomain !== ":80") {
      if (
        !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(appDomain) ||
        FORBIDDEN_PROD_HOST_REGEX.test(appDomain)
      ) {
        errors.push(
          `APP_DOMAIN "${appDomain}" must be a real production FQDN (not localhost or example.com) or ":80" for upstream TLS.`,
        );
      }
    }
  }

  if (env.DATABASE_URL && env.POSTGRES_PASSWORD) {
    try {
      const dbUrl = new URL(env.DATABASE_URL);
      if (decodeURIComponent(dbUrl.password) !== env.POSTGRES_PASSWORD) {
        errors.push(
          "DATABASE_URL password does not match POSTGRES_PASSWORD (PostgreSQL auth will fail).",
        );
      }
      const expectedUser = env.POSTGRES_USER || "medisync";
      if (decodeURIComponent(dbUrl.username) !== expectedUser) {
        errors.push(
          `DATABASE_URL username "${decodeURIComponent(dbUrl.username)}" does not match POSTGRES_USER "${expectedUser}".`,
        );
      }
    } catch {
      errors.push("DATABASE_URL is not a valid URL.");
    }
  }

  if (env.NEXT_PUBLIC_API_URL) {
    if (!env.NEXT_PUBLIC_API_URL.startsWith("https://")) {
      errors.push("NEXT_PUBLIC_API_URL must use https:// in production.");
    }
    if (FORBIDDEN_PROD_HOST_REGEX.test(env.NEXT_PUBLIC_API_URL)) {
      errors.push(
        "NEXT_PUBLIC_API_URL must point to your real production domain (not localhost or example.com).",
      );
    }
  }

  if (env.CORS_ORIGINS) {
    const origins = env.CORS_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (origins.length === 0) {
      errors.push("CORS_ORIGINS must include at least one HTTPS origin.");
    }
    for (const origin of origins) {
      if (!origin.startsWith("https://")) {
        errors.push(`CORS_ORIGINS entry "${origin}" must use https://.`);
      }
      if (FORBIDDEN_PROD_HOST_REGEX.test(origin)) {
        errors.push(
          `CORS_ORIGINS entry "${origin}" cannot reference localhost or example.com.`,
        );
      }
    }
  }

  // Validate TURN relay configuration (either JSON override with authenticated turn(s): or TURN_URLS + credentials)
  let hasTurn = false;
  if (env.TELEHEALTH_ICE_SERVERS_JSON && env.TELEHEALTH_ICE_SERVERS_JSON.trim()) {
    try {
      const parsed = JSON.parse(env.TELEHEALTH_ICE_SERVERS_JSON);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        errors.push(
          "TELEHEALTH_ICE_SERVERS_JSON must be a non-empty JSON array.",
        );
      } else {
        for (const srv of parsed) {
          const urls = Array.isArray(srv?.urls)
            ? srv.urls
            : typeof srv?.urls === "string"
              ? [srv.urls]
              : [];
          const hasTurnUrl = urls.some(
            (u) => typeof u === "string" && /^turns?:/i.test(u.trim()),
          );
          if (hasTurnUrl) {
            if (
              urls.some(
                (u) =>
                  typeof u === "string" &&
                  FORBIDDEN_PROD_HOST_REGEX.test(u),
              )
            ) {
              errors.push(
                "TELEHEALTH_ICE_SERVERS_JSON TURN entry cannot reference localhost or example.com.",
              );
              continue;
            }
            const hasCreds =
              typeof srv?.username === "string" &&
              srv.username.trim().length > 0 &&
              typeof srv?.credential === "string" &&
              srv.credential.trim().length > 0;
            if (!hasCreds) {
              errors.push(
                "TELEHEALTH_ICE_SERVERS_JSON TURN entry requires non-empty username and credential.",
              );
            } else {
              hasTurn = true;
            }
          }
        }
      }
    } catch {
      errors.push("TELEHEALTH_ICE_SERVERS_JSON is not valid JSON.");
    }
  } else if (env.TELEHEALTH_TURN_URLS && env.TELEHEALTH_TURN_URLS.trim()) {
    const turnUrls = env.TELEHEALTH_TURN_URLS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const hasTurnScheme = turnUrls.some((u) => /^turns?:/i.test(u));
    const hasBadHost = turnUrls.some((u) => FORBIDDEN_PROD_HOST_REGEX.test(u));
    const hasEphemeral =
      Boolean(env.TELEHEALTH_TURN_STATIC_AUTH_SECRET) &&
      env.TELEHEALTH_TURN_STATIC_AUTH_SECRET.length >= 16;
    const hasStatic =
      Boolean(env.TELEHEALTH_TURN_USERNAME) &&
      Boolean(env.TELEHEALTH_TURN_CREDENTIAL);
    if (hasBadHost) {
      errors.push(
        "TELEHEALTH_TURN_URLS cannot reference localhost or example.com.",
      );
    } else if (hasTurnScheme && (hasEphemeral || hasStatic)) {
      hasTurn = true;
    } else {
      errors.push(
        "TELEHEALTH_TURN_URLS requires turn:/turns: URLs plus TELEHEALTH_TURN_STATIC_AUTH_SECRET (>=16 chars) or TELEHEALTH_TURN_USERNAME + TELEHEALTH_TURN_CREDENTIAL.",
      );
    }
    if (
      turnUrls.some((u) => /^turns:/i.test(u)) &&
      (!env.TURN_TLS_CERT || !env.TURN_TLS_PKEY)
    ) {
      warnings.push(
        "TELEHEALTH_TURN_URLS includes turns: (port 5349), so ensure TURN_TLS_CERT and TURN_TLS_PKEY are mounted onto coturn.",
      );
    }
  }
  if (!hasTurn) {
    errors.push(
      "No TURN relay server configured (set TELEHEALTH_TURN_URLS + TELEHEALTH_TURN_STATIC_AUTH_SECRET, or TELEHEALTH_ICE_SERVERS_JSON with authenticated turn:/turns:).",
    );
  }

  if (
    env.S3_PUBLIC_ENDPOINT &&
    !env.S3_PUBLIC_ENDPOINT.startsWith("https://")
  ) {
    warnings.push(
      "S3_PUBLIC_ENDPOINT does not use https://; browsers may block mixed-content uploads/downloads.",
    );
  }
  if (
    env.S3_ENDPOINT &&
    /^http:\/\/minio:9000/i.test(env.S3_ENDPOINT.trim()) &&
    (!env.S3_PUBLIC_DOMAIN || env.S3_PUBLIC_DOMAIN.trim().length === 0)
  ) {
    warnings.push(
      "Self-hosted MinIO S3_ENDPOINT is set without S3_PUBLIC_DOMAIN; Caddy will not proxy browser presigned uploads until S3_PUBLIC_DOMAIN=media.<domain> is configured.",
    );
  }
  if (!env.SMTP_WEBHOOK_URL && !env.SMS_WEBHOOK_URL) {
    warnings.push(
      "Neither SMTP_WEBHOOK_URL nor SMS_WEBHOOK_URL is configured; OTP delivery will be inactive.",
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--init") args.init = true;
    else if (token === "--check") args.check = true;
    else if (token === "--force") args.force = true;
    else if (token === "--turn-tls") args.turnTls = true;
    else if (token === "--domain") args.domain = argv[++i];
    else if (token === "--turn-host") args.turnHost = argv[++i];
    else if (token === "--turn-external-ip") args.turnExternalIp = argv[++i];
    else if (token === "--mode") args.mode = argv[++i];
    else if (token === "--out") args.out = argv[++i];
    else if (token === "--file") args.file = argv[++i];
    else if (token === "--s3-endpoint") args.s3Endpoint = argv[++i];
    else if (token === "--s3-public-endpoint") args.s3PublicEndpoint = argv[++i];
    else if (token === "--s3-region") args.s3Region = argv[++i];
    else if (token === "--s3-bucket") args.s3Bucket = argv[++i];
  }
  return args;
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.init) {
    if (!args.domain) {
      process.stderr.write(
        "Usage: node deploy/provision-env.mjs --init --domain app.yourdomain.ma [--mode external-s3|self-hosted-s3] [--out .env.production]\n",
      );
      process.exit(1);
    }
    const outPath = path.resolve(args.out || ".env.production");
    if (fs.existsSync(outPath) && !args.force) {
      process.stderr.write(
        `Refusing to overwrite existing ${outPath}. Pass --force to replace.\n`,
      );
      process.exit(1);
    }
    const content = generateProductionEnv(args);
    fs.writeFileSync(outPath, content, { mode: 0o600, encoding: "utf8" });
    process.stdout.write(`Provisioned production env at ${outPath}\n`);
    process.exit(0);
  }

  if (args.check) {
    const targetPath = path.resolve(args.file || ".env.production");
    if (!fs.existsSync(targetPath)) {
      process.stderr.write(`Env file not found: ${targetPath}\n`);
      process.exit(1);
    }
    const parsed = parseEnvFileContent(fs.readFileSync(targetPath, "utf8"));
    const report = validateProductionEnv(parsed);
    for (const w of report.warnings) {
      process.stderr.write(`[WARN] ${w}\n`);
    }
    if (!report.ok) {
      for (const err of report.errors) {
        process.stderr.write(`[FAIL] ${err}\n`);
      }
      process.exit(1);
    }
    process.stdout.write(
      `[PASS] Production preflight verified cleanly (${targetPath}).\n`,
    );
    process.exit(0);
  }

  process.stderr.write(
    "Specify --init --domain <fqdn> or --check [--file .env.production].\n",
  );
  process.exit(1);
}
