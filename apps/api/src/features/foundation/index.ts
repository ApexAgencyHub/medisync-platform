export { registerFoundationRoutes } from "./routes.js";
export {
  hashPassword,
  signAuthToken,
  verifyAuthToken,
  verifyPassword,
  type AuthTokenClaims,
} from "./auth-crypto.js";
export {
  authenticateRequest,
  clearSessionCookie,
  invalidateUserAuthCache,
  revokeJwtToken,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  verifyLiveSessionToken,
  type AuthGuardDeps,
  type AuthGuardOptions,
} from "./guard.js";
export {
  appendAuditLog,
  DuplicateConflictError,
  findUserById,
  insertUser,
} from "./store.js";
