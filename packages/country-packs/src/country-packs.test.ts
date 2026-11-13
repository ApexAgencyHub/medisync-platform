import { describe, expect, it } from "vitest";
import {
  listCountryPacks,
  resolveCountryPack,
  validateFacilityLicense,
} from "./index.js";

describe("@medisync/country-packs", () => {
  it("lists validated universal and regional packs", () => {
    const packs = listCountryPacks();
    expect(packs.map((p) => p.code)).toEqual(["INTL", "MA", "FR", "US"]);
  });

  it("falls back cleanly to INTL for unknown country codes", () => {
    const unknown = resolveCountryPack("ZZ");
    expect(unknown.code).toBe("INTL");
    expect(unknown.emergencyHotlines.ambulance).toBe("112");
  });

  it("preserves RTL metadata and emergency rules per jurisdiction", () => {
    const ma = resolveCountryPack("ma");
    expect(ma.direction).toBe("rtl");
    expect(ma.emergencyHotlines.ambulance).toBe("141");
    expect(validateFacilityLicense("MA", "MA-MED-12345")).toBe(true);
    expect(validateFacilityLicense("MA", "INVALID")).toBe(false);
  });
});
