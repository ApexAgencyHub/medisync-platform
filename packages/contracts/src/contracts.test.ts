import { describe, expect, it } from "vitest";
import {
  CountryPackSchema,
  CreateFacilitySchema,
  DriverPingSchema,
  FacilityListQuerySchema,
  FacilityViewportQuerySchema,
  RegisterUserSchema,
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

  it("enforces self-registration privilege boundaries and facility schema limits", () => {
    const allowed = RegisterUserSchema.safeParse({
      email: "dr.amina@clinic.ma",
      password: "StrongPassword!123",
      fullName: "Dr. Amina Benali",
      role: "DOCTOR",
      countryCode: "MA",
    });
    expect(allowed.success).toBe(true);

    const escalation = RegisterUserSchema.safeParse({
      email: "attacker@clinic.ma",
      password: "StrongPassword!123",
      fullName: "System Seeker",
      role: "OPS_ADMIN",
      countryCode: "MA",
    });
    expect(escalation.success).toBe(false);

    const facilityOk = CreateFacilitySchema.safeParse({
      name: "Clinique Atlas Casablanca",
      kind: "CLINIC",
      countryCode: "MA",
      licenseNumber: "MA-CLIN-90812",
      lat: 33.5731,
      lng: -7.5898,
      address: "18 Boulevard d'Anfa, Casablanca",
    });
    expect(facilityOk.success).toBe(true);

    const facilityListTooHigh = FacilityListQuerySchema.safeParse({
      countryCode: "MA",
      limit: 200,
    });
    expect(facilityListTooHigh.success).toBe(false);
  });
});
