import type { CountryPack } from "@medisync/contracts";

/**
 * Single active deployment region code.
 * Built for Morocco ("MA") by default while preserving underlying CountryPack modularity
 * so handing the codebase off to another region requires changing one configuration value.
 */
export const ACTIVE_COUNTRY_CODE: string =
  process.env.NEXT_PUBLIC_DEFAULT_COUNTRY?.trim().toUpperCase() || "MA";

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
