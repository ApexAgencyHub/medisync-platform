import { AuthResponseSchema, type AuthResponse } from "@medisync/contracts";

const SESSION_STORAGE_KEY = "medisync.session.v1";
export const SESSION_CHANGE_EVENT = "medisync:session-changed";

let cachedRawSession: string | null | undefined = undefined;
let cachedParsedSession: AuthResponse | null = null;

export function readStoredSession(): AuthResponse | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === cachedRawSession) {
      return cachedParsedSession;
    }
    cachedRawSession = raw;
    if (!raw) {
      cachedParsedSession = null;
      return null;
    }
    const parsed = AuthResponseSchema.safeParse(JSON.parse(raw));
    cachedParsedSession = parsed.success ? parsed.data : null;
    return cachedParsedSession;
  } catch {
    cachedRawSession = undefined;
    cachedParsedSession = null;
    return null;
  }
}

export function writeStoredSession(session: AuthResponse): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const serialized = JSON.stringify(session);
    window.localStorage.setItem(SESSION_STORAGE_KEY, serialized);
    cachedRawSession = serialized;
    cachedParsedSession = session;
    window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
  } catch {
    // Ignore storage quota / private mode restrictions
  }
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    cachedRawSession = null;
    cachedParsedSession = null;
    window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Revokes the current JWT on the backend (Redis blacklist + HttpOnly cookie clear
 * + USER_LOGOUT audit log) and clears local browser session storage cleanly.
 */
export function revokeClientSession(apiBaseUrl?: string): void {
  const existing = readStoredSession();
  clearStoredSession();
  if (typeof window === "undefined") {
    return;
  }
  const base = (
    apiBaseUrl ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4000"
  ).replace(/\/+$/, "");
  const headers: Record<string, string> = {};
  if (existing?.token) {
    headers.authorization = `Bearer ${existing.token}`;
  }
  void fetch(`${base}/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers,
    keepalive: true,
  }).catch(() => undefined);
}
