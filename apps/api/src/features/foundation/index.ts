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
  invalidateUserAuthCache,
  revokeJwtToken,
  type AuthGuardDeps,
  type AuthGuardOptions,
} from "./guard.js";
export {
  appendAuditLog,
  DuplicateConflictError,
  findUserById,
  insertUser,
} from "./store.js";
