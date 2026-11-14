import type { FastifyReply, FastifyRequest } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import type { AccountStatus, UserRole } from "@medisync/contracts";
import { verifyAuthToken, type AuthTokenClaims } from "./auth-crypto.js";

export interface AuthGuardDeps {
  authSecret: string;
  pool?: Pool | undefined;
  redis?: Redis | undefined;
}

export interface AuthGuardOptions {
  requireVerifiedProvider?: boolean | undefined;
}

interface CachedUserAuthState {
  accountStatus: AccountStatus;
  tokenVersion: number;
  credentialVerified: boolean;
  role: UserRole;
  countryCode: string;
  facilityId: string | null;
}

const AUTH_STATE_CACHE_TTL_SEC = 120;

export function authStateCacheKey(userId: string): string {
  return `medisync:auth:state:${userId}`;
}

export function revokedJwtCacheKey(jti: string): string {
  return `medisync:auth:revoked:${jti}`;
}

export async function invalidateUserAuthCache(
  redis: Redis | undefined,
  userId: string,
): Promise<void> {
  if (!redis) return;
  await redis.del(authStateCacheKey(userId)).catch(() => undefined);
}

export async function revokeJwtToken(
  redis: Redis | undefined,
  claims: Pick<AuthTokenClaims, "jti" | "exp">,
): Promise<void> {
  if (!redis || !claims.jti) return;
  const remainingSec = Math.max(1, claims.exp - Math.floor(Date.now() / 1000));
  await redis
    .set(revokedJwtCacheKey(claims.jti), "1", "EX", remainingSec)
    .catch(() => undefined);
}

async function resolveLiveUserAuthState(
  userId: string,
  pool: Pool | undefined,
  redis: Redis | undefined,
): Promise<CachedUserAuthState | null> {
  if (redis) {
    try {
      const cachedRaw = await redis.get(authStateCacheKey(userId));
      if (cachedRaw) {
        return JSON.parse(cachedRaw) as CachedUserAuthState;
      }
    } catch {
      // Fallback safely to PostgreSQL when Redis read is unavailable.
    }
  }

  if (!pool) return null;

  const res = await pool.query<{
    accountStatus: AccountStatus;
    tokenVersion: number;
    credentialVerified: boolean;
    role: UserRole;
    countryCode: string;
    facilityId: string | null;
  }>(
    `SELECT
       account_status AS "accountStatus",
       token_version AS "tokenVersion",
       credential_verified AS "credentialVerified",
       role,
       country_code AS "countryCode",
       facility_id AS "facilityId"
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );

  const row = res.rows[0];
  if (!row) return null;

  if (redis) {
    await redis
      .set(
        authStateCacheKey(userId),
        JSON.stringify(row),
        "EX",
        AUTH_STATE_CACHE_TTL_SEC,
      )
      .catch(() => undefined);
  }

  return row;
}

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  depsOrSecret: string | AuthGuardDeps,
  allowedRoles?: readonly UserRole[],
  options?: AuthGuardOptions,
): Promise<AuthTokenClaims | null> {
  const deps: AuthGuardDeps =
    typeof depsOrSecret === "string"
      ? { authSecret: depsOrSecret }
      : depsOrSecret;

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    void reply.status(401).send({ error: "MISSING_OR_INVALID_TOKEN" });
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const claims = verifyAuthToken(token, deps.authSecret);
  if (!claims) {
    void reply.status(401).send({ error: "INVALID_OR_EXPIRED_TOKEN" });
    return null;
  }

  if (deps.redis && claims.jti) {
    try {
      const revoked = await deps.redis.get(revokedJwtCacheKey(claims.jti));
      if (revoked) {
        void reply.status(401).send({ error: "TOKEN_REVOKED" });
        return null;
      }
    } catch {
      // Do not fail open/close arbitrarily on transient cache error.
    }
  }

  if (deps.pool) {
    const liveState = await resolveLiveUserAuthState(
      claims.sub,
      deps.pool,
      deps.redis,
    );
    if (!liveState) {
      void reply.status(401).send({ error: "ACCOUNT_NOT_FOUND" });
      return null;
    }
    if (liveState.accountStatus === "SUSPENDED") {
      void reply.status(403).send({
        error: "ACCOUNT_SUSPENDED",
        message: "This account has been suspended by an administrator.",
      });
      return null;
    }
    if (liveState.tokenVersion !== claims.ver) {
      void reply.status(401).send({
        error: "SESSION_INVALIDATED",
        message: "Session credentials changed. Please sign in again.",
      });
      return null;
    }
    claims.role = liveState.role;
    claims.countryCode = liveState.countryCode;
    claims.facilityId = liveState.facilityId;
    claims.credentialVerified = liveState.credentialVerified;
  }

  if (allowedRoles && !allowedRoles.includes(claims.role)) {
    void reply.status(403).send({ error: "INSUFFICIENT_ROLE" });
    return null;
  }

  if (
    options?.requireVerifiedProvider &&
    (claims.role === "DOCTOR" || claims.role === "DRIVER") &&
    !claims.credentialVerified
  ) {
    void reply.status(403).send({
      error: "PROVIDER_VERIFICATION_REQUIRED",
      message:
        "Practitioner or driver credentials must be reviewed and approved by OPS_ADMIN before performing clinical or dispatch operations.",
    });
    return null;
  }

  return claims;
}
