import crypto from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import { UserRoleSchema, type UserRole } from "@medisync/contracts";

const scryptAsync = promisify(crypto.scrypt);
const TOKEN_TTL_SECONDS = 60 * 60 * 12;

const TokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
  countryCode: z.string().regex(/^[A-Z]{2,4}$/),
  facilityId: z.string().uuid().nullable(),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type AuthTokenClaims = z.infer<typeof TokenPayloadSchema>;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split(":");
  const salt = parts[0];
  const expectedHex = parts[1];
  if (!salt || !expectedHex) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  if (expected.length !== derived.length) return false;

  return crypto.timingSafeEqual(expected, derived);
}

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

export function signAuthToken(
  user: {
    id: string;
    email: string;
    role: UserRole;
    countryCode: string;
    facilityId: string | null;
  },
  secret: string,
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      countryCode: user.countryCode,
      facilityId: user.facilityId,
      iat: nowSec,
      exp: nowSec + TOKEN_TTL_SECONDS,
    }),
  );

  const sig = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest();

  return `${header}.${payload}.${toBase64Url(sig)}`;
}

export function verifyAuthToken(
  token: string,
  secret: string,
): AuthTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, sigPart] = parts;
  if (!header || !payload || !sigPart) return null;

  const expectedSig = toBase64Url(
    crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest(),
  );

  const a = Buffer.from(sigPart);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const raw = JSON.parse(fromBase64Url(payload)) as unknown;
    const claims = TokenPayloadSchema.safeParse(raw);
    if (!claims.success) return null;
    if (claims.data.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims.data;
  } catch {
    return null;
  }
}
