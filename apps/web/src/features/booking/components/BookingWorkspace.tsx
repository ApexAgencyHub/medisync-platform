"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  VisitModeSchema,
  type AppointmentStatus,
  type AppointmentSummary,
  type AuthResponse,
  type AvailableSlot,
  type CountryPack,
  type VisitMode,
} from "@medisync/contracts";
import { checkBackendOnline } from "@/shared/api/directory-client";
import { ensureGuestPatientSession } from "@/shared/auth/guest-session";
import {
  clearStoredSession,
  readStoredSession,
} from "@/shared/auth/session-storage";
import { formatVisitMode } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { addGuestActivityPass } from "@/shared/patient/patient-local-store";
import { BookmarkButton } from "@/shared/ui/BookmarkButton";
import {
  resolveDefaultAvatar,
  resolveFacilityPicture,
  EntityAvatar,
} from "@/shared/ui/EntityAvatar";
import { EntityMediaPair } from "@/shared/ui/EntityMediaPair";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
} from "@/shared/config/deployment";
import {
  ActiveRegionPill,
  SessionAccountBar,
  StatusBanner,
  UiBadge,
  UiButton,
  UiInput,
  UiSelect,
  UiSwitch,
} from "@/shared/ui/primitives";
import { CalendarClock, Search, Stethoscope, Video } from "lucide-react";
import {
  createAppointment,
  fetchAppointments,
  fetchAvailableSlots,
  transitionAppointmentStatus,
} from "../api-client";

interface BookingWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

type ProviderCategoryFilter = "ALL" | "DOCTORS" | "NURSES";

interface GroupedProviderSlots {
  key: string;
  doctorUserId: string;
  doctorName: string;
  specialty: string;
  facilityId: string;
  facilityName: string;
  consultationFeeMinor: number;
  countryCode: string;
  slots: AvailableSlot[];
}

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const STATUS_BADGE_TONE: Record<
  AppointmentStatus,
  "teal" | "amber" | "emerald" | "slate" | "red"
> = {
  CONFIRMED: "teal",
  CHECKED_IN: "amber",
  COMPLETED: "emerald",
  CANCELLED: "slate",
  NO_SHOW: "red",
};

function getNextMondayIsoDate(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const offset = day === 1 ? 0 : (8 - day) % 7 || 7;
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset),
  );
  return target.toISOString().slice(0, 10);
}

function getUtcDayOfWeek(dateStr: string): number {
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? 1 : parsed.getUTCDay();
}

function isNurseSpecialty(specialty: string): boolean {
  return /nursing|infirmier|nurse/i.test(specialty);
}

export function BookingWorkspace({
  packs,
  apiBaseUrl,
}: BookingWorkspaceProps) {
  const { t } = useLocale();
  const defaultCode = resolveActivePack(packs)?.code ?? ACTIVE_COUNTRY_CODE;

  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCode);
  const [selectedDate, setSelectedDate] = useState<string>(
    getNextMondayIsoDate,
  );
  const [providerFilter, setProviderFilter] =
    useState<ProviderCategoryFilter>("ALL");
  const [doctorIdFilter, setDoctorIdFilter] = useState<string>("");
  const [facilityFilterId, setFacilityFilterId] = useState<string>("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [visitModeFilter, setVisitModeFilter] = useState<VisitMode | "ALL">(
    "ALL",
  );
  const [includeBooked, setIncludeBooked] = useState(true);
  const [bookingReason, setBookingReason] = useState("");

  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlotByGroup, setSelectedSlotByGroup] = useState<
    Record<string, string>
  >({});
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [apiOnline, setApiOnline] = useState(false);

  const [session, setSession] = useState<AuthResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{
    tone: "info" | "success" | "error";
    text: string;
  } | null>(null);

  const activePack =
    packs.find((pack) => pack.code === selectedCountry) ?? packs[0];

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSession(stored);
      setSelectedCountry(stored.user.countryCode);
    }

    if (typeof window !== "undefined") {
      const qs = new URLSearchParams(window.location.search);
      const qCountry = qs.get("country");
      const qFacility = qs.get("facilityId");
      const qDoctor = qs.get("doctorId");
      const qProvider = qs.get("provider");
      if (qCountry && packs.some((p) => p.code === qCountry.toUpperCase())) {
        setSelectedCountry(qCountry.toUpperCase());
      }
      if (qFacility) setFacilityFilterId(qFacility);
      if (qDoctor) setDoctorIdFilter(qDoctor);
      if (qProvider === "nurse") setProviderFilter("NURSES");
      if (qProvider === "doctor") setProviderFilter("DOCTORS");
    }

    let cancelled = false;
    checkBackendOnline().then((online) => {
      if (!cancelled) setApiOnline(online);
    });
    return () => {
      cancelled = true;
    };
  }, [packs]);

  useEffect(() => {
    if (!apiOnline) return;
    let active = true;

    fetchAvailableSlots(apiBaseUrl, {
      date: selectedDate,
      countryCode: selectedCountry,
      ...(facilityFilterId ? { facilityId: facilityFilterId } : {}),
      ...(specialtyFilter.trim() ? { specialty: specialtyFilter.trim() } : {}),
      ...(visitModeFilter !== "ALL" ? { visitMode: visitModeFilter } : {}),
      includeBooked,
    }).then((slotsRes) => {
      if (!active || !slotsRes.ok) return;
      setSlots(slotsRes.data.slots);
    });

    if (session?.token) {
      fetchAppointments(apiBaseUrl, session.token, selectedCountry).then(
        (res) => {
          if (active && res.ok) setAppointments(res.data.appointments);
        },
      );
    }

    return () => {
      active = false;
    };
  }, [
    apiOnline,
    apiBaseUrl,
    selectedCountry,
    selectedDate,
    facilityFilterId,
    specialtyFilter,
    visitModeFilter,
    includeBooked,
    session?.token,
  ]);

  const groupedProviders = useMemo<GroupedProviderSlots[]>(() => {
    const map = new Map<string, GroupedProviderSlots>();

    for (const slot of slots) {
      if (doctorIdFilter && slot.doctorUserId !== doctorIdFilter) continue;
      const nurseTrack = isNurseSpecialty(slot.specialty);
      if (providerFilter === "NURSES" && !nurseTrack) continue;
      if (providerFilter === "DOCTORS" && nurseTrack) continue;

      const key = `${slot.doctorUserId}::${slot.facilityId}`;
      const existing = map.get(key);
      if (existing) {
        existing.slots.push(slot);
      } else {
        map.set(key, {
          key,
          doctorUserId: slot.doctorUserId,
          doctorName: slot.doctorName,
          specialty: slot.specialty,
          facilityId: slot.facilityId,
          facilityName: slot.facilityName,
          consultationFeeMinor: slot.consultationFeeMinor,
          countryCode: slot.countryCode,
          slots: [slot],
        });
      }
    }

    return Array.from(map.values());
  }, [slots, doctorIdFilter, providerFilter]);

  async function refreshSlotsAndAppointments(tokenOverride?: string | null) {
    const activeToken = tokenOverride ?? session?.token;
    const [slotsRes, apptsRes] = await Promise.all([
      fetchAvailableSlots(apiBaseUrl, {
        date: selectedDate,
        countryCode: selectedCountry,
        ...(facilityFilterId ? { facilityId: facilityFilterId } : {}),
        ...(specialtyFilter.trim() ? { specialty: specialtyFilter.trim() } : {}),
        ...(visitModeFilter !== "ALL" ? { visitMode: visitModeFilter } : {}),
        includeBooked,
      }),
      activeToken
        ? fetchAppointments(apiBaseUrl, activeToken, selectedCountry)
        : Promise.resolve(null),
    ]);

    if (slotsRes.ok) {
      setSlots(slotsRes.data.slots);
    }
    if (apptsRes && apptsRes.ok) {
      setAppointments(apptsRes.data.appointments);
    }
    return slotsRes;
  }

  async function handleSearchSlots() {
    setBusy(true);
    setBanner(null);
    const res = await refreshSlotsAndAppointments();
    setBusy(false);

    if (!res.ok) {
      setBanner({ tone: "error", text: `Slot search failed: ${res.error}` });
      return;
    }

    const distinctCount = new Set(
      res.data.slots.map((s) => `${s.doctorUserId}::${s.facilityId}`),
    ).size;
    setBanner({
      tone: "info",
      text: `Showing ${distinctCount} provider schedule(s) (${res.data.slots.length} time windows) for ${selectedDate}.`,
    });
  }

  async function handleBookSlot(slot: AvailableSlot) {
    let activeToken = session?.token ?? null;
    if (!activeToken) {
      if (apiOnline) {
        setBusy(true);
        const guestSession = await ensureGuestPatientSession(
          apiBaseUrl,
          selectedCountry,
        );
        if (guestSession) {
          setSession(guestSession);
          activeToken = guestSession.token;
        }
      }
      if (!activeToken) {
        const trackingCode = `VISIT-${Math.floor(1000 + Math.random() * 9000)}`;
        addGuestActivityPass({
          id: `appt-${slot.scheduleId}-${slot.slotStartIso}`,
          kind: "APPOINTMENT",
          countryCode: slot.countryCode,
          title: `${slot.doctorName} (${formatVisitMode(slot.visitMode)})`,
          landmarkOrFacility: slot.facilityName,
          scheduledAtIso: slot.slotStartIso,
          trackingCode,
          statusLabel: "Guest Visit Pass Held",
        });
        setBusy(false);
        setBanner({
          tone: "success",
          text: `Saved Guest Visit Pass ${trackingCode} for ${slot.doctorName} (${slot.facilityName}). Check countdown & details in My Care.`,
        });
        return;
      }
    }

    setBusy(true);
    const trimmedReason = bookingReason.trim();
    const res = await createAppointment(apiBaseUrl, activeToken, {
      scheduleId: slot.scheduleId,
      slotStartIso: slot.slotStartIso,
      visitMode: slot.visitMode,
      ...(trimmedReason ? { reason: trimmedReason } : {}),
    });
    setBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text:
          res.status === 409
            ? "That time window was just reserved by another patient. Please choose another time pill."
            : `Booking failed: ${res.error}`,
      });
      await refreshSlotsAndAppointments();
      return;
    }

    setBanner({
      tone: "success",
      text: `Confirmed ${formatVisitMode(res.data.appointment.visitMode)} booking with ${res.data.appointment.doctorName} at ${res.data.appointment.facilityName}.`,
    });
    await refreshSlotsAndAppointments(activeToken);
  }

  async function handleTransitionStatus(
    appointmentId: string,
    status: AppointmentStatus,
  ) {
    if (!session?.token) return;
    setBusy(true);
    const res = await transitionAppointmentStatus(
      apiBaseUrl,
      session.token,
      appointmentId,
      { status },
    );
    setBusy(false);

    if (!res.ok) {
      setBanner({ tone: "error", text: `Status update failed: ${res.error}` });
      return;
    }

    setBanner({
      tone: "success",
      text: `Appointment updated to ${res.data.appointment.status}.`,
    });
    await refreshSlotsAndAppointments();
  }

  const currentUser = session?.user ?? null;
  const canManageStatus =
    currentUser !== null &&
    ["DOCTOR", "CLINIC_STAFF", "HOSPITAL_ADMIN", "OPS_ADMIN"].includes(
      currentUser.role,
    );

  return (
    <div dir={activePack?.direction ?? "ltr"} className="space-y-6">
      <SessionAccountBar
        session={session}
        onSignOut={() => {
          clearStoredSession();
          setSession(null);
          setAppointments([]);
        }}
        prompt="Sign in via Portal to reserve appointments or check visit updates."
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-teal-800">
              {t("booking.eyebrow")}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {t("booking.heading")}
            </h1>
            <p className="text-sm text-slate-600">
              {t("booking.subtitle")} ({activePack?.name ?? selectedCountry})
            </p>
          </div>

          <ActiveRegionPill
            code={selectedCountry}
            name={activePack?.name ?? "Morocco"}
            currencyCode={activePack?.currencyCode}
            emergencyHotline={activePack?.emergencyHotlines.ambulance}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {(
            [
              { id: "ALL", label: "All Practitioners" },
              { id: "DOCTORS", label: "Doctors & Specialists" },
              { id: "NURSES", label: "Nurses (Infirmiers)" },
            ] as const
          ).map((tab) => {
            const active = providerFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setProviderFilter(tab.id)}
                className={
                  active
                    ? "min-h-[34px] rounded-lg bg-teal-800 px-3 py-1 text-xs font-semibold text-white"
                    : "min-h-[34px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-teal-700"
                }
              >
                {tab.label}
              </button>
            );
          })}

          {doctorIdFilter ? (
            <button
              type="button"
              onClick={() => setDoctorIdFilter("")}
              className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-900 hover:bg-teal-100"
            >
              Filtered from Profiles · Show All
            </button>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-3">
            <label
              htmlFor="booking-date"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Preferred Date
            </label>
            <UiInput
              id="booking-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="font-mono-tabular"
            />
          </div>

          <div className="min-w-0 lg:col-span-3">
            <label
              htmlFor="specialty-filter"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Specialty or Care Type
            </label>
            <UiInput
              id="specialty-filter"
              type="text"
              placeholder="Cardiology, Nursing..."
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
            />
          </div>

          <div className="min-w-0 lg:col-span-2">
            <label
              htmlFor="visit-mode-filter"
              className="mb-1 block text-xs font-semibold text-slate-700"
            >
              Visit Format
            </label>
            <UiSelect
              id="visit-mode-filter"
              value={visitModeFilter}
              onChange={(e) =>
                setVisitModeFilter(
                  e.target.value === "ALL"
                    ? "ALL"
                    : VisitModeSchema.parse(e.target.value),
                )
              }
            >
              <option value="ALL">All Formats</option>
              <option value="IN_PERSON">Clinic Visit</option>
              <option value="TELEHEALTH">Video Visit</option>
            </UiSelect>
          </div>

          <div className="flex items-end lg:col-span-2">
            <UiSwitch
              id="booking-include-booked"
              checked={includeBooked}
              onChange={setIncludeBooked}
              label="Show booked"
            />
          </div>

          <div className="flex items-end lg:col-span-2">
            <UiButton
              disabled={busy}
              onClick={() => void handleSearchSlots()}
              className="w-full"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Find Slots</span>
            </UiButton>
          </div>
        </div>

        {banner ? (
          <StatusBanner
            tone={banner.tone}
            message={banner.text}
            className="mt-4"
          />
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-7">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Available Practitioners & Time Windows
                </h2>
                <p className="text-xs text-slate-600">
                  {WEEKDAY_LABELS[getUtcDayOfWeek(selectedDate)]} ·{" "}
                  {selectedDate} · Currency:{" "}
                  <span className="font-mono-tabular font-semibold">
                    {activePack?.currencyCode ?? selectedCountry}
                  </span>
                </p>
              </div>
              <UiBadge tone="teal">
                {groupedProviders.length} provider
                {groupedProviders.length === 1 ? "" : "s"}
              </UiBadge>
            </div>

            <div className="mt-3">
              <label
                htmlFor="visit-reason"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Consultation Note (optional)
              </label>
              <UiInput
                id="visit-reason"
                type="text"
                placeholder="Symptoms, vitals, or follow-up purpose"
                value={bookingReason}
                onChange={(e) => setBookingReason(e.target.value)}
              />
            </div>

            {groupedProviders.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <CalendarClock
                  className="mx-auto h-6 w-6 text-slate-400"
                  aria-hidden="true"
                />
                <p className="mt-2 text-xs font-medium text-slate-700">
                  No open practitioner windows matched your filters on{" "}
                  {WEEKDAY_LABELS[getUtcDayOfWeek(selectedDate)]}. Try picking a
                  weekday or clearing filters.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3.5">
                {groupedProviders.map((group) => {
                  const firstAvailable =
                    group.slots.find((s) => s.isAvailable) ?? group.slots[0]!;
                  const activeSlotId = selectedSlotByGroup[group.key];
                  const selectedSlot =
                    group.slots.find(
                      (s) =>
                        `${s.scheduleId}-${s.slotStartIso}` === activeSlotId,
                    ) ?? firstAvailable;

                  const nurseTrack = isNurseSpecialty(group.specialty);
                  const primaryPhoto = resolveDefaultAvatar(
                    group.doctorName,
                    "DOCTOR",
                    group.specialty,
                  );
                  const workplacePhoto = resolveFacilityPicture(
                    nurseTrack ? "HOSPITAL" : "CLINIC",
                  );

                  return (
                    <li
                      key={group.key}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <EntityMediaPair
                            primarySrc={primaryPhoto}
                            primaryAlt={group.doctorName}
                            primaryLabel={
                              nurseTrack ? "Infirmier Portrait" : "Doctor Portrait"
                            }
                            secondarySrc={workplacePhoto}
                            secondaryAlt={group.facilityName}
                            secondaryLabel={
                              nurseTrack ? "Care Hub" : "Clinic Interior"
                            }
                            title={group.doctorName}
                            subtitle={`${group.specialty} · ${group.facilityName}`}
                            badge={group.specialty}
                            specs={[
                              { label: "Specialty", value: group.specialty },
                              {
                                label: "Facility",
                                value: group.facilityName,
                              },
                              {
                                label: "Visit Fee",
                                value: `${(
                                  group.consultationFeeMinor / 100
                                ).toFixed(2)} ${
                                  activePack?.currencyCode ?? group.countryCode
                                }`,
                              },
                            ]}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="truncate text-sm font-bold text-slate-900">
                                <bdi dir="auto">{group.doctorName}</bdi>
                              </h3>
                              <UiBadge tone={nurseTrack ? "emerald" : "teal"}>
                                {group.specialty}
                              </UiBadge>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-slate-600">
                              <bdi dir="auto">{group.facilityName}</bdi>
                            </p>
                            <p className="mt-1 font-mono-tabular text-xs font-semibold text-teal-800">
                              {(group.consultationFeeMinor / 100).toFixed(2)}{" "}
                              {activePack?.currencyCode ?? group.countryCode}
                            </p>
                          </div>
                        </div>

                        <BookmarkButton
                          compact
                          entry={{
                            id: group.doctorUserId,
                            kind: nurseTrack ? "NURSE" : "DOCTOR",
                            countryCode: group.countryCode,
                            title: group.doctorName,
                            subtitle: `${group.specialty} · ${group.facilityName}`,
                            facilityId: group.facilityId,
                            facilityName: group.facilityName,
                            href: `/booking?doctorId=${encodeURIComponent(group.doctorUserId)}`,
                          }}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 border-t border-slate-200/80 pt-3">
                        {group.slots.map((slot) => {
                          const slotKey = `${slot.scheduleId}-${slot.slotStartIso}`;
                          const isSelected =
                            `${selectedSlot.scheduleId}-${selectedSlot.slotStartIso}` ===
                            slotKey;
                          const timeRange = `${slot.slotStartIso.slice(11, 16)}–${slot.slotEndIso.slice(11, 16)}`;

                          return (
                            <button
                              key={slotKey}
                              type="button"
                              disabled={!slot.isAvailable}
                              onClick={() =>
                                setSelectedSlotByGroup((prev) => ({
                                  ...prev,
                                  [group.key]: slotKey,
                                }))
                              }
                              aria-pressed={isSelected}
                              className={
                                !slot.isAvailable
                                  ? "inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 font-mono-tabular text-[11px] font-medium text-slate-400 line-through"
                                  : isSelected
                                    ? "inline-flex items-center gap-1 rounded-lg border border-teal-800 bg-teal-800 px-2.5 py-1.5 font-mono-tabular text-[11px] font-semibold text-white shadow-xs"
                                    : "inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono-tabular text-[11px] font-semibold text-slate-800 hover:border-teal-700"
                              }
                            >
                              {slot.visitMode === "TELEHEALTH" ? (
                                <Video className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <Stethoscope
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              )}
                              <span>{timeRange}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3">
                        <p className="text-xs text-slate-600">
                          {selectedSlot.isAvailable ? (
                            <>
                              Selected:{" "}
                              <span className="font-mono-tabular font-semibold text-slate-900">
                                {selectedSlot.slotStartIso.slice(11, 16)}–
                                {selectedSlot.slotEndIso.slice(11, 16)}
                              </span>{" "}
                              · {formatVisitMode(selectedSlot.visitMode)}
                            </>
                          ) : (
                            "All shown windows are currently reserved"
                          )}
                        </p>

                        <UiButton
                          size="sm"
                          disabled={busy || !selectedSlot.isAvailable}
                          onClick={() => void handleBookSlot(selectedSlot)}
                        >
                          Reserve Visit
                        </UiButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-5 lg:col-span-5 lg:sticky lg:top-20 self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Your Appointments
              </h2>
              {session ? (
                <UiButton
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void refreshSlotsAndAppointments()}
                >
                  Refresh
                </UiButton>
              ) : null}
            </div>

            {!session ? (
              <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                <p>
                  Tap any time slot on the left and hit{" "}
                  <strong className="font-semibold text-slate-900">Reserve Visit</strong>{" "}
                  immediately without creating an account, or sign in via the Care Portal to sync history across devices.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/patient"
                    className="inline-flex min-h-[36px] items-center rounded-lg bg-teal-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-900"
                  >
                    Open My Care & Deadlines
                  </Link>
                  <Link
                    href="/portal"
                    className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:border-teal-700"
                  >
                    Care Portal Sign-In
                  </Link>
                </div>
              </div>
            ) : appointments.length === 0 ? (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                No scheduled appointments found in {selectedCountry}. Select a
                time window on the left to book.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {appointments.map((appt) => (
                  <li
                    key={appt.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tabular font-bold text-slate-900">
                        {appt.slotStartIso.slice(0, 16).replace("T", " ")}
                      </span>
                      <UiBadge tone={STATUS_BADGE_TONE[appt.status]}>
                        {appt.status}
                      </UiBadge>
                    </div>
                    <div className="mt-2 flex items-center gap-2.5">
                      <EntityAvatar
                        name={appt.doctorName}
                        role="DOCTOR"
                        size="xs"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">
                          <bdi dir="auto">{appt.doctorName}</bdi> ·{" "}
                          <bdi dir="auto">{appt.facilityName}</bdi>
                        </p>
                        <p className="truncate text-slate-600">
                          {formatVisitMode(appt.visitMode)} ·{" "}
                          <bdi dir="auto">{appt.patientName}</bdi>
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {appt.status === "CONFIRMED" ? (
                        <UiButton
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            void handleTransitionStatus(appt.id, "CANCELLED")
                          }
                        >
                          Cancel Visit
                        </UiButton>
                      ) : null}
                      {canManageStatus && appt.status === "CONFIRMED" ? (
                        <UiButton
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void handleTransitionStatus(appt.id, "CHECKED_IN")
                          }
                        >
                          Check In
                        </UiButton>
                      ) : null}
                      {canManageStatus && appt.status === "CHECKED_IN" ? (
                        <UiButton
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void handleTransitionStatus(appt.id, "COMPLETED")
                          }
                        >
                          Complete Visit
                        </UiButton>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">
              Clinicians & Clinic Coordinators
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Practitioner shift publishing, clinic schedules, and consultation
              fees are managed in the dedicated Clinical Workspace.
            </p>
            <div className="mt-3">
              <Link
                href="/clinical"
                className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:border-teal-700 hover:text-teal-900"
              >
                Open Clinical Schedule Portal
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
