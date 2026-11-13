export { registerFoundationRoutes } from "./routes.js";
export {
  hashPassword,
  signAuthToken,
  verifyAuthToken,
  verifyPassword,
  type AuthTokenClaims,
} from "./auth-crypto.js";
export { authenticateRequest } from "./guard.js";
export { appendAuditLog, DuplicateConflictError, findUserById } from "./store.js";
