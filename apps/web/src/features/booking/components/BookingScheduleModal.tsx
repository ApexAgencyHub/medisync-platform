"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  PHONE_NUMBER_REGEX,
  type AvailableSlot,
  type VisitMode,
} from "@medisync/contracts";
import {
  CalendarClock,
  CheckCircle2,
  Home,
  LocateFixed,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Video,
  X,
} from "lucide-react";
import { formatVisitMode } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { formatSpecialtyLabel } from "@/shared/i18n/specialties";
import { EntityAvatar } from "@/shared/ui/EntityAvatar";
import { UiBadge, UiButton, UiInput } from "@/shared/ui/primitives";
import { BOOKING_COPY } from "../booking-i18n";
import { formatLanguageCodes } from "./booking-utils";

export interface SelectedPractitionerInfo {
  key: string;
  doctorUserId: string;
  doctorName: string;
  specialty: string;
  facilityId: string;
  facilityName: string;
  facilityAddress: string | null;
  avatarUrl: string | null;
  licenseNumber: string | null;
  bio: string | null;
  acceptedInsurances: readonly string[];
  languagesSpoken: readonly string[];
  credentialVerified: boolean;
  telehealthEnabled?: boolean | undefined;
  consultationFeeMinor: number;
  countryCode: string;
  initialSlotKey?: string | undefined;
  preferredVisitMode?: VisitMode | undefined;
}

export interface GuestBookingContact {
  fullName: string;
  phone: string;
}

interface BookingScheduleModalProps {
  practitioner: SelectedPractitionerInfo;
  slots: readonly AvailableSlot[];
  currencyCode: string;
  selectedDate: string;
  weekdayLabel: string;
  rollingDates: ReadonlyArray<{ label: string; sublabel: string; value: string }>;
  nextAvailableSuggestion: { isoDate: string; label: string } | null;
  signedInUserName: string | null;
  busy: boolean;
  onSelectDate: (date: string) => void;
  onConfirm: (
    slot: AvailableSlot,
    reason: string,
    guestContact?: GuestBookingContact,
  ) => Promise<string | null>;
  onClose: () => void;
}

/** Displays a practitioner's clinic metadata, consultation option toggle, morning/afternoon slots, and confirms a booking cleanly. */
export function BookingScheduleModal({
  practitioner,
  slots,
  currencyCode,
  selectedDate,
  weekdayLabel,
  rollingDates,
  nextAvailableSuggestion,
  signedInUserName,
  busy,
  onSelectDate,
  onConfirm,
  onClose,
}: BookingScheduleModalProps) {
  const { locale, isRtl } = useLocale();
  const copy = BOOKING_COPY[locale];
  const localizedSpecialty = formatSpecialtyLabel(practitioner.specialty, locale);

  const defaultSlot =
    (practitioner.initialSlotKey
      ? slots.find(
          (s) =>
            `${s.scheduleId}-${s.slotStartIso}` ===
              practitioner.initialSlotKey && s.isAvailable,
        )
      : undefined) ??
    slots.find((s) => s.isAvailable) ??
    slots[0] ??
    null;

  const [selectedSlotKey, setSelectedSlotKey] = useState<string>(
    defaultSlot ? `${defaultSlot.scheduleId}-${defaultSlot.slotStartIso}` : "",
  );
  const allowTelehealth = practitioner.telehealthEnabled !== false;
  const [selectedDoctorMode, setSelectedDoctorMode] = useState<
    "IN_PERSON" | "TELEHEALTH"
  >(() =>
    allowTelehealth &&
    (practitioner.preferredVisitMode === "TELEHEALTH" ||
      (!practitioner.preferredVisitMode &&
        defaultSlot?.visitMode === "TELEHEALTH"))
      ? "TELEHEALTH"
      : "IN_PERSON",
  );
  const [reason, setReason] = useState("");
  const [guestFullName, setGuestFullName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestCndpConsent, setGuestCndpConsent] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [locatingHomeGps, setLocatingHomeGps] = useState(false);

  useEffect(() => {
    setModalError(null);
    setGuestCndpConsent(false);
    if (allowTelehealth && practitioner.preferredVisitMode === "TELEHEALTH") {
      setSelectedDoctorMode("TELEHEALTH");
    } else if (practitioner.preferredVisitMode === "IN_PERSON") {
      setSelectedDoctorMode("IN_PERSON");
    }
  }, [practitioner.key, practitioner.preferredVisitMode, allowTelehealth]);

  useEffect(() => {
    if (practitioner.initialSlotKey) {
      const requested = slots.find(
        (s) =>
          `${s.scheduleId}-${s.slotStartIso}` === practitioner.initialSlotKey &&
          s.isAvailable,
      );
      if (requested) {
        setSelectedSlotKey(`${requested.scheduleId}-${requested.slotStartIso}`);
        return;
      }
    }
    const stillValid = slots.find(
      (s) =>
        `${s.scheduleId}-${s.slotStartIso}` === selectedSlotKey &&
        s.isAvailable,
    );
    if (!stillValid) {
      const next = slots.find((s) => s.isAvailable) ?? slots[0] ?? null;
      setSelectedSlotKey(next ? `${next.scheduleId}-${next.slotStartIso}` : "");
    }
  }, [slots, selectedSlotKey, practitioner.initialSlotKey]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const isHomeVisitSpecialty = /nursing|infirmier|nurse/i.test(
    practitioner.specialty,
  );
  const hasHomeVisitSlots =
    slots.some((s) => s.visitMode === "HOME_VISIT") || isHomeVisitSpecialty;

  const activeSlot =
    slots.find((s) => `${s.scheduleId}-${s.slotStartIso}` === selectedSlotKey) ??
    defaultSlot;
  const effectiveVisitMode: VisitMode = hasHomeVisitSlots
    ? (activeSlot?.visitMode ?? "HOME_VISIT")
    : selectedDoctorMode;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSlot || !activeSlot.isAvailable) return;

    let guestContact: GuestBookingContact | undefined;
    if (!signedInUserName) {
      const trimmedName = guestFullName.trim();
      const trimmedPhone = guestPhone.trim();
      if (trimmedName.length < 2) {
        setModalError(copy.modalErrShortName);
        return;
      }
      if (!PHONE_NUMBER_REGEX.test(trimmedPhone)) {
        setModalError(copy.modalErrInvalidPhone);
        return;
      }
      if (!guestCndpConsent) {
        setModalError(copy.modalErrConsentRequired);
        return;
      }
      guestContact = { fullName: trimmedName, phone: trimmedPhone };
    }

    setModalError(null);
    const err = await onConfirm(
      { ...activeSlot, visitMode: effectiveVisitMode },
      reason,
      guestContact,
    );
    if (err) {
      setModalError(err);
    }
  }

  function handleHomeVisitGpsPin() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setLocatingHomeGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gpsPrefix =
          locale === "fr"
            ? "Position GPS domicile"
            : locale === "ar"
              ? "موقع GPS للمنزل"
              : "Home GPS";
        const coordsLabel = `${gpsPrefix} (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`;
        setReason((prev) =>
          prev.trim() ? `${coordsLabel} · ${prev.trim()}` : coordsLabel,
        );
        setLocatingHomeGps(false);
      },
      () => {
        setLocatingHomeGps(false);
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );
  }

  const morningSlots = slots.filter(
    (s) => Number(s.slotStartIso.slice(11, 13)) < 12,
  );
  const afternoonSlots = slots.filter(
    (s) => Number(s.slotStartIso.slice(11, 13)) >= 12,
  );

  function renderModeIcon(mode: AvailableSlot["visitMode"], className: string) {
    if (mode === "HOME_VISIT") {
      return <Home className={className} aria-hidden="true" />;
    }
    if (mode === "TELEHEALTH") {
      return <Video className={className} aria-hidden="true" />;
    }
    return <Stethoscope className={className} aria-hidden="true" />;
  }

  function renderSlotGroup(label: string, groupSlots: readonly AvailableSlot[]) {
    if (groupSlots.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        <div className="grid grid-cols-3 gap-2">
          {groupSlots.map((slot) => {
            const slotKey = `${slot.scheduleId}-${slot.slotStartIso}`;
            const isSelected =
              activeSlot &&
              `${activeSlot.scheduleId}-${activeSlot.slotStartIso}` === slotKey;
            const timeRange = `${slot.slotStartIso.slice(11, 16)}–${slot.slotEndIso.slice(11, 16)}`;

            return (
              <button
                key={slotKey}
                type="button"
                disabled={!slot.isAvailable}
                onClick={() => setSelectedSlotKey(slotKey)}
                aria-pressed={Boolean(isSelected)}
                className={
                  !slot.isAvailable
                    ? "inline-flex min-h-[40px] items-center justify-center gap-1 rounded-xl bg-slate-100 px-2 py-1.5 font-mono-tabular text-xs font-medium text-slate-400 line-through"
                    : isSelected
                      ? "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#0066CC] px-2 py-1.5 font-mono-tabular text-xs font-semibold text-white shadow-xs active:scale-95"
                      : "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-2 py-1.5 font-mono-tabular text-xs font-semibold text-slate-800 hover:bg-[#E1EBF2] hover:text-[#0066CC] active:scale-95"
                }
              >
                {renderModeIcon(
                  hasHomeVisitSlots ? slot.visitMode : selectedDoctorMode,
                  "h-3.5 w-3.5 shrink-0",
                )}
                <span dir="ltr">{timeRange}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${copy.modalScheduleAriaPrefix} ${practitioner.doctorName}`}
      dir={isRtl ? "rtl" : "ltr"}
      onClick={() => {
        if (!busy) onClose();
      }}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-2.5 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#D7E4F2] bg-white shadow-2xl"
      >
        {/* Modal Header */}
        <div className="shrink-0 space-y-2.5 bg-[#F3F8FD] border border-[#D7E4F2] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <EntityAvatar
                name={practitioner.doctorName}
                role="DOCTOR"
                specialty={practitioner.specialty}
                avatarUrl={practitioner.avatarUrl}
                size="sm"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="truncate text-base font-bold text-slate-950">
                    <bdi dir="auto">{practitioner.doctorName}</bdi>
                  </h2>
                  {practitioner.credentialVerified ? (
                    <ShieldCheck
                      className="h-4 w-4 shrink-0 text-[#0066CC]"
                      aria-hidden="true"
                    />
                  ) : null}
                  <UiBadge tone="emerald">{localizedSpecialty}</UiBadge>
                </div>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-600">
                  <MapPin
                    className="h-3 w-3 shrink-0 text-[#0066CC]"
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    {hasHomeVisitSlots
                      ? `${copy.cardDispatchedFrom} ${practitioner.facilityName}`
                      : practitioner.facilityName}
                  </span>
                  <span className="mx-1 text-slate-300">·</span>
                  <span className="font-mono-tabular font-bold text-[#0066CC]">
                    {(practitioner.consultationFeeMinor / 100).toFixed(0)}{" "}
                    {currencyCode}
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              aria-label={copy.modalCloseAria}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-2xs transition hover:bg-slate-100 hover:text-slate-950"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {practitioner.acceptedInsurances.length > 0 ||
          practitioner.languagesSpoken.length > 0 ||
          practitioner.licenseNumber ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
              <div className="flex flex-wrap items-center gap-1">
                {practitioner.acceptedInsurances.map((ins) => (
                  <span
                    key={ins}
                    className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono-tabular text-[10px] font-semibold text-slate-700"
                  >
                    {ins}
                  </span>
                ))}
                {practitioner.licenseNumber ? (
                  <span className="font-mono-tabular text-[10px] font-medium text-slate-500">
                    {copy.modalLicensePrefix} {practitioner.licenseNumber}
                  </span>
                ) : null}
              </div>
              {practitioner.languagesSpoken.length > 0 ? (
                <span className="font-mono-tabular font-medium">
                  {formatLanguageCodes(practitioner.languagesSpoken)}
                </span>
              ) : null}
            </div>
          ) : null}
          {practitioner.bio ? (
            <p className="text-[11px] leading-snug text-slate-600">
              {practitioner.bio}
            </p>
          ) : null}
        </div>

        {/* Scrollable Slot Picker + Confirmation Form */}
        <form
          noValidate
          onSubmit={(e) => void handleSubmit(e)}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-width:thin]"
        >
          {/* Doctor Consultation Option Selector (Visit Workplace vs Video Call) */}
          {!hasHomeVisitSlots ? (
            <div className="space-y-2">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {copy.modalHowToSeeDoctor}
              </span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={selectedDoctorMode === "IN_PERSON"}
                  onClick={() => setSelectedDoctorMode("IN_PERSON")}
                  className={`flex items-start gap-2.5 rounded-xl p-3 text-start transition active:scale-[0.99] ${
                    selectedDoctorMode === "IN_PERSON"
                      ? "bg-emerald-50 ring-2 ring-emerald-700"
                      : "bg-[#F3F8FD] border border-[#D7E4F2] hover:bg-[#E1EBF2]"
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                      selectedDoctorMode === "IN_PERSON"
                        ? "bg-[#0066CC] text-white"
                        : "bg-white text-slate-600 shadow-2xs"
                    }`}
                  >
                    <Stethoscope className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900">
                      {copy.visitWorkplace}
                    </p>
                    <p className="truncate text-[11px] text-slate-600">
                      <bdi dir="auto">{practitioner.facilityName}</bdi>
                    </p>
                    {practitioner.facilityAddress ? (
                      <p className="truncate text-[10px] text-slate-500">
                        <bdi dir="auto">{practitioner.facilityAddress}</bdi>
                      </p>
                    ) : null}
                  </div>
                </button>

                {allowTelehealth ? (
                  <button
                    type="button"
                    aria-pressed={selectedDoctorMode === "TELEHEALTH"}
                    onClick={() => setSelectedDoctorMode("TELEHEALTH")}
                    className={`flex items-start gap-2.5 rounded-xl p-3 text-start transition active:scale-[0.99] ${
                      selectedDoctorMode === "TELEHEALTH"
                        ? "bg-emerald-50 ring-2 ring-emerald-700"
                        : "bg-[#F3F8FD] border border-[#D7E4F2] hover:bg-[#E1EBF2]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        selectedDoctorMode === "TELEHEALTH"
                          ? "bg-[#0066CC] text-white"
                          : "bg-white text-slate-600 shadow-2xs"
                      }`}
                    >
                      <Video className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">
                        {copy.videoCall}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {copy.modalVideoSub}
                      </p>
                    </div>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Date Selector Synced With Page */}
          <div className="space-y-2">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {copy.modalSelectDatePrefix} · {weekdayLabel} ({selectedDate})
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {rollingDates.map((preset) => {
                const active = selectedDate === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectDate(preset.value)}
                    className={`inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold transition ${
                      active
                        ? "bg-[#0066CC] text-white"
                        : "bg-[#F3F8FD] border border-[#D7E4F2] text-slate-700 hover:bg-[#E1EBF2]"
                    }`}
                  >
                    <span>{preset.label}</span>
                  </button>
                );
              })}
              <input
                type="date"
                aria-label={copy.modalChangeDateAria}
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) onSelectDate(e.target.value);
                }}
                className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 font-mono-tabular text-xs font-semibold text-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Practitioner Time Slots Grouped Morning / Afternoon */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {copy.modalAvailableWindows} ({slots.filter((s) => s.isAvailable).length}{" "}
              {copy.modalOpenCountSuffix})
            </p>

            {slots.length === 0 ? (
              <div className="space-y-2.5 rounded-2xl bg-[#F3F8FD] border border-[#D7E4F2] p-5 text-center">
                <CalendarClock
                  className="mx-auto h-6 w-6 text-slate-400"
                  aria-hidden="true"
                />
                <p className="text-xs font-medium text-slate-700">
                  {copy.modalNoHoursFor} {practitioner.doctorName}{" "}
                  {copy.modalOnWord} {weekdayLabel}.
                </p>
                {nextAvailableSuggestion ? (
                  <UiButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => onSelectDate(nextAvailableSuggestion.isoDate)}
                    className="rounded-full"
                  >
                    {copy.modalJumpNextDay} ({nextAvailableSuggestion.label}) →
                  </UiButton>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {renderSlotGroup(copy.modalMorningHours, morningSlots)}
                {renderSlotGroup(copy.modalAfternoonHours, afternoonSlots)}
              </div>
            )}
          </div>

          {/* Consultation / Home Visit Confirmation Note */}
          {activeSlot && activeSlot.isAvailable ? (
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#E8F1FA] px-3.5 py-2.5 text-xs">
                <span className="font-semibold text-slate-800">
                  {copy.modalSelectedWindow}{" "}
                  <span dir="ltr" className="inline-block font-mono-tabular text-[#0066CC]">
                    {activeSlot.slotStartIso.slice(11, 16)}–
                    {activeSlot.slotEndIso.slice(11, 16)}
                  </span>
                </span>
                <UiBadge tone="emerald">
                  {formatVisitMode(effectiveVisitMode, locale)}
                </UiBadge>
              </div>

              {!signedInUserName ? (
                <div className="space-y-2.5 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      {copy.modalContactDetails}{" "}
                      <span className="font-semibold text-[#0066CC]">
                        {copy.modalRequired}
                      </span>
                    </span>
                    <Link
                      href="/portal"
                      className="text-[11px] font-semibold text-[#0066CC] hover:underline"
                    >
                      {copy.modalAlreadyRegistered} →
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="guest-full-name"
                        className="mb-1 block text-[11px] font-semibold text-slate-700"
                      >
                        {copy.modalFullNameLabel}
                      </label>
                      <UiInput
                        id="guest-full-name"
                        type="text"
                        required
                        aria-required="true"
                        minLength={2}
                        autoComplete="name"
                        placeholder={copy.modalFullNamePlaceholder}
                        value={guestFullName}
                        onChange={(e) => {
                          setGuestFullName(e.target.value);
                          if (modalError) setModalError(null);
                        }}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="guest-phone"
                        className="mb-1 block text-[11px] font-semibold text-slate-700"
                      >
                        {copy.modalPhoneLabel}
                      </label>
                      <UiInput
                        id="guest-phone"
                        type="tel"
                        required
                        aria-required="true"
                        autoComplete="tel"
                        placeholder="+212 612 345 678"
                        value={guestPhone}
                        onChange={(e) => {
                          setGuestPhone(e.target.value);
                          if (modalError) setModalError(null);
                        }}
                      />
                    </div>
                  </div>
                  <label
                    htmlFor="guest-cndp-consent"
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-2 text-[11px] leading-snug text-slate-600"
                  >
                    <input
                      id="guest-cndp-consent"
                      type="checkbox"
                      checked={guestCndpConsent}
                      onChange={(e) => {
                        setGuestCndpConsent(e.target.checked);
                        if (modalError) setModalError(null);
                      }}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-emerald-700"
                    />
                    <span>
                      {copy.modalConsentPrefix}
                      {practitioner.countryCode === "MA"
                        ? copy.modalCndpNotice
                        : copy.modalPrivacyNotice}
                      {copy.modalConsentSuffix}
                    </span>
                  </label>
                </div>
              ) : null}

              {modalError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
                >
                  {modalError}
                </p>
              ) : null}

              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label
                    htmlFor="confirm-visit-reason"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {effectiveVisitMode === "HOME_VISIT"
                      ? copy.modalHomeInstructionsLabel
                      : copy.modalConsultationNoteLabel}{" "}
                    <span className="font-normal text-slate-400">
                      {copy.modalOptional}
                    </span>
                  </label>
                  {effectiveVisitMode === "HOME_VISIT" ? (
                    <button
                      type="button"
                      disabled={locatingHomeGps}
                      onClick={handleHomeVisitGpsPin}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#0066CC] hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <LocateFixed className="h-3 w-3" aria-hidden="true" />
                      <span>
                        {locatingHomeGps ? copy.modalLocating : copy.modalAutoGpsPin}
                      </span>
                    </button>
                  ) : null}
                </div>
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {(effectiveVisitMode === "HOME_VISIT"
                    ? locale === "fr"
                      ? ["Pansement / Soin", "Injection prescrite", "Suivi tension / constantes", "Soin post-opératoire"]
                      : locale === "ar"
                        ? ["تضميد جرح", "حقنة بوصفة طبية", "قياس الضغط والعلامات الحيوية", "رعاية ما بعد العملية"]
                        : ["Wound Dressing", "Prescribed Injection", "BP & Vitals Check", "Post-Op Care"]
                    : locale === "fr"
                      ? ["Suivi médical", "Renouvellement ordonnance", "Lecture résultats bilan", "Nouveau symptôme"]
                      : locale === "ar"
                        ? ["متابعة طبية", "تجديد الوصفة", "قراءة نتائج التحاليل", "أعراض جديدة"]
                        : ["Medical Follow-Up", "Prescription Renewal", "Lab Results Review", "New Symptom"]
                  ).map((chip) => {
                    const active = reason === chip;
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setReason(chip)}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition active:scale-95 ${
                          active
                            ? "border-[#0066CC] bg-[#0066CC] text-white"
                            : "border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661] hover:border-[#0066CC] hover:bg-white"
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
                <UiInput
                  id="confirm-visit-reason"
                  type="text"
                  placeholder={
                    effectiveVisitMode === "HOME_VISIT"
                      ? copy.modalHomePlaceholder
                      : copy.modalClinicPlaceholder
                  }
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <p className="text-[11px] text-slate-500">
              {signedInUserName
                ? `${copy.modalBookingAsPrefix} ${signedInUserName}`
                : effectiveVisitMode === "HOME_VISIT"
                  ? copy.modalNurseFooterHint
                  : effectiveVisitMode === "TELEHEALTH"
                    ? copy.modalVideoFooterHint
                    : copy.modalClinicFooterHint}
            </p>
            <div className="flex items-center gap-2">
              <UiButton
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={onClose}
              >
                {copy.modalCancel}
              </UiButton>
              <UiButton
                type="submit"
                disabled={busy || !activeSlot || !activeSlot.isAvailable}
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{busy ? copy.modalConfirming : copy.modalConfirmVisit}</span>
              </UiButton>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
