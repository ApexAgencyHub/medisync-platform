import { describe, expect, it } from "vitest";
import {
  BookmarkItemSchema,
  GuestActivityPassSchema,
  computeVisitCountdown,
} from "./index.js";

describe("patient-care contracts and deadline helpers", () => {
  it("validates well-formed bookmark entries and rejects empty titles", () => {
    const valid = BookmarkItemSchema.parse({
      id: "doc-1",
      kind: "DOCTOR",
      countryCode: "MA",
      title: "Dr. Amina Benali",
      subtitle: "Cardiology · Casablanca Central Care",
      facilityId: "fac-1",
      facilityName: "Casablanca Central Care",
      href: "/booking?doctorId=doc-1",
      savedAtIso: "2026-11-14T10:00:00.000Z",
    });
    expect(valid.kind).toBe("DOCTOR");
    expect(() =>
      BookmarkItemSchema.parse({ ...valid, title: "" }),
    ).toThrow();
  });

  it("validates guest activity passes cleanly", () => {
    const pass = GuestActivityPassSchema.parse({
      id: "pass-1",
      kind: "FAST_BOOK",
      countryCode: "FR",
      title: "1-Tap Medical Pickup Alert",
      landmarkOrFacility: "Near Paris Nord Care",
      phoneContact: "+33 6 00 11 22 33",
      scheduledAtIso: "2026-11-14T10:15:00.000Z",
      trackingCode: "FAST-8421",
      statusLabel: "Broadcasted to nearby drivers",
    });
    expect(pass.trackingCode).toBe("FAST-8421");
  });

  it("computes accurate urgency tiers for past, immediate, same-day, and future deadlines", () => {
    const now = Date.parse("2026-11-14T10:00:00.000Z");

    expect(computeVisitCountdown("2026-11-14T09:40:00.000Z", now)).toMatchObject({
      label: "Past / Completed",
      tone: "past",
      isPast: true,
    });

    expect(computeVisitCountdown("2026-11-14T10:00:30.000Z", now)).toMatchObject({
      label: "Starting now",
      tone: "urgent",
      isPast: false,
    });

    expect(computeVisitCountdown("2026-11-14T10:35:00.000Z", now)).toMatchObject({
      label: "In 35m",
      tone: "urgent",
      isPast: false,
      minutesRemaining: 35,
    });

    expect(computeVisitCountdown("2026-11-14T14:20:00.000Z", now)).toMatchObject({
      label: "In 4h 20m",
      tone: "upcoming",
      isPast: false,
    });

    expect(computeVisitCountdown("2026-11-17T09:30:00.000Z", now)).toMatchObject({
      label: "In 2d · 09:30",
      tone: "future",
      isPast: false,
    });

    expect(computeVisitCountdown("invalid-date", now)).toMatchObject({
      label: "Scheduled",
      tone: "future",
      isPast: false,
    });
  });
});
