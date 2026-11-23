import type { FastifyReply, FastifyRequest } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import {
  isStaffWorkerRole,
  type AccountStatus,
  type UserRole,
} from "@medisync/contracts";
import { verifyAuthToken, type AuthTokenClaims } from "./auth-crypto.js";
import { readOptionalEnvBool } from "../../shared/env.js";

export const SESSION_COOKIE_NAME = "medisync_session";
const SESSION_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export function setSessionCookie(reply: FastifyReply, token: string): void {
  const secure =
    readOptionalEnvBool("COOKIE_SECURE") ??
    process.env.NODE_ENV === "production";
  if (typeof reply.setCookie === "function") {
    reply.setCookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      maxAge: SESSION_COOKIE_MAX_AGE_SEC,
    });
  }
}

export function clearSessionCookie(reply: FastifyReply): void {
  const secure =
    readOptionalEnvBool("COOKIE_SECURE") ??
    process.env.NODE_ENV === "production";
  if (typeof reply.clearCookie === "function") {
    reply.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
    });
  }
}

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
  preFetchedRaw?: string | null,
): Promise<CachedUserAuthState | null> {
  if (preFetchedRaw) {
    try {
      return JSON.parse(preFetchedRaw) as CachedUserAuthState;
    } catch {
      // Fall through to Redis/DB read if cached JSON is malformed.
    }
  } else if (preFetchedRaw === undefined && redis) {
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

export async function verifyLiveSessionToken(
  token: string,
  deps: AuthGuardDeps,
  options?: AuthGuardOptions,
): Promise<
  | { ok: true; claims: AuthTokenClaims }
  | { ok: false; status: 401 | 403; error: string; message?: string }
> {
  const claims = verifyAuthToken(token, deps.authSecret);
  if (!claims) {
    return { ok: false, status: 401, error: "INVALID_OR_EXPIRED_TOKEN" };
  }

  let prefetchedAuthStateRaw: string | null | undefined = undefined;
  if (deps.redis && claims.jti && deps.pool) {
    try {
      const [revoked, cachedState] = await deps.redis.mget(
        revokedJwtCacheKey(claims.jti),
        authStateCacheKey(claims.sub),
      );
      if (revoked) {
        return { ok: false, status: 401, error: "TOKEN_REVOKED" };
      }
      prefetchedAuthStateRaw = cachedState ?? null;
    } catch {
      // Fall through cleanly on transient Redis error.
    }
  } else if (deps.redis && claims.jti) {
    try {
      const revoked = await deps.redis.get(revokedJwtCacheKey(claims.jti));
      if (revoked) {
        return { ok: false, status: 401, error: "TOKEN_REVOKED" };
      }
    } catch {
      // Fall through cleanly.
    }
  }

  if (deps.pool) {
    const liveState = await resolveLiveUserAuthState(
      claims.sub,
      deps.pool,
      deps.redis,
      prefetchedAuthStateRaw,
    );
    if (!liveState) {
      return { ok: false, status: 401, error: "ACCOUNT_NOT_FOUND" };
    }
    if (liveState.accountStatus === "SUSPENDED") {
      return {
        ok: false,
        status: 403,
        error: "ACCOUNT_SUSPENDED",
        message: "This account has been suspended by an administrator.",
      };
    }
    if (liveState.tokenVersion !== claims.ver) {
      return {
        ok: false,
        status: 401,
        error: "SESSION_INVALIDATED",
        message: "Session credentials changed. Please sign in again.",
      };
    }
    claims.role = liveState.role;
    claims.countryCode = liveState.countryCode;
    claims.facilityId = liveState.facilityId;
    claims.accountStatus = liveState.accountStatus;
    claims.credentialVerified = liveState.credentialVerified;
  }

  if (
    options?.requireVerifiedProvider &&
    isStaffWorkerRole(claims.role) &&
    (!claims.credentialVerified || claims.accountStatus === "PENDING_APPROVAL")
  ) {
    return {
      ok: false,
      status: 403,
      error: "PROVIDER_VERIFICATION_REQUIRED",
      message:
        "Your professional account is pending OPS_ADMIN verification before accessing clinical or dispatch workflows.",
    };
  }

  return { ok: true, claims };
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
  const cookieToken =
    request.cookies && typeof request.cookies[SESSION_COOKIE_NAME] === "string"
      ? request.cookies[SESSION_COOKIE_NAME]
      : undefined;

  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length).trim();
  } else if (cookieToken && cookieToken.trim().length > 0) {
    token = cookieToken.trim();
  } else {
    void reply.status(401).send({ error: "MISSING_OR_INVALID_TOKEN" });
    return null;
  }

  const claims = verifyAuthToken(token, deps.authSecret);
  if (!claims) {
    void reply.status(401).send({ error: "INVALID_OR_EXPIRED_TOKEN" });
    return null;
  }

  let prefetchedAuthStateRaw: string | null | undefined = undefined;
  if (deps.redis && claims.jti && deps.pool) {
    try {
      const [revoked, cachedState] = await deps.redis.mget(
        revokedJwtCacheKey(claims.jti),
        authStateCacheKey(claims.sub),
      );
      if (revoked) {
        void reply.status(401).send({ error: "TOKEN_REVOKED" });
        return null;
      }
      prefetchedAuthStateRaw = cachedState ?? null;
    } catch {
      // Do not fail open/close arbitrarily on transient cache error.
    }
  } else if (deps.redis && claims.jti) {
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
      prefetchedAuthStateRaw,
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
    claims.accountStatus = liveState.accountStatus;
    claims.credentialVerified = liveState.credentialVerified;
  }

  if (allowedRoles && !allowedRoles.includes(claims.role)) {
    void reply.status(403).send({ error: "INSUFFICIENT_ROLE" });
    return null;
  }

  if (
    options?.requireVerifiedProvider &&
    isStaffWorkerRole(claims.role) &&
    (!claims.credentialVerified || claims.accountStatus === "PENDING_APPROVAL")
  ) {
    void reply.status(403).send({
      error: "PROVIDER_VERIFICATION_REQUIRED",
      message:
        "Staff accounts require administrator credential verification before performing operational, clinical, pharmacy, lab, or dispatch actions.",
    });
    return null;
  }

  return claims;
}
