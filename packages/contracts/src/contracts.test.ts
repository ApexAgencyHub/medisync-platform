import { describe, expect, it } from "vitest";
import {
  CountryPackSchema,
  CreateAppointmentSchema,
  CreateDispatchRequestSchema,
  CreateFacilitySchema,
  CreateScheduleSchema,
  DriverPingSchema,
  FacilityListQuerySchema,
  FacilityViewportQuerySchema,
  NearbyDriversQuerySchema,
  RegisterUserSchema,
  SlotsQuerySchema,
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

  it("validates bounding-box ordering and Redis Geo / dispatch contracts", () => {
    const invertedBbox = FacilityViewportQuerySchema.safeParse({
      countryCode: "MA",
      minLng: -7.4,
      minLat: 33.7,
      maxLng: -7.7,
      maxLat: 33.4,
    });
    expect(invertedBbox.success).toBe(false);

    const nearbyValid = NearbyDriversQuerySchema.parse({
      lat: 33.5731,
      lng: -7.5898,
    });
    expect(nearbyValid.radiusKm).toBe(15);
    expect(nearbyValid.limit).toBe(20);

    const nearbyTooFar = NearbyDriversQuerySchema.safeParse({
      lat: 33.5731,
      lng: -7.5898,
      radiusKm: 500,
    });
    expect(nearbyTooFar.success).toBe(false);

    const dispatch = CreateDispatchRequestSchema.parse({
      pickupLat: 33.5731,
      pickupLng: -7.5898,
      pickupAddress: "Boulevard d'Anfa, Casablanca",
      urgency: "EMERGENCY",
    });
    expect(dispatch.urgency).toBe("EMERGENCY");
  });

  it("validates scheduling windows, includeBooked boolean transform, and booking requests", () => {
    const validSchedule = CreateScheduleSchema.parse({
      facilityId: "11111111-1111-4111-8111-111111111111",
      dayOfWeek: 1,
      startTimeUtc: "09:00",
      endTimeUtc: "12:00",
      slotDurationMinutes: 30,
      visitMode: "IN_PERSON",
    });
    expect(validSchedule.slotDurationMinutes).toBe(30);

    const invertedWindow = CreateScheduleSchema.safeParse({
      facilityId: "11111111-1111-4111-8111-111111111111",
      dayOfWeek: 1,
      startTimeUtc: "14:00",
      endTimeUtc: "14:15",
      slotDurationMinutes: 30,
    });
    expect(invertedWindow.success).toBe(false);

    const queryFalse = SlotsQuerySchema.parse({
      date: "2026-11-16",
      includeBooked: "false",
    });
    expect(queryFalse.includeBooked).toBe(false);

    const booking = CreateAppointmentSchema.parse({
      scheduleId: "22222222-2222-4222-8222-222222222222",
      slotStartIso: "2026-11-16T09:00:00.000Z",
      reason: "Annual cardiology follow-up",
    });
    expect(booking.slotStartIso).toBe("2026-11-16T09:00:00.000Z");
  });
});
