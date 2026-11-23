"use client";

import {
  AuthResponseSchema,
  PHONE_NUMBER_REGEX,
  type AuthResponse,
} from "@medisync/contracts";
import { requestTyped } from "@/shared/api/http-client";
import {
  readStoredSession,
  writeStoredSession,
} from "./session-storage";

export interface GuestContactDetails {
  fullName: string;
  phone: string;
}

export type GuestSessionResult =
  | { ok: true; session: AuthResponse }
  | {
      ok: false;
      code: "INVALID_CONTACT" | "PHONE_ALREADY_REGISTERED" | "UNAVAILABLE";
      message: string;
    };

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
 * Unauthenticated guests must supply their real full name and phone number so clinicians
 * can contact them on /clinical; never mints anonymous placeholder accounts.
 */
export async function ensureGuestPatientSession(
  apiBaseUrl: string,
  countryCode: string,
  contact?: GuestContactDetails,
): Promise<GuestSessionResult> {
  const existing = readStoredSession();
  if (existing) {
    return { ok: true, session: existing };
  }

  const trimmedName = contact?.fullName.trim() ?? "";
  const trimmedPhone = contact?.phone.trim() ?? "";
  if (trimmedName.length < 2 || !PHONE_NUMBER_REGEX.test(trimmedPhone)) {
    return {
      ok: false,
      code: "INVALID_CONTACT",
      message:
        "Please provide your full name and a valid phone number so the practitioner can contact you.",
    };
  }

  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const res = await requestTyped(
    `${apiBaseUrl}/v1/auth/register`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: trimmedName.slice(0, 120),
        phone: trimmedPhone,
        email: `guest-${token}@care.medisync.example`,
        password: `Guest-${generateEphemeralSecret()}!`,
        role: "PATIENT",
        countryCode,
      }),
    },
    AuthResponseSchema,
  );

  if (!res.ok) {
    if (res.status === 409) {
      return {
        ok: false,
        code: "PHONE_ALREADY_REGISTERED",
        message:
          "This phone number already belongs to a registered patient account. Please sign in via Portal or enter another number.",
      };
    }
    return {
      ok: false,
      code: "UNAVAILABLE",
      message:
        res.error ||
        "Unable to register your guest booking session with the backend service.",
    };
  }

  writeStoredSession(res.data);
  return { ok: true, session: res.data };
}
