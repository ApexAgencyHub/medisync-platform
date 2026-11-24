"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  AppointmentStatus,
  AppointmentSummary,
  GuestActivityPass,
} from "@medisync/contracts";
import {
  CalendarClock,
  CalendarPlus,
  MapPin,
  Trash2,
  Video,
} from "lucide-react";
import {
  formatCountryDisplayName,
  formatVisitMode,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { formatSpecialtyLabel } from "@/shared/i18n/specialties";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { UiBadge, UiButton } from "@/shared/ui/primitives";
import { BOOKING_COPY } from "../booking-i18n";
import {
  downloadAppointmentIcs,
  formatReadableDateLabel,
  getAppointmentStatusMeta,
} from "./booking-utils";

interface AppointmentsListPanelProps {
  appointments: readonly AppointmentSummary[];
  guestPasses: readonly GuestActivityPass[];
  countryCode: string;
  hasSession: boolean;
  canManageStatus: boolean;
  busy: boolean;
  onTransitionStatus: (appointmentId: string, status: AppointmentStatus) => void;
  onRemoveGuestPass: (id: string) => void;
  onBrowseSlots: () => void;
}

type VisitStatusFilter = "ALL" | "UPCOMING" | "COMPLETED" | "CANCELLED";

/** Focused appointment history, calendar export (.ics), map link & status transitions. */
export function AppointmentsListPanel({
  appointments,
  guestPasses,
  countryCode,
  hasSession,
  canManageStatus,
  busy,
  onTransitionStatus,
  onRemoveGuestPass,
  onBrowseSlots,
}: AppointmentsListPanelProps) {
  const { locale, isRtl } = useLocale();
  const copy = BOOKING_COPY[locale];
  const [statusFilter, setStatusFilter] = useState<VisitStatusFilter>("ALL");

  const hasAny = appointments.length > 0 || guestPasses.length > 0;
  const countryDisplay = formatCountryDisplayName(
    countryCode,
    countryCode,
    locale,
  );

  const filteredAppointments = appointments.filter((appt) => {
    if (statusFilter === "UPCOMING") {
      return appt.status === "CONFIRMED" || appt.status === "CHECKED_IN";
    }
    if (statusFilter === "COMPLETED") return appt.status === "COMPLETED";
    if (statusFilter === "CANCELLED") {
      return appt.status === "CANCELLED" || appt.status === "NO_SHOW";
    }
    return true;
  });

  return (
    <section
      dir={isRtl ? "rtl" : "ltr"}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {copy.appointmentsHeading}
          </h2>
          <p className="text-xs text-slate-500">
            {copy.appointmentsSub} {countryDisplay}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {appointments.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { id: "ALL", label: copy.filterAll },
                  { id: "UPCOMING", label: copy.filterUpcoming },
                  { id: "COMPLETED", label: copy.filterCompleted },
                  { id: "CANCELLED", label: copy.filterCancelled },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setStatusFilter(opt.id)}
                  className={`h-8 rounded-full px-3 text-xs font-semibold transition ${
                    statusFilter === opt.id
                      ? "bg-[#0066CC] text-white"
                      : "bg-[#F3F8FD] border border-[#D7E4F2] text-slate-600 hover:bg-[#E1EBF2]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}

          {!hasSession ? (
            <Link
              href="/portal"
              className="inline-flex min-h-[34px] items-center rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-3.5 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-[#E1EBF2] hover:text-[#0066CC]"
            >
              {copy.portalSignInCta}
            </Link>
          ) : null}
        </div>
      </div>

      {!hasAny ? (
        <div className="mt-4 rounded-2xl border border-[#D7E4F2] bg-white p-6 text-center">
          <CalendarClock
            className="mx-auto h-6 w-6 text-[#0066CC]"
            aria-hidden="true"
          />
          <p className="mt-2 text-xs font-medium text-slate-700">
            {copy.noAppointmentsPrefix} {countryDisplay}.{" "}
            {copy.noAppointmentsSuffix}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <UiButton size="sm" onClick={onBrowseSlots}>
              {copy.browseOpenSlotsCta}
            </UiButton>
            <Link
              href="/patient"
              className="inline-flex min-h-[34px] items-center rounded-xl bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs transition hover:text-[#0066CC]"
            >
              {copy.openMyCareCta}
            </Link>
          </div>
        </div>
      ) : filteredAppointments.length === 0 && guestPasses.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-[#D7E4F2] bg-white p-6 text-center text-xs text-slate-600">
          {copy.noMatchingStatus}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredAppointments.map((appt) => {
            const statusMeta = getAppointmentStatusMeta(appt.status, locale);
            const dateText = formatReadableDateLabel(
              appt.slotStartIso.slice(0, 10),
              locale,
            );
            const timeWindow = `${appt.slotStartIso.slice(11, 16)}–${appt.slotEndIso.slice(11, 16)}`;
            const localizedSpecialty = formatSpecialtyLabel(
              appt.specialty,
              locale,
            );

            return (
              <article
                key={appt.id}
                className="flex flex-col justify-between rounded-2xl border border-[#D7E4F2] bg-white p-4 text-xs"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono-tabular font-bold text-slate-900">
                      {dateText} · <span dir="ltr">{timeWindow}</span>
                    </span>
                    <UiBadge tone={statusMeta.tone}>{statusMeta.label}</UiBadge>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2.5">
                    <EntityAvatar
                      name={appt.doctorName}
                      role="DOCTOR"
                      specialty={appt.specialty}
                      subtitle={`${localizedSpecialty} · ${appt.facilityName}`}
                      avatarUrl={appt.doctorAvatarUrl ?? null}
                      size="xs"
                      zoomable
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">
                        <bdi dir="auto">{appt.doctorName}</bdi> ·{" "}
                        <span className="text-[#0066CC]">
                          {localizedSpecialty}
                        </span>
                      </p>
                      <p className="truncate text-slate-600">
                        {formatVisitMode(appt.visitMode, locale)} ·{" "}
                        <bdi dir="auto">{appt.facilityName}</bdi>
                      </p>
                    </div>
                  </div>

                  {appt.reason ? (
                    <p className="mt-2.5 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-3 py-1.5 text-[11px] text-slate-600 ">
                      {appt.reason}
                    </p>
                  ) : null}
                </div>

                <div className="mt-3.5 flex flex-wrap items-center gap-1.5 pt-2">
                  {appt.visitMode === "TELEHEALTH" &&
                  (appt.status === "CONFIRMED" || appt.status === "CHECKED_IN") ? (
                    <Link
                      href={`/consultation/${encodeURIComponent(appt.id)}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#0066CC] px-3 text-[11px] font-semibold text-white shadow-2xs transition hover:bg-[#0052A3]"
                    >
                      <Video className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{copy.joinVideoCall}</span>
                    </Link>
                  ) : null}

                  {appt.status === "CONFIRMED" || appt.status === "CHECKED_IN" ? (
                    <button
                      type="button"
                      onClick={() => downloadAppointmentIcs(appt, locale)}
                      className="inline-flex h-8 items-center gap-1 rounded-xl bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-2xs hover:text-[#0066CC]"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{copy.addToCalendar}</span>
                    </button>
                  ) : null}

                  <Link
                    href={`/map?facilityId=${encodeURIComponent(appt.facilityId)}`}
                    className="inline-flex h-8 items-center gap-1 rounded-xl bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-2xs hover:text-[#0066CC]"
                  >
                    <MapPin className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                    <span>{copy.viewMap}</span>
                  </Link>

                  {appt.status === "CONFIRMED" ? (
                    <UiButton
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => onTransitionStatus(appt.id, "CANCELLED")}
                      className="rounded-full"
                    >
                      {copy.cancelVisit}
                    </UiButton>
                  ) : null}
                  {canManageStatus && appt.status === "CONFIRMED" ? (
                    <UiButton
                      size="sm"
                      disabled={busy}
                      onClick={() => onTransitionStatus(appt.id, "CHECKED_IN")}
                      className="rounded-full"
                    >
                      {copy.checkIn}
                    </UiButton>
                  ) : null}
                  {canManageStatus && appt.status === "CHECKED_IN" ? (
                    <UiButton
                      size="sm"
                      disabled={busy}
                      onClick={() => onTransitionStatus(appt.id, "COMPLETED")}
                      className="rounded-full"
                    >
                      {copy.completeVisit}
                    </UiButton>
                  ) : null}
                </div>
              </article>
            );
          })}

          {guestPasses.map((pass) => (
            <article
              key={pass.id}
              className="rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-4 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-tabular font-bold text-[#0066CC]">
                  {pass.trackingCode}
                </span>
                <UiBadge tone="emerald">{pass.statusLabel}</UiBadge>
              </div>
              <p className="mt-1.5 font-semibold text-slate-900">{pass.title}</p>
              <p className="mt-0.5 text-slate-600">
                {pass.landmarkOrFacility} ·{" "}
                <span className="font-mono-tabular">
                  {pass.scheduledAtIso.slice(0, 16).replace("T", " ")}
                </span>
              </p>
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => onRemoveGuestPass(pass.id)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-white hover:text-rose-700"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  <span>{copy.dismissPass}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
