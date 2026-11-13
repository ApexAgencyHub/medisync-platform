import { describe, expect, it } from "vitest";
import {
  CountryPackSchema,
  DriverPingSchema,
  FacilityViewportQuerySchema,
  UserRoleSchema,
} from "./index.js";

describe("@medisync/contracts", () => {
  it("supports all 9 ecosystem roles", () => {
    expect(UserRoleSchema.options).toHaveLength(9);
    expect(UserRoleSchema.parse("PHARMACIST")).toBe("PHARMACIST");
    expect(UserRoleSchema.parse("OPS_ADMIN")).toBe("OPS_ADMIN");
  });

  it("caps spatial viewport queries to max 100 rows", () => {
    const valid = FacilityViewportQuerySchema.parse({
      countryCode: "MA",
      minLng: -7.7,
      minLat: 33.4,
      maxLng: -7.4,
      maxLat: 33.7,
    });
    expect(valid.limit).toBe(50);

    const overLimit = FacilityViewportQuerySchema.safeParse({
      countryCode: "MA",
      minLng: -7.7,
      minLat: 33.4,
      maxLng: -7.4,
      maxLat: 33.7,
      limit: 500,
    });
    expect(overLimit.success).toBe(false);
  });

  it("validates driver telemetry coordinates and country packs", () => {
    const ping = DriverPingSchema.parse({
      driverId: "drv_1",
      countryCode: "INTL",
      lat: 33.5731,
      lng: -7.5898,
      status: "AVAILABLE",
      recordedAtIso: "2026-11-13T17:00:00.000Z",
    });
    expect(ping.status).toBe("AVAILABLE");

    const pack = CountryPackSchema.parse({
      code: "US",
      name: "United States",
      defaultLocale: "en-US",
      supportedLocales: ["en-US", "es-US"],
      direction: "ltr",
      currencyCode: "USD",
      timezone: "America/New_York",
      emergencyHotlines: { ambulance: "911", generalEmergency: "911" },
      measurementSystem: "imperial",
      licenseNumberPattern: "^[A-Z0-9-]{6,20}$",
      dataResidencyRegion: "us-east",
    });
    expect(pack.code).toBe("US");
  });
});
