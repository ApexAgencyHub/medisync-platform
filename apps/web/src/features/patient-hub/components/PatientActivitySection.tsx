"use client";

import Link from "next/link";
import {
  computeVisitCountdown,
  type AppointmentSummary,
  type BookmarkItem,
  type DispatchRequestSummary,
  type GuestActivityPass,
  type VisitCountdownTone,
} from "@medisync/contracts";
import { BookmarkCheck, CalendarClock, MapPin, Trash2, Video } from "lucide-react";
import {
  formatDispatchStatus,
  formatVisitMode,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { removeGuestActivityPass } from "@/shared/patient/patient-local-store";
import { BookmarkButton } from "@/shared/ui/BookmarkButton";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { UiBadge, UiLinkButton, type UiBadgeTone } from "@/shared/ui/primitives";
import type { PatientUiCopy } from "../patient-copy";

interface PatientActivitySectionProps {
  copy: PatientUiCopy;
  activeAppointments: readonly AppointmentSummary[];
  activeDispatches: readonly DispatchRequestSummary[];
  guestPasses: readonly GuestActivityPass[];
  bookmarks: readonly BookmarkItem[];
}

const COUNTDOWN_BADGE_TONE: Record<VisitCountdownTone, UiBadgeTone> = {
  urgent: "red",
  upcoming: "amber",
  future: "teal",
  past: "slate",
};

function resolveBookmarkAvatarRole(
  kind: BookmarkItem["kind"],
): "DOCTOR" | "CLINIC_STAFF" | "PHARMACIST" | "LAB_TECH" {
  switch (kind) {
    case "PHARMACY":
      return "PHARMACIST";
    case "LAB":
      return "LAB_TECH";
    case "CLINIC":
    case "HOSPITAL":
      return "CLINIC_STAFF";
    default:
      return "DOCTOR";
  }
}

/** Shows upcoming appointments, live medical ride tracking, guest passes & saved favorites cleanly. */
export function PatientActivitySection({
  copy,
  activeAppointments,
  activeDispatches,
  guestPasses,
  bookmarks,
}: PatientActivitySectionProps) {
  const { locale } = useLocale();
  const trackedCount =
    activeAppointments.length + activeDispatches.length + guestPasses.length;

  return (
    <div
      id="patient-activity"
      className="grid grid-cols-1 gap-4 lg:grid-cols-12"
    >
      <section className="min-w-0 space-y-3.5 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-900/[0.06] lg:col-span-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock
              className="h-4 w-4 text-[#0066CC]"
              aria-hidden="true"
            />
            <h2 className="text-sm font-bold text-slate-950">
              {copy.activityTitle}
            </h2>
          </div>
          <UiBadge tone={trackedCount > 0 ? "teal" : "slate"}>
            <span dir="ltr" className="font-mono-tabular">
              {trackedCount}
            </span>
            <span className="ms-1">{copy.trackedWord}</span>
          </UiBadge>
        </div>

        {trackedCount === 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_6px_22px_rgba(15,23,42,0.04)]">
            <div className="flex items-start gap-3">
              <img
                src="/media/icons/icon-consultation.webp"
                alt=""
                className="h-11 w-11 shrink-0 rounded-xl bg-[#EEF4FC] object-contain p-1"
              />
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-bold text-slate-900">
                  {copy.activityEmptyTitle}
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {copy.activityEmptyHint}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <UiLinkButton href="/booking" size="sm" pill>
                {copy.reserveVisitCta}
              </UiLinkButton>
              <UiLinkButton href="/map?layer=DRIVER" size="sm" variant="secondary" pill>
                {copy.openMapCta}
              </UiLinkButton>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeAppointments.map((appt) => {
              const countdown = computeVisitCountdown(appt.slotStartIso);
              return (
                <div
                  key={appt.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                >
                  <EntityAvatar
                    name={appt.doctorName}
                    role="DOCTOR"
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        dir="ltr"
                        className="font-mono-tabular font-bold text-slate-900"
                      >
                        {appt.slotStartIso.slice(0, 16).replace("T", " ")}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <UiBadge tone={COUNTDOWN_BADGE_TONE[countdown.tone]}>
                          {countdown.label}
                        </UiBadge>
                        <UiBadge tone="slate">
                          {locale === "en"
                            ? appt.status
                            : locale === "fr"
                              ? ({
                                  CONFIRMED: "Confirmé",
                                  CHECKED_IN: "Arrivé",
                                  COMPLETED: "Terminé",
                                  CANCELLED: "Annulé",
                                  NO_SHOW: "Absent",
                                }[appt.status] ?? appt.status)
                              : ({
                                  CONFIRMED: "مؤكد",
                                  CHECKED_IN: "وصل للعيادة",
                                  COMPLETED: "مكتمل",
                                  CANCELLED: "ملغى",
                                  NO_SHOW: "تغيّب",
                                }[appt.status] ?? appt.status)}
                        </UiBadge>
                      </div>
                    </div>
                    <p className="mt-1 font-semibold text-slate-900">
                      <bdi dir="auto">{appt.doctorName}</bdi> ·{" "}
                      <bdi dir="auto">{appt.facilityName}</bdi>
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      {formatVisitMode(appt.visitMode, locale)}
                      {appt.reason ? ` · ${appt.reason}` : ""}
                    </p>
                    {appt.visitMode === "TELEHEALTH" &&
                    (appt.status === "CONFIRMED" ||
                      appt.status === "CHECKED_IN") ? (
                      <div className="mt-2">
                        <Link
                          href={`/consultation/${encodeURIComponent(appt.id)}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#0066CC] px-3 text-[11px] font-semibold text-white transition hover:bg-[#0052A3]"
                        >
                          <Video className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{copy.joinVideoCallCta}</span>
                        </Link>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {activeDispatches.map((ride) => (
              <div
                key={ride.id}
                className="flex items-start gap-3 rounded-xl bg-[#E8F1FA] p-3 text-xs"
              >
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] ">
                  <img
                    src="/media/vehicles/ambulance-van.webp"
                    alt={copy.medicalPickupTitle}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-950">
                      {copy.medicalPickupTitle}
                    </span>
                    <UiBadge tone="emerald">
                      {formatDispatchStatus(ride.status, locale)}
                    </UiBadge>
                  </div>
                  <p className="mt-1 text-slate-700">
                    <bdi dir="auto">{ride.pickupAddress}</bdi>
                  </p>
                  {ride.status !== "COMPLETED" && ride.status !== "CANCELLED" ? (
                    <div className="mt-2">
                      <Link
                        href="/map?layer=DRIVER"
                        className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#0066CC] px-3 text-[11px] font-semibold text-white transition hover:bg-[#0052A3]"
                      >
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        <span>{copy.trackDriverCta}</span>
                      </Link>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {guestPasses.map((pass) => {
              const countdown = computeVisitCountdown(pass.scheduledAtIso);
              return (
                <div
                  key={pass.id}
                  className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">
                      <bdi dir="auto">{pass.title}</bdi> ·{" "}
                      <span
                        dir="ltr"
                        className="font-mono-tabular text-amber-900"
                      >
                        {pass.trackingCode}
                      </span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <UiBadge tone={COUNTDOWN_BADGE_TONE[countdown.tone]}>
                        {pass.statusLabel}
                      </UiBadge>
                      <button
                        type="button"
                        onClick={() => removeGuestActivityPass(pass.id)}
                        aria-label={`${copy.removePassAriaPrefix} ${pass.trackingCode}`}
                        className="rounded p-1 text-slate-500 hover:bg-white hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-slate-700">
                    <bdi dir="auto">{pass.landmarkOrFacility}</bdi>
                    {pass.phoneContact ? (
                      <>
                        {" · "}
                        <span dir="ltr">{pass.phoneContact}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="min-w-0 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs lg:col-span-6">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <BookmarkCheck
              className="h-4 w-4 text-amber-600"
              aria-hidden="true"
            />
            <h2 className="text-sm font-bold text-slate-900">
              {copy.savedTitle}
            </h2>
          </div>
          <UiBadge tone={bookmarks.length > 0 ? "amber" : "slate"}>
            <span dir="ltr" className="font-mono-tabular">
              {bookmarks.length}
            </span>
            <span className="ms-1">{copy.savedWord}</span>
          </UiBadge>
        </div>

        {bookmarks.length === 0 ? (
          <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <img
                src="/media/icons/icon-home-care.webp"
                alt=""
                className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1"
              />
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-bold text-slate-900">
                  {copy.savedEmptyTitle}
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {copy.savedEmptyHint}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <UiLinkButton href="/profiles" size="sm" pill>
                {copy.browseDoctorsCta}
              </UiLinkButton>
            </div>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {bookmarks.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <EntityAvatar
                    name={item.title}
                    role={resolveBookmarkAvatarRole(item.kind)}
                    subtitle={item.subtitle}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-slate-900">
                        <bdi dir="auto">{item.title}</bdi>
                      </p>
                      <UiBadge tone="slate">{item.kind}</UiBadge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-600">
                      <bdi dir="auto">{item.subtitle}</bdi>
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <UiLinkButton href={item.href} size="sm" pill>
                    {copy.openItemCta}
                  </UiLinkButton>
                  <BookmarkButton
                    compact
                    entry={{
                      id: item.id,
                      kind: item.kind,
                      countryCode: item.countryCode,
                      title: item.title,
                      subtitle: item.subtitle,
                      ...(item.facilityId ? { facilityId: item.facilityId } : {}),
                      ...(item.facilityName
                        ? { facilityName: item.facilityName }
                        : {}),
                      href: item.href,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
