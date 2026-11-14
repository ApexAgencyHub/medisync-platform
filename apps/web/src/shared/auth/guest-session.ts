"use client";

import {
  AuthResponseSchema,
  type AuthResponse,
} from "@medisync/contracts";
import { requestTyped } from "@/shared/api/http-client";
import {
  readStoredSession,
  writeStoredSession,
} from "./session-storage";

function generateEphemeralSecret(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Ensures a browser visitor has a valid PATIENT session without leaving the workflow.
 * Returns the active stored session if present, or issues an instant Guest Care Pass
 * session via `/v1/auth/register` so PostGIS dispatch and PostgreSQL slot locks remain real.
 */
export async function ensureGuestPatientSession(
  apiBaseUrl: string,
  countryCode: string,
  contactHint?: string,
): Promise<AuthResponse | null> {
  const existing = readStoredSession();
  if (existing) {
    return existing;
  }

  const trimmedHint = contactHint?.trim() ?? "";
  const fullName =
    trimmedHint.length >= 2
      ? `Guest (${trimmedHint.slice(0, 32)})`
      : "Guest Care Pass";
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const res = await requestTyped(
    `${apiBaseUrl}/v1/auth/register`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName,
        email: `guest-${token}@care.medisync.example`,
        password: `Guest-${generateEphemeralSecret()}!`,
        role: "PATIENT",
        countryCode,
      }),
    },
    AuthResponseSchema,
  );

  if (!res.ok) {
    return null;
  }

  writeStoredSession(res.data);
  return res.data;
}
