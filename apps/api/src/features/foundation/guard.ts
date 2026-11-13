import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "@medisync/contracts";
import { verifyAuthToken, type AuthTokenClaims } from "./auth-crypto.js";

export function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  authSecret: string,
  allowedRoles?: readonly UserRole[],
): AuthTokenClaims | null {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    void reply.status(401).send({ error: "UNAUTHORIZED" });
    return null;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const claims = verifyAuthToken(token, authSecret);
  if (!claims) {
    void reply.status(401).send({ error: "INVALID_OR_EXPIRED_TOKEN" });
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(claims.role)) {
    void reply.status(403).send({ error: "FORBIDDEN_ROLE" });
    return null;
  }

  return claims;
}
