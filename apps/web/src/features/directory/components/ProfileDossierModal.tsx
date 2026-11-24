"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  AvailableSlot,
  DirectoryDoctorSummary,
  DirectoryDriverSummary,
  DirectoryFacilitySummary,
} from "@medisync/contracts";
import {
  Ambulance,
  Building2,
  CalendarClock,
  Check,
  Clock,
  Copy,
  Home,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Video,
  X,
} from "lucide-react";
import { fetchAvailableSlots } from "@/features/booking";
import {
  formatDriverStatus,
  formatFacilityKind,
  formatOpenStatus,
  formatVisitMode,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { formatSpecialtyLabel } from "@/shared/i18n/specialties";
import { BookmarkButton } from "@/shared/ui/BookmarkButton";
import {
  resolveDefaultAvatar,
  resolveFacilityPicture,
  resolveVehiclePicture,
} from "@/shared/ui/EntityAvatar";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import { UiBadge, useToast } from "@/shared/ui/primitives";
import { DIRECTORY_COPY } from "../directory-i18n";

export type ProfileDossierTarget =
  | {
      kind: "DOCTOR";
      doctor: DirectoryDoctorSummary;
      facility: DirectoryFacilitySummary | null;
    }
  | {
      kind: "NURSE";
      nurse: DirectoryDoctorSummary;
      facility: DirectoryFacilitySummary | null;
    }
  | {
      kind: "DRIVER";
      driver: DirectoryDriverSummary;
    }
  | {
      kind: "FACILITY";
      facility: DirectoryFacilitySummary;
      teamDoctors: readonly DirectoryDoctorSummary[];
      teamNurses: readonly DirectoryDoctorSummary[];
      fleetDrivers: readonly DirectoryDriverSummary[];
    };

interface ProfileDossierModalProps {
  target: ProfileDossierTarget;
  apiBaseUrl: string;
  currencyCode: string;
  onClose: () => void;
  onInspectDoctor?: (doc: DirectoryDoctorSummary) => void;
  onInspectDriver?: (drv: DirectoryDriverSummary) => void;
  onInspectFacility?: (fac: DirectoryFacilitySummary) => void;
}

function formatMoney(minor: number, currencyCode: string): string {
  const major = (minor / 100).toFixed(0);
  return `${major} ${currencyCode}`;
}

export function ProfileDossierModal({
  target,
  apiBaseUrl,
  currencyCode,
  onClose,
  onInspectDoctor,
  onInspectDriver,
  onInspectFacility,
}: ProfileDossierModalProps) {
  const { locale, isRtl } = useLocale();
  const copy = DIRECTORY_COPY[locale];
  const { openImage } = useImageLightbox();
  const { showToast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [liveSlots, setLiveSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const practitionerId =
    target.kind === "DOCTOR"
      ? target.doctor.id
      : target.kind === "NURSE"
        ? target.nurse.id
        : null;
  const practitionerCountry =
    target.kind === "DOCTOR"
      ? target.doctor.countryCode
      : target.kind === "NURSE"
        ? target.nurse.countryCode
        : null;
  const practitionerFacilityId =
    target.kind === "DOCTOR"
      ? target.doctor.facilityId
      : target.kind === "NURSE"
        ? target.nurse.facilityId
        : null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!practitionerId || !practitionerCountry) {
      setLiveSlots([]);
      return;
    }
    let active = true;
    const todayIso = new Date().toISOString().slice(0, 10);
    setSlotsLoading(true);
    fetchAvailableSlots(apiBaseUrl, {
      date: todayIso,
      countryCode: practitionerCountry,
      ...(practitionerFacilityId
        ? { facilityId: practitionerFacilityId }
        : {}),
      includeBooked: false,
    })
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          setLiveSlots([]);
          return;
        }
        setLiveSlots(
          res.data.slots
            .filter((s) => s.doctorUserId === practitionerId && s.isAvailable)
            .slice(0, 6),
        );
      })
      .finally(() => {
        if (active) setSlotsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiBaseUrl, practitionerCountry, practitionerFacilityId, practitionerId]);

  const permalinkQuery =
    target.kind === "DOCTOR" || target.kind === "NURSE"
      ? `?doctorId=${encodeURIComponent(
          target.kind === "DOCTOR" ? target.doctor.id : target.nurse.id,
        )}`
      : target.kind === "DRIVER"
        ? `?driverId=${encodeURIComponent(target.driver.id)}`
        : `?facilityId=${encodeURIComponent(target.facility.id)}`;

  async function handleCopyLink() {
    if (typeof window === "undefined" || !navigator.clipboard) return;
    const fullUrl = `${window.location.origin}/profiles${permalinkQuery}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      showToast({
        tone: "success",
        message: copy.copiedToast,
      });
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showToast({
        tone: "warning",
        message: copy.copyUnavailableToast,
      });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.modalDialogAria}
      dir={isRtl ? "rtl" : "ltr"}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

        {target.kind === "DOCTOR" || target.kind === "NURSE" ? (
          (() => {
            const person = target.kind === "DOCTOR" ? target.doctor : target.nurse;
            const isNurse = target.kind === "NURSE";
            const localizedSpecialty = formatSpecialtyLabel(
              person.specialty,
              locale,
            );
            const photo =
              person.avatarUrl ??
              resolveDefaultAvatar(
                person.fullName,
                person.role ?? (isNurse ? "NURSE" : "DOCTOR"),
                person.specialty,
              );
            const bookingHref = isNurse
              ? `/booking?country=${person.countryCode}&doctorId=${person.id}&provider=nurse`
              : `/booking?country=${person.countryCode}&doctorId=${person.id}`;

            return (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <button
                      type="button"
                      onClick={() =>
                        openImage({
                          src: photo,
                          alt: person.fullName,
                          title: person.fullName,
                          subtitle: localizedSpecialty,
                        })
                      }
                      aria-label={`${copy.zoomPortraitAria} ${person.fullName}`}
                      className="h-16 w-16 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ring-teal-700 transition hover:ring-2"
                    >
                      <img
                        src={photo}
                        alt={person.fullName}
                        className="h-full w-full object-cover object-top"
                      />
                    </button>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          {copy.verifiedPractitionerBadge}
                        </span>
                        <UiBadge tone={isNurse ? "emerald" : "teal"}>
                          {isNurse ? copy.homeNursingBadge : localizedSpecialty}
                        </UiBadge>
                      </div>
                      <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                        <bdi dir="auto">{person.fullName}</bdi>
                      </h2>
                      <p className="text-xs text-slate-600">
                        <bdi dir="auto">
                          {localizedSpecialty} ·{" "}
                          {person.facilityName ??
                            `${person.countryCode} ${copy.clinicalNetworkSuffix}`}
                        </bdi>
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyLink()}
                      aria-label={copy.copyLinkAria}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-teal-700 hover:text-teal-800 active:scale-95"
                    >
                      {copiedLink ? (
                        <Check className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={copy.closeModalAria}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 active:scale-95"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {isNurse ? copy.homeVisitFeeLabel : copy.consultationFeeLabel}
                    </p>
                    <p className="mt-0.5 font-mono-tabular text-base font-bold text-teal-900">
                      {formatMoney(person.consultationFeeMinor, currencyCode)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {copy.careDeliveryModesHeading}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 font-semibold text-slate-800">
                      {isNurse ? (
                        <span className="inline-flex items-center gap-1 text-emerald-800">
                          <Home className="h-3.5 w-3.5" aria-hidden="true" />
                          {copy.homeVisitDomicile}
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1">
                            <Stethoscope className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                            {copy.clinicVisitWord}
                          </span>
                          {person.telehealthEnabled !== false ? (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1">
                                <Video className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
                                {copy.videoWord}
                              </span>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {copy.verifiedWorkplaceHeading}
                    </p>
                    {target.facility && onInspectFacility ? (
                      <button
                        type="button"
                        onClick={() => onInspectFacility(target.facility!)}
                        className="mt-1 block w-full truncate text-start font-semibold text-teal-800 hover:underline"
                      >
                        <bdi dir="auto">{target.facility.name}</bdi> →
                      </button>
                    ) : (
                      <p className="mt-1 truncate font-semibold text-slate-800">
                        <bdi dir="auto">
                          {person.facilityName ?? copy.regionalClinicFallback}
                        </bdi>
                      </p>
                    )}
                  </div>
                </div>

                {target.facility ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-4 py-3 text-xs">
                    <div className="flex min-w-0 items-center gap-2 text-slate-700">
                      <MapPin className="h-4 w-4 shrink-0 text-[#0066CC]" aria-hidden="true" />
                      <span className="truncate">
                        <bdi dir="auto">{target.facility.address}</bdi> ·{" "}
                        {copy.licenseLabel}{" "}
                        <span className="font-mono-tabular font-semibold">
                          {target.facility.licenseNumber}
                        </span>
                      </span>
                    </div>
                    <Link
                      href={`/map?country=${target.facility.countryCode}&facilityId=${target.facility.id}`}
                      className="font-semibold text-[#0066CC] hover:underline"
                    >
                      {copy.openOnMapCta}
                    </Link>
                  </div>
                ) : null}

                <div className="space-y-2 rounded-2xl bg-[#F3F8FD] border border-[#D7E4F2] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <CalendarClock className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                      {copy.todayOpenWindows}
                    </span>
                    <span className="font-mono-tabular text-[11px] font-medium text-slate-500">
                      {copy.liveScheduleSync}
                    </span>
                  </div>

                  {slotsLoading ? (
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((n) => (
                        <div key={n} className="h-9 animate-pulse rounded-lg bg-slate-200/70" />
                      ))}
                    </div>
                  ) : liveSlots.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-3">
                      {liveSlots.map((slot) => (
                        <Link
                          key={`${slot.scheduleId}-${slot.slotStartIso}`}
                          href={bookingHref}
                          className="flex items-center justify-between gap-1 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-3 py-2 text-xs font-semibold text-emerald-800  transition hover:bg-emerald-50 active:scale-[0.98]"
                        >
                          <span className="flex items-center gap-1 font-mono-tabular">
                            <Clock className="h-3 w-3 text-[#0066CC]" aria-hidden="true" />
                            {slot.slotStartIso.slice(11, 16)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {formatVisitMode(slot.visitMode, locale)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600">
                      {copy.emptySlotsCalendarHint}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <BookmarkButton
                    entry={{
                      id: person.id,
                      kind: isNurse ? "NURSE" : "DOCTOR",
                      countryCode: person.countryCode,
                      title: person.fullName,
                      subtitle: `${localizedSpecialty} · ${person.facilityName ?? person.countryCode}`,
                      ...(person.facilityId ? { facilityId: person.facilityId } : {}),
                      ...(person.facilityName ? { facilityName: person.facilityName } : {}),
                      href: bookingHref,
                    }}
                  />
                  {isNurse ? (
                    <Link
                      href={bookingHref}
                      className="inline-flex h-10 items-center rounded-xl bg-[#0066CC] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0052A3] active:scale-[0.98]"
                    >
                      {copy.requestHomeVisitBtn}
                    </Link>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`${bookingHref}&mode=IN_PERSON`}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0066CC] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#0052A3] active:scale-[0.98]"
                        >
                          <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{copy.visitWorkplaceBtn}</span>
                        </Link>
                        {person.telehealthEnabled ? (
                          <Link
                            href={`${bookingHref}&mode=TELEHEALTH`}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-[#0066CC] transition hover:bg-[#0066CC] hover:text-white active:scale-[0.98]"
                          >
                          <Video className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{copy.videoCallBtn}</span>
                        </Link>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        ) : target.kind === "DRIVER" ? (
          (() => {
            const drv = target.driver;
            const vehiclePhoto = resolveVehiclePicture(drv.vehicleType);

            return (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      <img
                        src={vehiclePhoto}
                        alt={drv.vehicleLabel}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <UiBadge tone={drv.liveStatus === "AVAILABLE" ? "emerald" : "amber"}>
                          {drv.liveStatus
                            ? formatDriverStatus(drv.liveStatus, locale)
                            : copy.standbyStatus}
                        </UiBadge>
                        <UiBadge tone="red">
                          {drv.vehicleType === "AMBULANCE"
                            ? copy.emsAmbulance
                            : copy.medicalShuttle}
                        </UiBadge>
                      </div>
                      <h2 className="mt-1 text-lg font-bold text-slate-900">
                        <bdi dir="auto">{drv.fullName}</bdi>
                      </h2>
                      <p className="text-xs text-slate-600">{drv.vehicleLabel}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyLink()}
                      aria-label={copy.copyLinkAria}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:border-teal-700"
                    >
                      {copiedLink ? (
                        <Check className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={copy.closeModalAria}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {copy.coverageZoneLabel}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">{drv.serviceZone}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {copy.dispatchBaseFacilityLabel}
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">
                      <bdi dir="auto">{drv.facilityName ?? copy.regionalDispatch}</bdi>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <Link
                    href={`/map?country=${drv.countryCode}&layer=DRIVER&fastBook=1`}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-rose-600 px-5 text-xs font-bold text-white shadow-xs transition hover:bg-rose-700 active:scale-[0.98]"
                  >
                    <Ambulance className="h-4 w-4" aria-hidden="true" />
                    <span>{copy.fastBookUnitBtn}</span>
                  </Link>
                </div>
              </div>
            );
          })()
        ) : (
          (() => {
            const fac = target.facility;
            const facPhoto = resolveFacilityPicture(fac.kind);
            const kindLabel = formatFacilityKind(fac.kind, locale);
            const targetHref =
              fac.kind === "PHARMACY"
                ? `/pharmacy?country=${fac.countryCode}&facilityId=${fac.id}`
                : `/map?country=${fac.countryCode}&facilityId=${fac.id}`;
            const ctaLabel =
              fac.kind === "PHARMACY"
                ? copy.openPharmacyCatalogBtn
                : copy.locateOnMapBtn;

            return (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3.5">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      <img
                        src={facPhoto}
                        alt={fac.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          {copy.ministryVerified}
                        </span>
                        <UiBadge tone={fac.openStatus === "OPEN" ? "emerald" : "amber"}>
                          {formatOpenStatus(fac.openStatus, locale)}
                        </UiBadge>
                        <UiBadge tone="slate">{kindLabel}</UiBadge>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900">
                        <bdi dir="auto">{fac.name}</bdi>
                      </h2>
                      <p className="text-xs text-slate-600">
                        <bdi dir="auto">{fac.address}</bdi>
                      </p>
                      <p className="font-mono-tabular text-[11px] font-medium text-slate-500">
                        {copy.licenseLabel} {fac.licenseNumber} · {fac.countryCode}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyLink()}
                      aria-label={copy.copyLinkAria}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:border-teal-700"
                    >
                      {copiedLink ? (
                        <Check className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      aria-label={copy.closeModalAria}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {target.teamDoctors.length > 0 ||
                target.teamNurses.length > 0 ||
                target.fleetDrivers.length > 0 ? (
                  (() => {
                    const totalStaffCount =
                      target.teamDoctors.length +
                      target.teamNurses.length +
                      target.fleetDrivers.length;
                    const isOddMulti =
                      totalStaffCount > 1 && totalStaffCount % 2 === 1;
                    const docsOffset = 0;
                    const nursesOffset = target.teamDoctors.length;
                    const driversOffset =
                      target.teamDoctors.length + target.teamNurses.length;

                    return (
                      <div className="space-y-2.5 rounded-2xl border border-[#D7E4F2] bg-[#F3F8FD] p-4">
                        <p className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                          <Building2
                            className="h-4 w-4 text-[#0066CC]"
                            aria-hidden="true"
                          />
                          {copy.staffUnitsHeading}
                        </p>
                        <div
                          className={`grid gap-2 ${
                            totalStaffCount === 1
                              ? "grid-cols-1"
                              : "grid-cols-1 sm:grid-cols-2"
                          }`}
                        >
                          {target.teamDoctors.map((doc, idx) => {
                            const spanLast =
                              isOddMulti &&
                              docsOffset + idx === totalStaffCount - 1;
                            return (
                              <button
                                key={doc.id}
                                type="button"
                                onClick={() => onInspectDoctor?.(doc)}
                                className={`flex items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-3 py-2 text-start text-xs transition hover:ring-2 hover:ring-emerald-600/30 active:scale-[0.98] ${
                                  spanLast ? "sm:col-span-2" : ""
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-bold text-slate-900">
                                    <bdi dir="auto">{doc.fullName}</bdi>
                                  </p>
                                  <p className="truncate text-[11px] text-slate-500">
                                    {formatSpecialtyLabel(doc.specialty, locale)}
                                  </p>
                                </div>
                                <span className="font-mono-tabular shrink-0 font-bold text-[#0066CC]">
                                  {formatMoney(
                                    doc.consultationFeeMinor,
                                    currencyCode,
                                  )}
                                </span>
                              </button>
                            );
                          })}
                          {target.teamNurses.map((nurse, idx) => {
                            const spanLast =
                              isOddMulti &&
                              nursesOffset + idx === totalStaffCount - 1;
                            return (
                              <button
                                key={nurse.id}
                                type="button"
                                onClick={() => onInspectDoctor?.(nurse)}
                                className={`flex items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-3 py-2 text-start text-xs transition hover:ring-2 hover:ring-emerald-600/30 active:scale-[0.98] ${
                                  spanLast ? "sm:col-span-2" : ""
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-bold text-slate-900">
                                    <bdi dir="auto">{nurse.fullName}</bdi>
                                  </p>
                                  <p className="truncate text-[11px] text-[#0066CC]">
                                    {formatSpecialtyLabel(
                                      nurse.specialty,
                                      locale,
                                    )}{" "}
                                    · {copy.nurseHomeVisitTag}
                                  </p>
                                </div>
                                <span className="font-mono-tabular shrink-0 font-bold text-[#0066CC]">
                                  {formatMoney(
                                    nurse.consultationFeeMinor,
                                    currencyCode,
                                  )}
                                </span>
                              </button>
                            );
                          })}
                          {target.fleetDrivers.map((drv, idx) => {
                            const spanLast =
                              isOddMulti &&
                              driversOffset + idx === totalStaffCount - 1;
                            return (
                              <button
                                key={drv.id}
                                type="button"
                                onClick={() => onInspectDriver?.(drv)}
                                className={`flex items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-3 py-2 text-start text-xs transition hover:ring-2 hover:ring-rose-500/30 active:scale-[0.98] ${
                                  spanLast ? "sm:col-span-2" : ""
                                }`}
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-bold text-slate-900">
                                    <bdi dir="auto">{drv.fullName}</bdi>
                                  </p>
                                  <p className="truncate text-[11px] text-slate-500">
                                    {drv.vehicleLabel}
                                  </p>
                                </div>
                                <UiBadge tone="red">
                                  {drv.vehicleType === "AMBULANCE"
                                    ? copy.emsAmbulance
                                    : copy.medicalShuttle}
                                </UiBadge>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <BookmarkButton
                    entry={{
                      id: fac.id,
                      kind:
                        fac.kind === "PHARMACY"
                          ? "PHARMACY"
                          : fac.kind === "DIAGNOSTIC_LAB"
                            ? "LAB"
                            : fac.kind === "HOSPITAL"
                              ? "HOSPITAL"
                              : "CLINIC",
                      countryCode: fac.countryCode,
                      title: fac.name,
                      subtitle: `${kindLabel} · ${fac.address}`,
                      facilityId: fac.id,
                      facilityName: fac.name,
                      href: targetHref,
                    }}
                  />
                  <Link
                    href={targetHref}
                    className="inline-flex h-10 items-center rounded-xl bg-[#0066CC] px-5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0052A3] active:scale-[0.98]"
                  >
                    {ctaLabel}
                  </Link>
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
