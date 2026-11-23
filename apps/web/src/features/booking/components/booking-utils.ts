import type {
  AppointmentStatus,
  AppointmentSummary,
  DoctorScheduleSummary,
  LocaleCode,
} from "@medisync/contracts";
import { formatVisitMode } from "@/shared/i18n/human-labels";
import {
  BOOKING_COPY,
  SHORT_MONTH_BY_LOCALE,
  SHORT_WEEKDAY_BY_LOCALE,
  WEEKDAY_NAMES_BY_LOCALE,
  getLocalizedAppointmentStatusLabel,
} from "../booking-i18n";

export type ProviderCategoryFilter = "ALL" | "DOCTORS" | "NURSES";
export type BookingTab = "PRACTITIONERS" | "APPOINTMENTS";

export const WEEKDAY_LABELS = WEEKDAY_NAMES_BY_LOCALE.en;
export const SHORT_WEEKDAY_LABELS = SHORT_WEEKDAY_BY_LOCALE.en;
export const SHORT_MONTH_LABELS = SHORT_MONTH_BY_LOCALE.en;

export const APPOINTMENT_STATUS_META: Record<
  AppointmentStatus,
  { label: string; tone: "teal" | "amber" | "emerald" | "slate" | "red" }
> = {
  CONFIRMED: { label: "Confirmed", tone: "teal" },
  CHECKED_IN: { label: "Checked In", tone: "amber" },
  COMPLETED: { label: "Completed", tone: "emerald" },
  CANCELLED: { label: "Cancelled", tone: "slate" },
  NO_SHOW: { label: "Missed Visit", tone: "red" },
};

export function getAppointmentStatusMeta(
  status: AppointmentStatus,
  locale: LocaleCode = "en",
): { label: string; tone: "teal" | "amber" | "emerald" | "slate" | "red" } {
  return {
    label: getLocalizedAppointmentStatusLabel(status, locale),
    tone: APPOINTMENT_STATUS_META[status].tone,
  };
}

export function getUtcDayOfWeek(dateStr: string): number {
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? 1 : parsed.getUTCDay();
}

export function getWeekdayLabel(
  dayOfWeek: number,
  locale: LocaleCode = "en",
): string {
  const list = WEEKDAY_NAMES_BY_LOCALE[locale] ?? WEEKDAY_NAMES_BY_LOCALE.en;
  return list[dayOfWeek] ?? list[1] ?? "Monday";
}

export function getUtcOffsetIsoDate(daysOffset: number): string {
  const now = new Date();
  const target = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysOffset,
    ),
  );
  return target.toISOString().slice(0, 10);
}

export function getNextMondayIsoDate(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const offset = day === 1 ? 0 : (8 - day) % 7 || 7;
  return getUtcOffsetIsoDate(offset);
}

export function getInitialBookingIsoDate(): string {
  const today = getUtcOffsetIsoDate(0);
  const dow = getUtcDayOfWeek(today);
  return dow >= 1 && dow <= 5 ? today : getNextMondayIsoDate();
}

export function isNurseSpecialty(specialty: string): boolean {
  return /nursing|infirmier|nurse/i.test(specialty);
}

export function formatReadableDateLabel(
  isoDate: string,
  locale: LocaleCode = "en",
): string {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  const days = SHORT_WEEKDAY_BY_LOCALE[locale] ?? SHORT_WEEKDAY_LABELS;
  const months = SHORT_MONTH_BY_LOCALE[locale] ?? SHORT_MONTH_LABELS;
  const dayName = days[parsed.getUTCDay()] ?? "";
  const monthName = months[parsed.getUTCMonth()] ?? "";
  return `${dayName}, ${parsed.getUTCDate()} ${monthName}`;
}

/** Builds a rolling 5-weekday date ribbon starting from today so patients scan open clinic days immediately. */
export function buildRollingClinicDates(
  count = 5,
  locale: LocaleCode = "en",
): ReadonlyArray<{
  label: string;
  sublabel: string;
  value: string;
}> {
  const todayIso = getUtcOffsetIsoDate(0);
  const tomorrowIso = getUtcOffsetIsoDate(1);
  const days = SHORT_WEEKDAY_BY_LOCALE[locale] ?? SHORT_WEEKDAY_LABELS;
  const months = SHORT_MONTH_BY_LOCALE[locale] ?? SHORT_MONTH_LABELS;
  const copy = BOOKING_COPY[locale];
  const results: Array<{ label: string; sublabel: string; value: string }> = [];

  for (let offset = 0; offset < 14 && results.length < count; offset += 1) {
    const iso = getUtcOffsetIsoDate(offset);
    const dow = getUtcDayOfWeek(iso);
    if (dow === 0 || dow === 6) continue;
    const shortDay = days[dow] ?? "";
    const monthName = months[Number(iso.slice(5, 7)) - 1] ?? "";
    const dayNum = iso.slice(8, 10);
    results.push({
      label:
        iso === todayIso
          ? copy.todayWord
          : iso === tomorrowIso
            ? copy.tomorrowWord
            : shortDay,
      sublabel: `${dayNum} ${monthName}`,
      value: iso,
    });
  }

  return results;
}

/** Finds the next upcoming YYYY-MM-DD (after currentSelectedDate) where this doctor has an active schedule. */
export function findNextScheduledIsoDate(
  doctorUserId: string,
  facilityId: string,
  schedules: readonly DoctorScheduleSummary[],
  fromIsoDate: string,
  locale: LocaleCode = "en",
): { isoDate: string; label: string } | null {
  const doctorDays = new Set(
    schedules
      .filter(
        (s) =>
          s.isActive &&
          s.doctorUserId === doctorUserId &&
          s.facilityId === facilityId,
      )
      .map((s) => s.dayOfWeek),
  );
  if (doctorDays.size === 0) return null;

  const base = new Date(`${fromIsoDate}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return null;

  for (let offset = 1; offset <= 10; offset += 1) {
    const next = new Date(base.getTime() + offset * 86_400_000);
    if (doctorDays.has(next.getUTCDay())) {
      const isoDate = next.toISOString().slice(0, 10);
      return { isoDate, label: formatReadableDateLabel(isoDate, locale) };
    }
  }
  return null;
}

export function formatLanguageCodes(langs: readonly string[]): string {
  const map: Record<string, string> = {
    ar: "AR",
    fr: "FR",
    en: "EN",
    es: "ES",
  };
  return langs.map((l) => map[l.toLowerCase()] ?? l.toUpperCase()).join(" · ");
}

/** Triggers a standard RFC 5545 .ics calendar file download for confirmed visits. */
export function downloadAppointmentIcs(
  appointment: AppointmentSummary,
  locale: LocaleCode = "en",
): void {
  if (typeof window === "undefined") return;
  const toIcsStamp = (iso: string) =>
    iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  const summary = `${appointment.doctorName} (${appointment.specialty})`;
  const location = appointment.facilityName;
  const desc = [
    `Visit format: ${formatVisitMode(appointment.visitMode, locale)}`,
    appointment.reason ? `Notes: ${appointment.reason}` : null,
    `Booked via MediSync Global`,
  ]
    .filter(Boolean)
    .join("\\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MediSync Global//Appointment Scheduler//EN",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@medisync.global`,
    `DTSTAMP:${toIcsStamp(new Date().toISOString())}`,
    `DTSTART:${toIcsStamp(appointment.slotStartIso)}`,
    `DTEND:${toIcsStamp(appointment.slotEndIso)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${desc}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `medisync-visit-${appointment.slotStartIso.slice(0, 10)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
