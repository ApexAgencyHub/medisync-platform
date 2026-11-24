import { describe, expect, it } from "vitest";
import {
  MOROCCAN_CITIES_CATALOG,
  MOROCCAN_REGIONS,
  findMoroccanCity,
  getMoroccanCityAliasTerms,
  matchesMoroccanCity,
  searchMoroccanLocations,
} from "./morocco-places.js";

describe("Morocco national regions, cities & places catalog", () => {
  it("covers all 12 official Moroccan administrative regions with at least one city each", () => {
    expect(MOROCCAN_REGIONS).toHaveLength(12);
    for (const region of MOROCCAN_REGIONS) {
      const citiesInRegion = MOROCCAN_CITIES_CATALOG.filter(
        (c) => c.regionCode === region.code,
      );
      expect(
        citiesInRegion.length,
        `Region ${region.name} (${region.code}) must have cities`,
      ).toBeGreaterThan(0);
    }
    expect(MOROCCAN_CITIES_CATALOG.length).toBeGreaterThanOrEqual(60);
  });

  it("matches diacritic-insensitive EN/FR/AR city names and neighborhoods", () => {
    expect(findMoroccanCity("Fes")?.id).toBe("fes");
    expect(findMoroccanCity("Fès")?.id).toBe("fes");
    expect(findMoroccanCity("Tanger")?.id).toBe("tangier");
    expect(findMoroccanCity("Laayoune")?.id).toBe("laayoune");
    expect(findMoroccanCity("العيون")?.id).toBe("laayoune");
    expect(findMoroccanCity("الداخلة")?.id).toBe("dakhla");
    expect(findMoroccanCity("Beni Mellal")?.id).toBe("beni-mellal");
    expect(findMoroccanCity("Maarif")?.id).toBe("casablanca");
    expect(findMoroccanCity("Guéliz")?.id).toBe("marrakech");
    expect(findMoroccanCity("Agdal")?.id).toBe("rabat");

    expect(matchesMoroccanCity("Tétouan", "Tétouan")).toBe(true);
    expect(matchesMoroccanCity("Tetouan", "Tétouan")).toBe(true);
    expect(matchesMoroccanCity("Oujda", "Oujda")).toBe(true);
    expect(matchesMoroccanCity("Rabat", "Tangier", ["Route de Rabat, Tanger"])).toBe(false);

    const laayouneAliases = getMoroccanCityAliasTerms("Laayoune");
    expect(laayouneAliases).toContain("laayoune");
    expect(laayouneAliases).toContain("العيون");
  });

  it("searches both Moroccan cities and places/neighborhoods", () => {
    const oujdaResults = searchMoroccanLocations("Oujda", 10);
    expect(oujdaResults.some((r) => r.cityId === "oujda" && r.kind === "CITY")).toBe(true);

    const maarifResults = searchMoroccanLocations("Maarif", 10);
    expect(maarifResults[0]?.kind).toBe("PLACE");
    expect(maarifResults[0]?.cityId).toBe("casablanca");

    const dakhlaResults = searchMoroccanLocations("Dakhla", 10);
    expect(dakhlaResults.some((r) => r.cityId === "dakhla")).toBe(true);
  });
});
