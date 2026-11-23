import crypto from "node:crypto";
import type { AccountStatus, UserRole } from "@medisync/contracts";

export interface AuthTokenClaims {
  sub: string;
  role: UserRole;
  countryCode: string;
  facilityId: string | null;
  email: string | null;
  phone?: string;
  jti: string;
  ver: number;
  accountStatus?: AccountStatus;
  credentialVerified?: boolean;
  iat: number;
  exp: number;
}

const SCRYPT_KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split(":");
  let salt: string | undefined;
  let hexDigest: string | undefined;

  if (parts.length === 3 && parts[0] === "scrypt") {
    [, salt, hexDigest] = parts;
  } else if (parts.length === 2) {
    [salt, hexDigest] = parts;
  } else {
    return false;
  }

  if (!salt || !hexDigest) {
    return false;
  }
  const expectedBuf = Buffer.from(hexDigest, "hex");
  if (expectedBuf.length === 0) {
    return false;
  }
  const derivedBuf = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, expectedBuf.length, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  if (derivedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derivedBuf, expectedBuf);
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

export function signAuthToken(
  payload: {
    sub: string;
    role: UserRole;
    countryCode: string;
    facilityId: string | null;
    email: string | null;
    phone?: string | null;
    ver?: number;
  },
  secret: string,
  ttlSeconds = 60 * 60 * 12,
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const claims: AuthTokenClaims = {
    sub: payload.sub,
    role: payload.role,
    countryCode: payload.countryCode,
    facilityId: payload.facilityId,
    email: payload.email,
    ...(payload.phone ? { phone: payload.phone } : {}),
    jti: crypto.randomUUID(),
    ver: payload.ver ?? 1,
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };

  const headerPart = encodeBase64Url(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  );
  const payloadPart = encodeBase64Url(JSON.stringify(claims));
  const signingInput = `${headerPart}.${payloadPart}`;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(signingInput, "utf8")
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${sig}`;
}

export function verifyAuthToken(
  token: string,
  secret: string,
): AuthTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [headerPart, payloadPart, providedSig] = parts;
  if (!headerPart || !payloadPart || !providedSig) {
    return null;
  }

  const signingInput = `${headerPart}.${payloadPart}`;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(signingInput, "utf8")
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const header = JSON.parse(decodeBase64Url(headerPart)) as {
      alg?: unknown;
      typ?: unknown;
    };
    if (header.alg !== "HS256" || header.typ !== "JWT") {
      return null;
    }
    const parsed = JSON.parse(decodeBase64Url(payloadPart)) as Partial<AuthTokenClaims>;
    if (
      !parsed.sub ||
      !parsed.role ||
      !parsed.countryCode ||
      parsed.email === undefined ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (parsed.exp <= nowSec) {
      return null;
    }
    return {
      sub: parsed.sub,
      role: parsed.role,
      countryCode: parsed.countryCode,
      facilityId: parsed.facilityId ?? null,
      email: parsed.email ?? null,
      ...(typeof parsed.phone === "string" ? { phone: parsed.phone } : {}),
      jti: typeof parsed.jti === "string" ? parsed.jti : "",
      ver: typeof parsed.ver === "number" ? parsed.ver : 1,
      iat: typeof parsed.iat === "number" ? parsed.iat : nowSec,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}
