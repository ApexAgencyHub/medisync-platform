import { describe, expect, it } from "vitest";
import {
  AdminOverrideDispatchSchema,
  CountryPackSchema,
  CreateAppointmentSchema,
  CreateDispatchRequestSchema,
  CreateDisputeSchema,
  CreateFacilitySchema,
  CreatePharmacyOrderSchema,
  CreatePharmacyProductSchema,
  CreateScheduleSchema,
  DispatchListResponseSchema,
  DriverPingSchema,
  FacilityListQuerySchema,
  FacilityViewportQuerySchema,
  MAX_CLINICAL_UPLOAD_BYTES,
  MobileTelemetryHeartbeatSchema,
  NearbyDriversQuerySchema,
  PlatformMetricsResponseSchema,
  PresignClinicalUploadSchema,
  RegisterUserSchema,
  RequestVerificationCodeSchema,
  SlotsQuerySchema,
  UpdateUserRoleSchema,
  UserRoleSchema,
  VerifyAccountCodeSchema,
} from "./index.js";

describe("@medisync/contracts", () => {
  it("supports all 10 ecosystem roles including NURSE", () => {
    expect(UserRoleSchema.options).toHaveLength(10);
    expect(UserRoleSchema.parse("NURSE")).toBe("NURSE");
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

    expect(DispatchListResponseSchema.parse({ dispatches: [] }).driverDutyStatus).toBeUndefined();
    expect(
      DispatchListResponseSchema.parse({
        dispatches: [],
        driverDutyStatus: "OFF_DUTY",
      }).driverDutyStatus,
    ).toBe("OFF_DUTY");
    expect(
      DispatchListResponseSchema.safeParse({
        dispatches: [],
        driverDutyStatus: "INVALID_STATE",
      }).success,
    ).toBe(false);
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

    const homeVisitSched = CreateScheduleSchema.parse({
      facilityId: "11111111-1111-4111-8111-111111111111",
      dayOfWeek: 2,
      startTimeUtc: "09:00",
      endTimeUtc: "12:00",
      slotDurationMinutes: 30,
      visitMode: "HOME_VISIT",
    });
    expect(homeVisitSched.visitMode).toBe("HOME_VISIT");

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

  it("enforces clinical media upload MIME allowlist and 10MB cap", () => {
    const validUpload = PresignClinicalUploadSchema.safeParse({
      patientUserId: "33333333-3333-4333-8333-333333333333",
      fileName: "chest-xray.png",
      mimeType: "image/png",
      sizeBytes: 2_400_000,
    });
    expect(validUpload.success).toBe(true);

    const exeUpload = PresignClinicalUploadSchema.safeParse({
      patientUserId: "33333333-3333-4333-8333-333333333333",
      fileName: "payload.exe",
      mimeType: "application/x-msdownload",
      sizeBytes: 1024,
    });
    expect(exeUpload.success).toBe(false);

    const oversized = PresignClinicalUploadSchema.safeParse({
      patientUserId: "33333333-3333-4333-8333-333333333333",
      fileName: "huge-scan.pdf",
      mimeType: "application/pdf",
      sizeBytes: MAX_CLINICAL_UPLOAD_BYTES + 1,
    });
    expect(oversized.success).toBe(false);
  });

  it("validates admin-ops role governance, dispatch overrides, and disputes", () => {
    const dispute = CreateDisputeSchema.parse({
      category: "DISPATCH_DELAY",
      subject: "Ambulance ETA deviation > 15 min",
      description: "Unit reported heavy traffic near Maarif junction.",
    });
    expect(dispute.category).toBe("DISPATCH_DELAY");

    const override = AdminOverrideDispatchSchema.parse({
      status: "EN_ROUTE",
      note: "Manual ops coordinator escalation.",
    });
    expect(override.status).toBe("EN_ROUTE");

    const roleUpdate = UpdateUserRoleSchema.parse({
      role: "CLINIC_STAFF",
      countryCode: "MA",
    });
    expect(roleUpdate.role).toBe("CLINIC_STAFF");
  });

  it("validates pharmacy catalog, cart checkout & account recovery codes", () => {
    const product = CreatePharmacyProductSchema.parse({
      sku: "MA-AMOX-500",
      name: "Amoxicillin 500mg",
      category: "PRESCRIPTION_RX",
      requiresPrescription: true,
      priceMinor: 4500,
      stockQty: 25,
    });
    expect(product.requiresPrescription).toBe(true);

    const order = CreatePharmacyOrderSchema.parse({
      facilityId: "44444444-4444-4444-8444-444444444444",
      items: [
        {
          productId: "55555555-5555-4555-8555-555555555555",
          quantity: 2,
        },
      ],
      fulfillmentMode: "COURIER_DELIVERY",
      deliveryAddress: "145 Boulevard d'Anfa, Casablanca",
    });
    expect(order.fulfillmentMode).toBe("COURIER_DELIVERY");

    const otpReq = RequestVerificationCodeSchema.parse({
      email: "patient.ma@medisync.global",
      purpose: "VERIFY_EMAIL",
    });
    expect(otpReq.purpose).toBe("VERIFY_EMAIL");

    const invalidOtp = VerifyAccountCodeSchema.safeParse({
      email: "patient.ma@medisync.global",
      purpose: "VERIFY_EMAIL",
      code: "abc",
    });
    expect(invalidOtp.success).toBe(false);
  });

  it("validates platform metrics & mobile telemetry heartbeat schemas", () => {
    const metrics = PlatformMetricsResponseSchema.parse({
      service: "medisync-api",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
      uptimeSeconds: 42.5,
      dependencies: {
        postgres: { status: "OK", latencyMs: 1.4 },
        redis: { status: "OK", latencyMs: 0.8 },
      },
      counts: {
        users: 10,
        verifiedFacilities: 8,
        activeDispatches: 2,
        pharmacyOrders: 4,
        clinicalMediaObjects: 3,
      },
    });
    expect(metrics.dependencies.postgres.status).toBe("OK");

    const heartbeat = MobileTelemetryHeartbeatSchema.parse({
      platform: "ios",
      appVersion: "2.0.0",
      countryCode: "MA",
      capabilities: {
        cameraQr: true,
        backgroundLocation: true,
        binaryMediaPicker: true,
      },
    });
    expect(heartbeat.appVersion).toBe("2.0.0");
  });
});
