"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AppointmentStatus,
  AppointmentSummary,
  AuthResponse,
  AuthenticatedUser,
  AvailableSlot,
  CountryPack,
  DirectoryDoctorSummary,
  DirectoryFacilitySummary,
  DoctorProfileSummary,
  DoctorScheduleSummary,
  VisitMode,
} from "@medisync/contracts";
import {
  checkBackendOnline,
  fetchDirectoryDoctors,
  fetchDirectoryFacilities,
} from "@/shared/api/directory-client";
import { ensureGuestPatientSession } from "@/shared/auth/guest-session";
import {
  clearStoredSession,
  readStoredSession,
  revokeClientSession,
} from "@/shared/auth/session-storage";
import {
  canCreateAppointment,
  canReadAppointments,
  isConsumerUserOrGuest,
  syncPendingSessionStatus,
} from "@/shared/auth/role-capabilities";
import { ConsumerWorkspaceGuard } from "@/shared/auth/ConsumerWorkspaceGuard";
import {
  formatCountryDisplayName,
  formatVisitMode,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import {
  buildSpecialtyFilterOptions,
  formatSpecialtyLabel,
  getSpecialtyKeywords,
  matchesDoctorSpecialtyFilter,
  resolveCanonicalSpecialtyValue,
} from "@/shared/i18n/specialties";
import { BOOKING_COPY, getLocalizedAppointmentStatusLabel } from "../booking-i18n";
import {
  removeGuestActivityPass,
  useGuestActivityPasses,
} from "@/shared/patient/patient-local-store";
import {
  isPendingStaffVerification,
  VerificationGateNotice,
} from "@/shared/ui/VerificationGateNotice";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
  resolveEffectiveCountryCode,
} from "@/shared/config/deployment";
import {
  expandMoroccanCityKeywords,
  matchesAccentInsensitiveQuery,
  matchesMoroccanCity,
} from "@/shared/config/morocco-standards";
import {
  UiBadge,
  UiButton,
  WorkspaceHeader,
  useToastSetter,
} from "@/shared/ui/primitives";
import { CalendarClock, RefreshCw } from "lucide-react";
import {
  createAppointment,
  fetchAppointments,
  fetchAvailableSlots,
  fetchDoctorProfiles,
  fetchSchedules,
  transitionAppointmentStatus,
} from "../api-client";
import {
  buildRollingClinicDates,
  findNextScheduledIsoDate,
  getInitialBookingIsoDate,
  getUtcDayOfWeek,
  getWeekdayLabel,
  isNurseSpecialty,
  type BookingTab,
  type ProviderCategoryFilter,
} from "./booking-utils";
import { AppointmentsListPanel } from "./AppointmentsListPanel";
import { BookingToolbar } from "./BookingToolbar";
import {
  BookingScheduleModal,
  type SelectedPractitionerInfo,
} from "./BookingScheduleModal";
import {
  PractitionerSlotCard,
  type EnrichedProviderGroup,
} from "./PractitionerSlotCard";

interface BookingWorkspaceProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

/** Industry-grade practitioner & nurse appointment scheduler enriched with insurances, direct slot grid & calendar sync. */
export function BookingWorkspace({
  packs,
  apiBaseUrl,
}: BookingWorkspaceProps) {
  const { locale, t, isRtl } = useLocale();
  const copy = BOOKING_COPY[locale];
  const defaultCode = resolveActivePack(packs)?.code ?? ACTIVE_COUNTRY_CODE;

  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCode);
  const [selectedDate, setSelectedDate] = useState<string>(
    getInitialBookingIsoDate,
  );
  const [providerFilter, setProviderFilter] =
    useState<ProviderCategoryFilter>("ALL");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("ALL");
  const [doctorIdFilter, setDoctorIdFilter] = useState<string>("");
  const [facilityFilterId, setFacilityFilterId] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [insuranceFilter, setInsuranceFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [visitModeFilter, setVisitModeFilter] = useState<VisitMode | "ALL">(
    "ALL",
  );
  const [includeBooked, setIncludeBooked] = useState(true);
  const [activeTab, setActiveTab] = useState<BookingTab>("PRACTITIONERS");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [directoryDoctors, setDirectoryDoctors] = useState<
    DirectoryDoctorSummary[]
  >([]);
  const [directoryFacilities, setDirectoryFacilities] = useState<
    DirectoryFacilitySummary[]
  >([]);
  const [doctorProfiles, setDoctorProfiles] = useState<DoctorProfileSummary[]>(
    [],
  );
  const [schedules, setSchedules] = useState<DoctorScheduleSummary[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [backendChecked, setBackendChecked] = useState(false);
  const [selectedPractitioner, setSelectedPractitioner] =
    useState<SelectedPractitionerInfo | null>(null);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [apiOnline, setApiOnline] = useState(false);

  const [session, setSession] = useState<AuthResponse | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionLockRef = useRef(false);
  const setBanner = useToastSetter();

  const guestPasses = useGuestActivityPasses(selectedCountry).filter(
    (item) => item.kind === "APPOINTMENT",
  );
  const activePack =
    packs.find((pack) => pack.code === selectedCountry) ?? packs[0];
  const currencyCode = activePack?.currencyCode ?? selectedCountry;
  const rollingDates = useMemo(
    () => buildRollingClinicDates(5, locale),
    [locale],
  );
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    function handlePointerDownOutside(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest('[data-ui-select-menu="true"]') ||
        target.closest('[aria-modal="true"]')
      ) {
        return;
      }
      if (!searchContainerRef.current?.contains(target)) {
        setFiltersOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFiltersOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDownOutside,
        true,
      );
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSession(stored);
      setSelectedCountry(resolveEffectiveCountryCode(stored.user.countryCode));
    }
    setSessionHydrated(true);

    if (typeof window !== "undefined") {
      const qs = new URLSearchParams(window.location.search);
      const qCountry = qs.get("country");
      const qFacility = qs.get("facilityId");
      const qDoctor = qs.get("doctorId");
      const qProvider = qs.get("provider");
      const qMode = qs.get("mode");
      const qSpecialty = qs.get("specialty");
      if (qCountry && packs.some((p) => p.code === qCountry.toUpperCase())) {
        setSelectedCountry(qCountry.toUpperCase());
      }
      if (qFacility) setFacilityFilterId(qFacility);
      if (qDoctor) setDoctorIdFilter(qDoctor);
      if (qProvider === "nurse") setProviderFilter("NURSES");
      if (qProvider === "doctor") setProviderFilter("DOCTORS");
      if (
        qMode === "IN_PERSON" ||
        qMode === "TELEHEALTH" ||
        qMode === "HOME_VISIT"
      ) {
        setVisitModeFilter(qMode);
      }
      if (qSpecialty) {
        const canonical = resolveCanonicalSpecialtyValue(qSpecialty);
        if (canonical === "Nursing") {
          setProviderFilter("NURSES");
        } else if (canonical) {
          setProviderFilter("DOCTORS");
          setSpecialtyFilter(canonical);
        } else {
          setSearchQuery(qSpecialty);
        }
      }
    }

    let cancelled = false;
    checkBackendOnline().then((online) => {
      if (cancelled) return;
      setApiOnline(online);
      setBackendChecked(true);
      if (!online) setLoadingSlots(false);
      if (online && stored && isPendingStaffVerification(stored.user)) {
        void syncPendingSessionStatus(apiBaseUrl, stored).then((syncRes) => {
          if (cancelled) return;
          if (syncRes.status === "expired") {
            setSession(null);
            setAppointments([]);
          } else if (syncRes.status === "updated" && syncRes.session) {
            setSession(syncRes.session);
          }
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, packs]);

  const isStaffVisitor = Boolean(
    session?.user && !isConsumerUserOrGuest(session.user),
  );
  const sessionToken = session?.token ?? null;
  const sessionUserRole = session?.user.role ?? null;
  const sessionUserId = session?.user.id ?? null;

  useEffect(() => {
    if (!apiOnline || !sessionHydrated) return;
    if (isStaffVisitor) {
      setDirectoryDoctors([]);
      setDirectoryFacilities([]);
      setSchedules([]);
      setDoctorProfiles([]);
      return;
    }
    let active = true;

    Promise.all([
      fetchDirectoryDoctors(apiBaseUrl, { countryCode: selectedCountry, limit: 150 }),
      fetchDirectoryFacilities(apiBaseUrl, { countryCode: selectedCountry, limit: 150 }),
      fetchSchedules(apiBaseUrl, { countryCode: selectedCountry }),
      fetchDoctorProfiles(apiBaseUrl, selectedCountry),
    ]).then(([docsRes, facsRes, schedRes, profRes]) => {
      if (!active) return;
      if (docsRes.ok) setDirectoryDoctors(docsRes.doctors);
      if (facsRes.ok) setDirectoryFacilities(facsRes.facilities);
      if (schedRes.ok) setSchedules(schedRes.data.schedules);
      if (profRes.ok) setDoctorProfiles(profRes.data.profiles);
    });

    return () => {
      active = false;
    };
  }, [apiOnline, sessionHydrated, apiBaseUrl, selectedCountry, isStaffVisitor]);

  useEffect(() => {
    if (!apiOnline || !sessionHydrated) return;
    if (isStaffVisitor) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }
    let active = true;
    setLoadingSlots(true);

    fetchAvailableSlots(apiBaseUrl, {
      date: selectedDate,
      countryCode: selectedCountry,
      ...(facilityFilterId ? { facilityId: facilityFilterId } : {}),
      ...(visitModeFilter !== "ALL" ? { visitMode: visitModeFilter } : {}),
      includeBooked,
    })
      .then((slotsRes) => {
        if (!active) return;
        if (slotsRes.ok) setSlots(slotsRes.data.slots);
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [
    apiOnline,
    sessionHydrated,
    apiBaseUrl,
    selectedCountry,
    selectedDate,
    facilityFilterId,
    visitModeFilter,
    includeBooked,
    isStaffVisitor,
  ]);

  useEffect(() => {
    if (!apiOnline || !sessionHydrated) return;
    if (isStaffVisitor || !sessionToken || !session?.user || !canReadAppointments(session.user)) {
      setAppointments([]);
      return;
    }
    let active = true;

    fetchAppointments(apiBaseUrl, sessionToken, selectedCountry).then((res) => {
      if (!active) return;
      if (res.ok) {
        setAppointments(res.data.appointments);
      } else if (res.status === 401) {
        clearStoredSession();
        setSession(null);
        setAppointments([]);
        setBanner({
          tone: "error",
          text: BOOKING_COPY[localeRef.current].sessionExpiredToast,
        });
      }
    });

    return () => {
      active = false;
    };
  }, [
    apiOnline,
    sessionHydrated,
    apiBaseUrl,
    selectedCountry,
    isStaffVisitor,
    sessionToken,
    sessionUserRole,
    sessionUserId,
    session,
    setBanner,
  ]);

  const doctorById = useMemo(() => {
    const map = new Map<string, DirectoryDoctorSummary>();
    for (const d of directoryDoctors) map.set(d.id, d);
    return map;
  }, [directoryDoctors]);

  const facilityById = useMemo(() => {
    const map = new Map<string, DirectoryFacilitySummary>();
    for (const f of directoryFacilities) map.set(f.id, f);
    return map;
  }, [directoryFacilities]);

  const profileByDoctorId = useMemo(() => {
    const map = new Map<string, DoctorProfileSummary>();
    for (const p of doctorProfiles) map.set(p.doctorUserId, p);
    return map;
  }, [doctorProfiles]);

  const availableInsurances = useMemo(() => {
    const set = new Set<string>();
    for (const d of directoryDoctors) {
      for (const ins of d.acceptedInsurances) set.add(ins);
    }
    return Array.from(set);
  }, [directoryDoctors]);

  const specialtyOptions = useMemo(
    () =>
      buildSpecialtyFilterOptions(
        [
          ...directoryDoctors.map((d) => d.specialty),
          ...slots.map((s) => s.specialty),
        ],
        locale,
        { includeNurse: false },
      ),
    [directoryDoctors, locale, slots],
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const groupedProviders = useMemo<EnrichedProviderGroup[]>(() => {
    const map = new Map<string, EnrichedProviderGroup>();

    for (const slot of slots) {
      if (doctorIdFilter && slot.doctorUserId !== doctorIdFilter) continue;
      const nurseTrack = isNurseSpecialty(slot.specialty);
      if (providerFilter === "NURSES" && !nurseTrack) continue;
      if (providerFilter === "DOCTORS" && nurseTrack) continue;
      if (
        specialtyFilter !== "ALL" &&
        !matchesDoctorSpecialtyFilter(slot.specialty, specialtyFilter)
      ) {
        continue;
      }

      const docMeta = doctorById.get(slot.doctorUserId);
      const facMeta = facilityById.get(slot.facilityId);
      const profileMeta = profileByDoctorId.get(slot.doctorUserId);
      const insurances =
        docMeta?.acceptedInsurances ?? facMeta?.acceptedInsurances ?? [];

      if (insuranceFilter && !insurances.includes(insuranceFilter)) {
        continue;
      }

      if (
        cityFilter &&
        !matchesMoroccanCity(
          cityFilter,
          docMeta?.facilityCity ?? facMeta?.city,
          [slot.facilityName, facMeta?.address],
        )
      ) {
        continue;
      }

      if (normalizedSearch) {
        const specLocalized = formatSpecialtyLabel(slot.specialty, locale);
        if (
          !matchesAccentInsensitiveQuery(normalizedSearch, [
            slot.doctorName,
            slot.specialty,
            specLocalized,
            getSpecialtyKeywords(slot.specialty),
            slot.facilityName,
            docMeta?.facilityCity,
            facMeta?.city,
            expandMoroccanCityKeywords(docMeta?.facilityCity ?? facMeta?.city),
            facMeta?.address,
          ])
        ) {
          continue;
        }
      }

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
          facilityAddress: facMeta?.address ?? null,
          avatarUrl: docMeta?.avatarUrl ?? profileMeta?.avatarUrl ?? null,
          licenseNumber: profileMeta?.licenseNumber ?? null,
          bio: profileMeta?.bio ?? null,
          acceptedInsurances: insurances,
          languagesSpoken:
            docMeta?.languagesSpoken ?? facMeta?.languagesSpoken ?? [],
          credentialVerified: Boolean(docMeta?.credentialVerified),
          telehealthEnabled:
            docMeta?.telehealthEnabled ??
            facMeta?.telehealthEnabled ??
            !nurseTrack,
          consultationFeeMinor: slot.consultationFeeMinor,
          countryCode: slot.countryCode,
          slots: [slot],
        });
      }
    }

    return Array.from(map.values());
  }, [
    slots,
    doctorIdFilter,
    providerFilter,
    specialtyFilter,
    cityFilter,
    insuranceFilter,
    normalizedSearch,
    locale,
    doctorById,
    facilityById,
    profileByDoctorId,
  ]);

  async function refreshSlotsAndAppointments(
    tokenOverride?: string | null,
    userOverride?: AuthenticatedUser | null,
  ) {
    const activeToken = tokenOverride ?? session?.token ?? null;
    const activeUser = userOverride ?? session?.user ?? null;
    const allowAppointments =
      Boolean(activeToken) && canReadAppointments(activeUser);
    const [slotsRes, apptsRes] = await Promise.all([
      fetchAvailableSlots(apiBaseUrl, {
        date: selectedDate,
        countryCode: selectedCountry,
        ...(facilityFilterId ? { facilityId: facilityFilterId } : {}),
        ...(visitModeFilter !== "ALL" ? { visitMode: visitModeFilter } : {}),
        includeBooked,
      }),
      allowAppointments && activeToken
        ? fetchAppointments(apiBaseUrl, activeToken, selectedCountry)
        : Promise.resolve(null),
    ]);

    if (slotsRes.ok) {
      setSlots(slotsRes.data.slots);
    }
    if (apptsRes) {
      if (apptsRes.ok) {
        setAppointments(apptsRes.data.appointments);
      } else if (apptsRes.status === 401) {
        clearStoredSession();
        setSession(null);
        setAppointments([]);
      }
    } else {
      setAppointments([]);
    }
    return slotsRes;
  }

  async function handleConfirmReservation(
    slot: AvailableSlot,
    reason: string,
    guestContact?: { fullName: string; phone: string },
  ): Promise<string | null> {
    if (actionLockRef.current) return null;
    if (session?.user && !canCreateAppointment(session.user)) {
      setSelectedPractitioner(null);
      const errMsg = isPendingStaffVerification(session.user)
        ? copy.pendingApprovalError
        : copy.roleRestrictionError;
      setBanner({
        tone: "error",
        text: errMsg,
      });
      return errMsg;
    }

    actionLockRef.current = true;
    try {
      let activeToken = session?.token ?? null;
      let bookedByUser = session?.user ?? null;
      if (!activeToken) {
        if (!apiOnline) {
          const offlineMsg = copy.bookingOfflineError;
          setBanner({ tone: "error", text: offlineMsg });
          return offlineMsg;
        }
        setBusy(true);
        const guestResult = await ensureGuestPatientSession(
          apiBaseUrl,
          selectedCountry,
          guestContact,
        );
        if (!guestResult.ok) {
          setBanner({ tone: "error", text: guestResult.message });
          return guestResult.message;
        }
        setSession(guestResult.session);
        activeToken = guestResult.session.token;
        bookedByUser = guestResult.session.user;
      }

      setBusy(true);
      const trimmedReason = reason.trim();
      const res = await createAppointment(apiBaseUrl, activeToken, {
        scheduleId: slot.scheduleId,
        slotStartIso: slot.slotStartIso,
        visitMode: slot.visitMode,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      });

      if (!res.ok) {
        if (res.status === 401) {
          clearStoredSession();
          setSession(null);
          setAppointments([]);
        }
        const errorText =
          res.status === 409
            ? copy.conflictError
            : res.status === 401
              ? copy.bookingExpiredError
              : `${copy.bookingFailedPrefix} ${res.error}`;
        setBanner({ tone: "error", text: errorText });
        await refreshSlotsAndAppointments(
          res.status === 401 ? null : activeToken,
          res.status === 401 ? null : bookedByUser,
        );
        return errorText;
      }

      setSelectedPractitioner(null);
      setActiveTab("APPOINTMENTS");
      setBanner({
        tone: "success",
        text: `${copy.confirmedPrefix} ${formatVisitMode(res.data.appointment.visitMode, locale)} ${copy.confirmedWith} ${res.data.appointment.doctorName} ${copy.confirmedAt} ${res.data.appointment.facilityName}.`,
      });
      await refreshSlotsAndAppointments(activeToken, bookedByUser);
      return null;
    } finally {
      setBusy(false);
      actionLockRef.current = false;
    }
  }

  async function handleTransitionStatus(
    appointmentId: string,
    status: AppointmentStatus,
  ) {
    if (!session?.token || actionLockRef.current) return;
    actionLockRef.current = true;
    setBusy(true);
    try {
      const res = await transitionAppointmentStatus(
        apiBaseUrl,
        session.token,
        appointmentId,
        { status },
      );

      if (!res.ok) {
        setBanner({
          tone: "error",
          text: `${copy.statusUpdateFailedPrefix} ${res.error}`,
        });
        if (res.status === 409) {
          await refreshSlotsAndAppointments();
        }
        return;
      }

      setBanner({
        tone: "success",
        text: `${copy.statusUpdatedPrefix} ${getLocalizedAppointmentStatusLabel(res.data.appointment.status, locale)}.`,
      });
      await refreshSlotsAndAppointments();
    } finally {
      setBusy(false);
      actionLockRef.current = false;
    }
  }

  const currentUser = session?.user ?? null;
  const canManageStatus =
    currentUser !== null &&
    !isPendingStaffVerification(currentUser) &&
    ["DOCTOR", "NURSE", "CLINIC_STAFF", "HOSPITAL_ADMIN", "OPS_ADMIN"].includes(
      currentUser.role,
    );

  const defaultCountryForUser = resolveEffectiveCountryCode(
    currentUser?.countryCode ?? defaultCode,
  );
  const hasPopoverFilter =
    Boolean(insuranceFilter) ||
    !includeBooked ||
    selectedCountry !== defaultCountryForUser ||
    Boolean(doctorIdFilter) ||
    Boolean(facilityFilterId);
  const hasActiveFilter = Boolean(
    searchQuery.trim() ||
      cityFilter ||
      hasPopoverFilter ||
      visitModeFilter !== "ALL" ||
      providerFilter !== "ALL" ||
      specialtyFilter !== "ALL",
  );
  const totalSavedVisits = appointments.length + guestPasses.length;
  const selectedWeekdayLabel = getWeekdayLabel(
    getUtcDayOfWeek(selectedDate),
    locale,
  );

  function resetAllFilters() {
    setSearchQuery("");
    setVisitModeFilter("ALL");
    setProviderFilter("ALL");
    setSpecialtyFilter("ALL");
    setCityFilter("");
    setInsuranceFilter("");
    setIncludeBooked(true);
    setDoctorIdFilter("");
    setFacilityFilterId("");
    setSelectedCountry(defaultCountryForUser);
    setSelectedDate(getInitialBookingIsoDate());
  }

  const nextDaySuggestionForModal = selectedPractitioner
    ? findNextScheduledIsoDate(
        selectedPractitioner.doctorUserId,
        selectedPractitioner.facilityId,
        schedules,
        selectedDate,
        locale,
      )
    : null;

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="space-y-4">
      <WorkspaceHeader
        title={t("booking.heading")}
        countryCode={selectedCountry}
        countryName={formatCountryDisplayName(
          selectedCountry,
          activePack?.name ?? selectedCountry,
          locale,
        )}
        currencyCode={currencyCode}
        emergencyHotline={activePack?.emergencyHotlines.ambulance ?? ""}
        user={currentUser}
        guestLabel={copy.guestLabel}
        onSignOut={() => {
          revokeClientSession(apiBaseUrl);
          setSession(null);
          setAppointments([]);
        }}
        actions={
          currentUser && !isConsumerUserOrGuest(currentUser) ? null : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void refreshSlotsAndAppointments()}
              aria-label={copy.refreshAria}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-teal-700 hover:text-teal-900 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{copy.refreshLabel}</span>
            </button>
          )
        }
      />

      <ConsumerWorkspaceGuard
        user={currentUser}
        hydrated={sessionHydrated}
        surfaceTitle={copy.surfaceTitle}
        onSignOut={() => {
          revokeClientSession(apiBaseUrl);
          setSession(null);
          setAppointments([]);
        }}
      >
        <VerificationGateNotice user={currentUser} />

        {backendChecked && !apiOnline ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <span>{copy.apiOfflineText}</span>
            <button
              type="button"
              onClick={() => {
                setBackendChecked(false);
                setLoadingSlots(true);
                void checkBackendOnline().then((online) => {
                  setApiOnline(online);
                  setBackendChecked(true);
                  if (!online) setLoadingSlots(false);
                });
              }}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100"
            >
              {copy.retryConnection}
            </button>
          </div>
        ) : null}

        <BookingToolbar
          packs={packs}
          selectedCountry={selectedCountry}
          selectedDate={selectedDate}
          searchQuery={searchQuery}
          providerFilter={providerFilter}
          specialtyFilter={specialtyFilter}
          specialtyOptions={specialtyOptions}
          visitModeFilter={visitModeFilter}
          cityFilter={cityFilter}
          insuranceFilter={insuranceFilter}
          availableInsurances={availableInsurances}
          includeBooked={includeBooked}
          activeTab={activeTab}
          providerCount={groupedProviders.length}
          totalSavedVisits={totalSavedVisits}
          rollingDates={rollingDates}
          filtersOpen={filtersOpen}
          hasPopoverFilter={hasPopoverFilter}
          hasActiveFilter={hasActiveFilter}
          searchContainerRef={searchContainerRef}
          onSearchChange={setSearchQuery}
          onToggleFilters={() => setFiltersOpen((prev) => !prev)}
          onCloseFilters={() => setFiltersOpen(false)}
          onCountryChange={(country) => {
            setSelectedCountry(country);
            setDoctorIdFilter("");
            setFacilityFilterId("");
          }}
          onVisitModeChange={setVisitModeFilter}
          onProviderFilterChange={setProviderFilter}
          onSpecialtyFilterChange={setSpecialtyFilter}
          onCityFilterChange={setCityFilter}
          onInsuranceFilterChange={setInsuranceFilter}
          onIncludeBookedChange={setIncludeBooked}
          onSelectDate={setSelectedDate}
          onSelectTab={setActiveTab}
          onResetAllFilters={resetAllFilters}
        />

        {activeTab === "APPOINTMENTS" ? (
          <AppointmentsListPanel
            appointments={appointments}
            guestPasses={guestPasses}
            countryCode={selectedCountry}
            hasSession={Boolean(session)}
            canManageStatus={canManageStatus}
            busy={busy}
            onTransitionStatus={(id, status) =>
              void handleTransitionStatus(id, status)
            }
            onRemoveGuestPass={(id) => removeGuestActivityPass(id)}
            onBrowseSlots={() => setActiveTab("PRACTITIONERS")}
          />
        ) : (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-sm font-bold text-slate-900 sm:text-base">
                  {copy.availableHeading}
                </h2>
                <span className="font-mono-tabular text-xs text-slate-500">
                  {selectedWeekdayLabel} · {selectedDate} · {currencyCode}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {doctorIdFilter || specialtyFilter !== "ALL" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDoctorIdFilter("");
                      setSpecialtyFilter("ALL");
                    }}
                    className="rounded-lg border border-[#CBDDF0] bg-[#F3F8FD] px-3 py-1 text-xs font-semibold text-[#0066CC] hover:bg-emerald-50"
                  >
                    {copy.filteredShowAll}
                  </button>
                ) : null}
                <UiBadge tone="emerald">
                  {groupedProviders.length}{" "}
                  {groupedProviders.length === 1
                    ? copy.providerSingular
                    : copy.providerPlural}
                </UiBadge>
              </div>
            </div>

            {loadingSlots && groupedProviders.length === 0 ? (
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="h-44 animate-pulse rounded-xl border border-[#D7E4F2] bg-white"
                  />
                ))}
              </div>
            ) : groupedProviders.length === 0 ? (
              <div className="rounded-2xl border border-[#D7E4F2] bg-white p-8 text-center">
                <CalendarClock
                  className="mx-auto h-7 w-7 text-slate-400"
                  aria-hidden="true"
                />
                <p className="mt-2.5 text-sm font-semibold text-slate-800">
                  {copy.noSlotsMatchedPrefix} {selectedWeekdayLabel}.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {copy.noSlotsMatchedHint}
                </p>
                {hasActiveFilter ? (
                  <div className="mt-3.5">
                    <UiButton
                      size="sm"
                      variant="secondary"
                      onClick={resetAllFilters}
                    >
                      {copy.clearFilters}
                    </UiButton>
                  </div>
                ) : null}
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                {groupedProviders.map((group) => (
                  <PractitionerSlotCard
                    key={group.key}
                    group={group}
                    currencyCode={currencyCode}
                    selectedWeekdayLabel={selectedWeekdayLabel}
                    onOpenSchedule={(initialSlotKey, preferredMode) =>
                      setSelectedPractitioner({
                        key: group.key,
                        doctorUserId: group.doctorUserId,
                        doctorName: group.doctorName,
                        specialty: group.specialty,
                        facilityId: group.facilityId,
                        facilityName: group.facilityName,
                        facilityAddress: group.facilityAddress,
                        acceptedInsurances: group.acceptedInsurances,
                        languagesSpoken: group.languagesSpoken,
                        credentialVerified: group.credentialVerified,
                        telehealthEnabled: group.telehealthEnabled,
                        consultationFeeMinor: group.consultationFeeMinor,
                        countryCode: group.countryCode,
                        avatarUrl: group.avatarUrl,
                        licenseNumber: group.licenseNumber,
                        bio: group.bio,
                        initialSlotKey,
                        preferredVisitMode:
                          preferredMode ??
                          (visitModeFilter !== "ALL"
                            ? visitModeFilter
                            : undefined),
                      })
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        )}

        {selectedPractitioner ? (
          <BookingScheduleModal
            practitioner={selectedPractitioner}
            slots={slots.filter(
              (s) =>
                s.doctorUserId === selectedPractitioner.doctorUserId &&
                s.facilityId === selectedPractitioner.facilityId,
            )}
            currencyCode={currencyCode}
            selectedDate={selectedDate}
            weekdayLabel={selectedWeekdayLabel}
            rollingDates={rollingDates}
            nextAvailableSuggestion={nextDaySuggestionForModal}
            signedInUserName={currentUser?.fullName ?? null}
            busy={busy}
            onSelectDate={setSelectedDate}
            onConfirm={(slot, reason, guestContact) =>
              handleConfirmReservation(slot, reason, guestContact)
            }
            onClose={() => {
              if (!busy) setSelectedPractitioner(null);
            }}
          />
        ) : null}
      </ConsumerWorkspaceGuard>
    </div>
  );
}
