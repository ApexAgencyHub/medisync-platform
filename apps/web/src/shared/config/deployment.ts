import type { CountryPack } from "@medisync/contracts";

/**
 * Single active deployment region code.
 * Built for Morocco ("MA") by default while preserving underlying CountryPack modularity
 * so handing the codebase off to another region requires changing one configuration value.
 */
export const ACTIVE_COUNTRY_CODE: string =
  process.env.NEXT_PUBLIC_DEFAULT_COUNTRY?.trim().toUpperCase() || "MA";

/**
 * Resolves the effective country code for deployment-level UI chrome (emergency hotlines, currency, compliance).
 * Global super-admin accounts ("INTL") inherit the active regional deployment ("MA" by default)
 * instead of falling back to generic international defaults (e.g. 112 / USD).
 */
export function resolveEffectiveCountryCode(
  userCountryCode?: string | null,
): string {
  const normalized = userCountryCode?.trim().toUpperCase();
  if (!normalized || normalized === "INTL") {
    return ACTIVE_COUNTRY_CODE;
  }
  return normalized;
}

/**
 * Resolves the browser-facing API base URL passed from Next.js Server Components to Client Components.
 * NEVER uses server-only `process.env.API_URL` (e.g. Docker internal `http://api:4000`), which is
 * unreachable from end-user browsers and only belongs in server-side route handlers like `/api/backend-status`.
 */
export function resolvePublicApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  return (configured || "http://127.0.0.1:4000").replace(/\/+$/, "");
}

export function resolveActivePack(
  packs: readonly CountryPack[],
): CountryPack | null {
  return (
    packs.find((pack) => pack.code === ACTIVE_COUNTRY_CODE) ??
    packs.find((pack) => pack.code === "MA") ??
    packs[0] ??
    null
  );
}
