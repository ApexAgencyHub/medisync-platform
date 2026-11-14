import { z } from "zod";
import { CountryPackSchema } from "./country-pack.js";

/** Provider or care facility category supported by patient bookmarks. */
export const BookmarkedEntityKindSchema = z.enum([
  "DOCTOR",
  "NURSE",
  "CLINIC",
  "HOSPITAL",
  "PHARMACY",
  "LAB",
]);
export type BookmarkedEntityKind = z.infer<typeof BookmarkedEntityKindSchema>;

/** Validated patient bookmark record persisted per browser or synced profile. */
export const BookmarkItemSchema = z.object({
  id: z.string().min(1).max(160),
  kind: BookmarkedEntityKindSchema,
  countryCode: CountryPackSchema.shape.code,
  title: z.string().min(1).max(160),
  subtitle: z.string().min(1).max(200),
  facilityId: z.string().min(1).max(160).optional(),
  facilityName: z.string().min(1).max(160).optional(),
  href: z.string().min(1).max(240),
  savedAtIso: z.string().datetime(),
});
export type BookmarkItem = z.infer<typeof BookmarkItemSchema>;

export const BookmarkStoragePayloadSchema = z.array(BookmarkItemSchema);

/** Local activity pass issued when a patient uses 1-tap Fast Book or slot reserve without an account. */
export const GuestActivityPassKindSchema = z.enum(["FAST_BOOK", "APPOINTMENT"]);
export type GuestActivityPassKind = z.infer<typeof GuestActivityPassKindSchema>;

export const GuestActivityPassSchema = z.object({
  id: z.string().min(1).max(160),
  kind: GuestActivityPassKindSchema,
  countryCode: CountryPackSchema.shape.code,
  title: z.string().min(1).max(160),
  landmarkOrFacility: z.string().min(1).max(220),
  phoneContact: z.string().max(40).optional(),
  scheduledAtIso: z.string().datetime(),
  trackingCode: z.string().min(4).max(40),
  statusLabel: z.string().min(1).max(80),
});
export type GuestActivityPass = z.infer<typeof GuestActivityPassSchema>;

export const GuestPassStoragePayloadSchema = z.array(GuestActivityPassSchema);

export type VisitCountdownTone = "urgent" | "upcoming" | "future" | "past";

export interface VisitCountdownInfo {
  label: string;
  tone: VisitCountdownTone;
  isPast: boolean;
  minutesRemaining: number;
}

/** Formats the remaining time until an appointment or pickup deadline without polling timers. */
export function computeVisitCountdown(
  targetIso: string,
  referenceNowMs: number = Date.now(),
): VisitCountdownInfo {
  const targetMs = Date.parse(targetIso);
  if (!Number.isFinite(targetMs)) {
    return {
      label: "Scheduled",
      tone: "future",
      isPast: false,
      minutesRemaining: 0,
    };
  }

  const diffMs = targetMs - referenceNowMs;
  const minutesRemaining = Math.round(diffMs / 60_000);

  if (diffMs <= -60_000) {
    return {
      label: "Past / Completed",
      tone: "past",
      isPast: true,
      minutesRemaining,
    };
  }

  if (diffMs <= 60_000) {
    return {
      label: "Starting now",
      tone: "urgent",
      isPast: false,
      minutesRemaining: Math.max(0, minutesRemaining),
    };
  }

  if (minutesRemaining < 60) {
    return {
      label: `In ${minutesRemaining}m`,
      tone: "urgent",
      isPast: false,
      minutesRemaining,
    };
  }

  const totalHours = Math.floor(minutesRemaining / 60);
  const remMinutes = minutesRemaining % 60;
  const hhmm = new Date(targetMs).toISOString().slice(11, 16);

  if (totalHours < 24) {
    return {
      label: remMinutes > 0 ? `In ${totalHours}h ${remMinutes}m` : `In ${totalHours}h`,
      tone: "upcoming",
      isPast: false,
      minutesRemaining,
    };
  }

  const days = Math.floor(totalHours / 24);
  if (days < 14) {
    return {
      label: `In ${days}d · ${hhmm}`,
      tone: "future",
      isPast: false,
      minutesRemaining,
    };
  }

  return {
    label: `${targetIso.slice(0, 10)} · ${hhmm}`,
    tone: "future",
    isPast: false,
    minutesRemaining,
  };
}
