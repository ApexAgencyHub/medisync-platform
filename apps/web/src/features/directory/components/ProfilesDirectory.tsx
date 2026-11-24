"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AuthResponse,
  CountryPack,
  DirectoryDoctorSummary,
  DirectoryDriverSummary,
  DirectoryFacilitySummary,
} from "@medisync/contracts";
import {
  Ambulance,
  Building2,
  Home,
  MapPin,
  Search,
  SlidersHorizontal,
  Stethoscope,
  X,
} from "lucide-react";
import {
  checkBackendOnline,
  fetchDirectoryDoctors,
  fetchDirectoryDrivers,
  fetchDirectoryFacilities,
} from "@/shared/api/directory-client";
import {
  readStoredSession,
  revokeClientSession,
} from "@/shared/auth/session-storage";
import { isConsumerUserOrGuest } from "@/shared/auth/role-capabilities";
import { ConsumerWorkspaceGuard } from "@/shared/auth/ConsumerWorkspaceGuard";
import {
  ProfileDossierModal,
  type ProfileDossierTarget,
} from "./ProfileDossierModal";
import {
  formatCountryDisplayName,
  formatDriverStatus,
  formatFacilityKind,
  formatOpenStatus,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import {
  buildSpecialtyFilterOptions,
  formatSpecialtyLabel,
  getSpecialtyKeywords,
  matchesDoctorSpecialtyFilter,
  resolveCanonicalSpecialtyValue,
} from "@/shared/i18n/specialties";
import { DIRECTORY_COPY } from "../directory-i18n";
import {
  resolveDefaultAvatar,
  resolveFacilityPicture,
  resolveVehiclePicture,
} from "@/shared/ui/EntityAvatar";
import { BookmarkButton } from "@/shared/ui/BookmarkButton";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
  resolveEffectiveCountryCode,
} from "@/shared/config/deployment";
import {
  expandMoroccanCityKeywords,
  isNursingSpecialty,
  matchesAccentInsensitiveQuery,
  matchesMoroccanCity,
} from "@/shared/config/morocco-standards";
import { MoroccanPlacePicker } from "@/shared/ui/MoroccanPlacePicker";
import {
  UiBadge,
  UiSelect,
  UiSwitch,
  WorkspaceHeader,
  useToast,
} from "@/shared/ui/primitives";
import { MoroccanComplianceBadge } from "@/shared/ui/TactileControls";

type DirectoryCategory =
  | "ALL"
  | "DOCTORS"
  | "NURSES"
  | "DRIVERS"
  | "FACILITIES";

function formatMoney(minor: number, currencyCode: string): string {
  const major = (minor / 100).toFixed(0);
  return `${major} ${currencyCode}`;
}

export function ProfilesDirectory({
  packs,
  apiBaseUrl,
}: {
  packs: CountryPack[];
  apiBaseUrl: string;
}) {
  const { locale, t, isRtl } = useLocale();
  const copy = DIRECTORY_COPY[locale];
  const { openImage } = useImageLightbox();
  const { showToast } = useToast();

  const defaultPack = resolveActivePack(packs);
  const [countryCode, setCountryCode] = useState(
    defaultPack?.code ?? ACTIVE_COUNTRY_CODE,
  );
  const [session, setSession] = useState<AuthResponse | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [category, setCategory] = useState<DirectoryCategory>("ALL");
  const [facilityKindFilter, setFacilityKindFilter] = useState<string>("ALL");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const [doctorsAndNurses, setDoctorsAndNurses] = useState<
    DirectoryDoctorSummary[]
  >([]);
  const [drivers, setDrivers] = useState<DirectoryDriverSummary[]>([]);
  const [facilities, setFacilities] = useState<DirectoryFacilitySummary[]>([]);
  const [dossierTarget, setDossierTarget] = useState<ProfileDossierTarget | null>(
    null,
  );
  const deepLinkAppliedRef = useRef(false);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const activePack = useMemo(
    () => packs.find((p) => p.code === countryCode) ?? defaultPack ?? packs[0],
    [packs, countryCode, defaultPack],
  );

  useEffect(() => {
    const stored = readStoredSession();
    if (stored) {
      setSession(stored);
      setCountryCode(resolveEffectiveCountryCode(stored.user.countryCode));
    }
    if (typeof window !== "undefined") {
      const qs = new URLSearchParams(window.location.search);
      if (!stored) {
        const qCountry = qs.get("country")?.trim().toUpperCase();
        if (qCountry && packs.some((p) => p.code === qCountry)) {
          setCountryCode(qCountry);
        }
      }
      const qCat = qs.get("category")?.trim().toUpperCase();
      if (
        qCat === "DOCTORS" ||
        qCat === "NURSES" ||
        qCat === "DRIVERS" ||
        qCat === "FACILITIES"
      ) {
        setCategory(qCat);
      } else if (
        qCat === "HOSPITAL" ||
        qCat === "CLINIC" ||
        qCat === "PHARMACY" ||
        qCat === "DIAGNOSTIC_LAB"
      ) {
        setCategory("FACILITIES");
        setFacilityKindFilter(qCat);
      }
      const qSpecialty = qs.get("specialty")?.trim();
      if (qSpecialty) {
        const canonical = resolveCanonicalSpecialtyValue(qSpecialty);
        if (canonical === "Nursing") {
          setCategory("NURSES");
        } else if (canonical) {
          setCategory("DOCTORS");
          setSpecialtyFilter(canonical);
        } else {
          setSearchQuery(qSpecialty);
        }
      }
    }
    setSessionHydrated(true);

    let cancelled = false;
    checkBackendOnline().then((online) => {
      if (!cancelled) {
        setApiOnline(online);
        if (!online) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [packs]);

  useEffect(() => {
    function handleOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
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

    document.addEventListener("pointerdown", handleOutsidePointer, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (apiOnline !== true || !sessionHydrated) return;
    const visitor = session?.user ?? null;
    if (visitor && !isConsumerUserOrGuest(visitor)) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    Promise.all([
      fetchDirectoryDoctors(apiBaseUrl, { countryCode, limit: 150 }),
      fetchDirectoryDrivers(apiBaseUrl, { countryCode, limit: 150 }),
      fetchDirectoryFacilities(apiBaseUrl, { countryCode, limit: 150 }),
    ])
      .then(([docRes, drvRes, facRes]) => {
        if (!active) return;
        if (!docRes.ok || !drvRes.ok || !facRes.ok) {
          showToast({
            tone: "warning",
            message: copy.syncErrorToast,
          });
        }
        if (docRes.ok) setDoctorsAndNurses(docRes.doctors);
        if (drvRes.ok) setDrivers(drvRes.drivers);
        if (facRes.ok) setFacilities(facRes.facilities);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [apiOnline, apiBaseUrl, countryCode, session, sessionHydrated, showToast]);

  function isNurseItem(item: DirectoryDoctorSummary): boolean {
    return item.role === "NURSE" || isNursingSpecialty(item.specialty);
  }

  function openPractitionerDossier(item: DirectoryDoctorSummary) {
    const fac =
      facilities.find((f) => f.id === item.facilityId) ?? null;
    if (isNurseItem(item)) {
      setDossierTarget({ kind: "NURSE", nurse: item, facility: fac });
    } else {
      setDossierTarget({ kind: "DOCTOR", doctor: item, facility: fac });
    }
  }

  function openDriverDossier(drv: DirectoryDriverSummary) {
    setDossierTarget({ kind: "DRIVER", driver: drv });
  }

  function openFacilityDossier(fac: DirectoryFacilitySummary) {
    setDossierTarget({
      kind: "FACILITY",
      facility: fac,
      teamDoctors: doctorsAndNurses.filter(
        (d) => d.facilityId === fac.id && !isNurseItem(d),
      ),
      teamNurses: doctorsAndNurses.filter(
        (d) => d.facilityId === fac.id && isNurseItem(d),
      ),
      fleetDrivers: drivers.filter((drv) => drv.facilityId === fac.id),
    });
  }

  useEffect(() => {
    if (loading || deepLinkAppliedRef.current || typeof window === "undefined") {
      return;
    }
    const qs = new URLSearchParams(window.location.search);
    const qDoc = qs.get("doctorId");
    const qFac = qs.get("facilityId");
    const qDrv = qs.get("driverId");
    if (!qDoc && !qFac && !qDrv) {
      deepLinkAppliedRef.current = true;
      return;
    }
    if (qDoc) {
      const found = doctorsAndNurses.find((d) => d.id === qDoc);
      if (found) {
        deepLinkAppliedRef.current = true;
        openPractitionerDossier(found);
        return;
      }
    }
    if (qDrv) {
      const found = drivers.find((d) => d.id === qDrv);
      if (found) {
        deepLinkAppliedRef.current = true;
        openDriverDossier(found);
        return;
      }
    }
    if (qFac) {
      const found = facilities.find((f) => f.id === qFac);
      if (found) {
        deepLinkAppliedRef.current = true;
        openFacilityDossier(found);
      }
    }
    // Runs once when directory data finishes loading
  }, [loading, doctorsAndNurses, drivers, facilities]);

  const specialtyOptions = useMemo(
    () =>
      buildSpecialtyFilterOptions(
        doctorsAndNurses.map((d) => d.specialty),
        locale,
        { includeNurse: false },
      ),
    [doctorsAndNurses, locale],
  );

  const q = searchQuery.trim().toLowerCase();
  const cityQ = cityFilter.trim();

  const facilityById = useMemo(
    () => new Map(facilities.map((f) => [f.id, f])),
    [facilities],
  );

  const doctors = useMemo(
    () =>
      doctorsAndNurses.filter((d) => {
        if (isNurseItem(d)) return false;
        if (
          specialtyFilter !== "ALL" &&
          !matchesDoctorSpecialtyFilter(d.specialty, specialtyFilter)
        ) {
          return false;
        }
        const linkedFacility = d.facilityId
          ? facilityById.get(d.facilityId)
          : undefined;
        if (
          cityQ &&
          !matchesMoroccanCity(cityQ, d.facilityCity ?? linkedFacility?.city, [
            d.facilityName,
            linkedFacility?.name,
            linkedFacility?.address,
          ])
        ) {
          return false;
        }
        if (!q) return true;
        const specHaystack = `${d.specialty} ${formatSpecialtyLabel(d.specialty, locale)} ${getSpecialtyKeywords(d.specialty)}`;
        return matchesAccentInsensitiveQuery(q, [
          d.fullName,
          specHaystack,
          d.facilityName,
          d.facilityCity,
          expandMoroccanCityKeywords(d.facilityCity ?? linkedFacility?.city),
          linkedFacility?.address,
        ]);
      }),
    [doctorsAndNurses, q, cityQ, facilityById, locale, specialtyFilter],
  );

  const nurses = useMemo(
    () =>
      doctorsAndNurses.filter((d) => {
        if (!isNurseItem(d)) return false;
        const linkedFacility = d.facilityId
          ? facilityById.get(d.facilityId)
          : undefined;
        if (
          cityQ &&
          !matchesMoroccanCity(cityQ, d.facilityCity ?? linkedFacility?.city, [
            d.facilityName,
            linkedFacility?.name,
            linkedFacility?.address,
          ])
        ) {
          return false;
        }
        if (!q) return true;
        const specHaystack = `${d.specialty} ${formatSpecialtyLabel(d.specialty, locale)} ${getSpecialtyKeywords(d.specialty)}`;
        return matchesAccentInsensitiveQuery(q, [
          d.fullName,
          specHaystack,
          d.facilityName,
          d.facilityCity,
          expandMoroccanCityKeywords(d.facilityCity ?? linkedFacility?.city),
          linkedFacility?.address,
        ]);
      }),
    [doctorsAndNurses, q, cityQ, facilityById, locale],
  );

  const filteredDrivers = useMemo(
    () =>
      drivers.filter((drv) => {
        if (openOnly && drv.liveStatus !== "AVAILABLE") return false;
        const linkedFacility = drv.facilityId
          ? facilityById.get(drv.facilityId)
          : undefined;
        if (
          cityQ &&
          !matchesMoroccanCity(cityQ, drv.facilityCity ?? linkedFacility?.city, [
            drv.serviceZone,
            drv.facilityName,
            linkedFacility?.address,
          ])
        ) {
          return false;
        }
        if (!q) return true;
        return matchesAccentInsensitiveQuery(q, [
          drv.fullName,
          drv.vehicleLabel,
          drv.serviceZone,
          drv.facilityName,
          drv.facilityCity,
          expandMoroccanCityKeywords(drv.facilityCity ?? linkedFacility?.city),
        ]);
      }),
    [drivers, q, cityQ, openOnly, facilityById],
  );

  const filteredFacilities = useMemo(
    () =>
      facilities.filter((fac) => {
        if (facilityKindFilter !== "ALL" && fac.kind !== facilityKindFilter) {
          return false;
        }
        if (openOnly && fac.openStatus !== "OPEN") return false;
        if (
          cityQ &&
          !matchesMoroccanCity(cityQ, fac.city, [fac.address, fac.name])
        ) {
          return false;
        }
        if (!q) return true;
        return matchesAccentInsensitiveQuery(q, [
          fac.name,
          fac.kind,
          formatFacilityKind(fac.kind, locale),
          fac.address,
          fac.city,
          expandMoroccanCityKeywords(fac.city),
        ]);
      }),
    [facilities, facilityKindFilter, q, cityQ, openOnly, locale],
  );

  const currencyCode = activePack?.currencyCode ?? "MAD";
  const hasPopoverFilter =
    openOnly ||
    facilityKindFilter !== "ALL" ||
    countryCode !== (defaultPack?.code ?? ACTIVE_COUNTRY_CODE);
  const hasAnyFilter =
    hasPopoverFilter || Boolean(cityFilter) || specialtyFilter !== "ALL";

  const showDoctors = category === "ALL" || category === "DOCTORS";
  const showNurses = category === "ALL" || category === "NURSES";
  const showDrivers = category === "ALL" || category === "DRIVERS";
  const showFacilities = category === "ALL" || category === "FACILITIES";
  const countryDisplayName = formatCountryDisplayName(
    countryCode,
    activePack?.name ?? countryCode,
    locale,
  );

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-w-0 w-full space-y-4">
      <WorkspaceHeader
        title={t("profiles.heading")}
        countryCode={countryCode}
        countryName={countryDisplayName}
        currencyCode={currencyCode}
        emergencyHotline={activePack?.emergencyHotlines.ambulance ?? ""}
        user={session?.user ?? null}
        guestLabel={copy.guestLabel}
        onSignOut={() => {
          revokeClientSession(apiBaseUrl);
          setSession(null);
        }}
      />

      <ConsumerWorkspaceGuard
        user={session?.user ?? null}
        hydrated={sessionHydrated}
        surfaceTitle={copy.surfaceTitle}
        onSignOut={() => setSession(null)}
      >
      {/* Two-Row Balanced Toolbar: Row 1 = Search + MoroccanPlacePicker + Specialty; Row 2 = Equal-Fit 5 Category Tabs */}
      <section className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div
            ref={searchContainerRef}
            className="relative flex min-w-0 flex-1 basis-full items-center sm:basis-0 sm:min-w-[220px]"
          >
            <div className="flex h-10 w-full min-w-0 items-center gap-1 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] ps-3.5 pe-1.5">
              <Search
                className="h-4 w-4 shrink-0 text-[#0066CC]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchAria}
                className="min-w-0 flex-1 bg-transparent px-1 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery ? (
                <button
                  type="button"
                  aria-label={copy.clearSearchAria}
                  onClick={() => setSearchQuery("")}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
              <span className="h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />
              <button
                type="button"
                aria-expanded={filtersOpen}
                aria-label={copy.toggleFiltersAria}
                onClick={() => setFiltersOpen((prev) => !prev)}
                className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors ${
                  filtersOpen || hasPopoverFilter
                    ? "bg-[#0066CC] text-white"
                    : "text-slate-700 hover:bg-[#E1EBF2]"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{copy.filtersLabel}</span>
              </button>
            </div>

            {filtersOpen ? (
              <div
                role="dialog"
                aria-label={copy.filtersDialogAria}
                className={`absolute top-full z-40 mt-2 w-[min(320px,calc(100vw-1.5rem))] space-y-3 rounded-2xl border border-slate-200 bg-white/98 p-3.5 shadow-2xl backdrop-blur-xl ${
                  isRtl ? "right-0" : "left-0"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {copy.filtersTitle}
                  </span>
                  <button
                    type="button"
                    aria-label={copy.closeFiltersAria}
                    onClick={() => setFiltersOpen(false)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <MoroccanComplianceBadge domain="patient" locale={locale} />

                <UiSwitch
                  checked={openOnly}
                  onChange={setOpenOnly}
                  label={copy.openNowOnlyLabel}
                />

                {hasAnyFilter ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCityFilter("");
                      setOpenOnly(false);
                      setSpecialtyFilter("ALL");
                      setFacilityKindFilter("ALL");
                      setCountryCode(defaultPack?.code ?? ACTIVE_COUNTRY_CODE);
                    }}
                    className="w-full rounded-xl border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {copy.resetFilters}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <MoroccanPlacePicker
            value={cityFilter}
            allowAll
            includePlaces
            align="start"
            variant="toolbar"
            ariaLabel={copy.cityLabel}
            onSelect={(match) => setCityFilter(match?.cityName ?? "")}
            className="shrink-0 [&>button]:h-10"
          />

          <UiSelect
            aria-label={copy.specialtyAria}
            selectSize="sm"
            wrapperClassName="min-w-[160px] flex-1 sm:w-[215px] sm:flex-initial shrink-0"
            startIcon={
              <Stethoscope className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
            }
            className="h-10 rounded-xl border-transparent bg-white px-3 text-xs font-semibold text-slate-900 shadow-2xs"
            value={specialtyFilter}
            onChange={(e) => {
              const next = e.target.value;
              setSpecialtyFilter(next);
              if (next !== "ALL") {
                setCategory("DOCTORS");
              }
            }}
          >
            <option value="ALL">{copy.allSpecialtiesOption}</option>
            {specialtyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </UiSelect>
        </div>

        <div
          role="tablist"
          aria-label={copy.tabsAria}
          className="grid grid-cols-2 gap-1.5 sm:grid-cols-5"
        >
          {(
            [
              { id: "ALL", label: copy.tabAll },
              { id: "DOCTORS", label: `${copy.tabDoctors} (${doctors.length})` },
              { id: "NURSES", label: `${copy.tabNurses} (${nurses.length})` },
              {
                id: "DRIVERS",
                label: `${copy.tabDrivers} (${filteredDrivers.length})`,
              },
              {
                id: "FACILITIES",
                label: `${copy.tabFacilities} (${filteredFacilities.length})`,
              },
            ] as const
          ).map((tab, idx) => {
            const active = category === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setCategory(tab.id);
                  setFacilityKindFilter("ALL");
                  if (tab.id !== "DOCTORS" && tab.id !== "ALL") {
                    setSpecialtyFilter("ALL");
                  }
                }}
                className={`${idx === 4 ? "col-span-2 sm:col-span-1" : ""} ${
                  active
                    ? "inline-flex h-10 w-full items-center justify-center truncate rounded-xl bg-[#0066CC] px-3 text-xs font-semibold text-white shadow-2xs"
                    : "inline-flex h-10 w-full items-center justify-center truncate rounded-xl border border-[#D7E4F2] bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-[#EBF4FF] hover:text-[#0066CC]"
                }`}
              >
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((skeleton) => (
            <div
              key={skeleton}
              className="h-32 animate-pulse rounded-2xl border border-[#D7E4F2] bg-white p-4"
            />
          ))}
        </div>
      ) : null}

      {!loading && showDoctors && doctors.length > 0 ? (
        <section className="space-y-2.5" aria-labelledby="profiles-doctors-heading">
          <div className="flex items-center justify-between">
            <h2
              id="profiles-doctors-heading"
              className="flex items-center gap-2 text-sm font-bold text-slate-950"
            >
              <Stethoscope className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
              <span>
                {copy.doctorsHeading} ({doctors.length})
              </span>
            </h2>
            <span className="text-[11px] font-medium text-slate-500">
              {copy.doctorsSubtitle}
            </span>
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {doctors.map((doc) => {
              const docPhoto =
                doc.avatarUrl ??
                resolveDefaultAvatar(doc.fullName, doc.role ?? "DOCTOR", doc.specialty);
              const localizedSpec = formatSpecialtyLabel(doc.specialty, locale);
              return (
                <article
                  key={doc.id}
                  className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-[#D7E4F2] bg-white p-4 transition hover:bg-[#E1EBF2]"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      aria-label={`${copy.inspectPrefix} ${doc.fullName}`}
                      onClick={() =>
                        openImage({
                          src: docPhoto,
                          alt: doc.fullName,
                          title: doc.fullName,
                          subtitle: `${localizedSpec} · ${doc.facilityName ?? countryCode}`,
                          badge: localizedSpec,
                          specs: [
                            { label: copy.specialtyLabel, value: localizedSpec },
                            {
                              label: copy.practicingCenterLabel,
                              value: doc.facilityName ?? copy.regionalPractice,
                            },
                            {
                              label: copy.careModesLabel,
                              value: copy.careModesClinicVideo,
                            },
                            {
                              label: copy.consultationFeeLabel,
                              value: formatMoney(doc.consultationFeeMinor, currencyCode),
                            },
                          ],
                          actionHref: `/booking?country=${doc.countryCode}&doctorId=${doc.id}`,
                          actionLabel: copy.bookDoctorAction,
                        })
                      }
                      className="h-12 w-12 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ring-teal-700 transition hover:ring-2 focus:outline-none focus:ring-2"
                    >
                      <img
                        src={docPhoto}
                        alt={doc.fullName}
                        className="h-full w-full object-cover object-top"
                      />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-bold text-slate-900">
                          <button
                            type="button"
                            onClick={() => openPractitionerDossier(doc)}
                            className="text-start hover:text-teal-800 hover:underline"
                          >
                            <bdi dir="auto">{doc.fullName}</bdi>
                          </button>
                        </h3>
                        <UiBadge tone="teal">{localizedSpec}</UiBadge>
                      </div>
                      <p className="truncate text-xs text-slate-600">
                        <bdi dir="auto">
                          {doc.facilityName ??
                            `${doc.countryCode} ${copy.medicalClinicSuffix}`}
                        </bdi>
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                        <span className="rounded-xl bg-white px-2 py-0.5 font-medium text-slate-700 shadow-2xs">
                          {copy.careModesShort}
                        </span>
                        <span className="font-mono-tabular font-bold text-[#0066CC]">
                          {formatMoney(doc.consultationFeeMinor, currencyCode)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1.5">
                    <BookmarkButton
                      compact
                      entry={{
                        id: doc.id,
                        kind: "DOCTOR",
                        countryCode: doc.countryCode,
                        title: doc.fullName,
                        subtitle: `${localizedSpec} · ${doc.facilityName ?? doc.countryCode}`,
                        ...(doc.facilityId ? { facilityId: doc.facilityId } : {}),
                        ...(doc.facilityName
                          ? { facilityName: doc.facilityName }
                          : {}),
                        href: `/booking?country=${doc.countryCode}&doctorId=${doc.id}`,
                      }}
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openPractitionerDossier(doc)}
                        className="inline-flex h-8 items-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition hover:text-[#0066CC] active:scale-[0.98]"
                      >
                        {copy.profileBtn}
                      </button>
                      <Link
                        href={`/booking?country=${doc.countryCode}&doctorId=${doc.id}`}
                        className="inline-flex h-8 items-center rounded-xl bg-[#0066CC] px-3.5 text-xs font-semibold text-white transition hover:bg-[#0052A3] active:scale-[0.98]"
                      >
                        {copy.bookVisitBtn}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!loading && showNurses && nurses.length > 0 ? (
        <section className="space-y-2.5" aria-labelledby="profiles-nurses-heading">
          <div className="flex items-center justify-between">
            <h2
              id="profiles-nurses-heading"
              className="flex items-center gap-2 text-sm font-bold text-slate-900"
            >
              <Home className="h-4 w-4 text-[#0066CC]" aria-hidden="true" />
              <span>
                {copy.nursesHeading} ({nurses.length})
              </span>
            </h2>
            <span className="text-[11px] font-medium text-slate-500">
              {copy.nursesSubtitle}
            </span>
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {nurses.map((nurse) => {
              const nursePhoto =
                nurse.avatarUrl ??
                resolveDefaultAvatar(nurse.fullName, nurse.role ?? "NURSE", nurse.specialty);
              const localizedNurseSpec = formatSpecialtyLabel(
                nurse.specialty,
                locale,
              );
              return (
                <article
                  key={nurse.id}
                  className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-[#D7E4F2] bg-white p-4 transition hover:bg-[#E1EBF2]"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      aria-label={`${copy.inspectPrefix} ${nurse.fullName}`}
                      onClick={() =>
                        openImage({
                          src: nursePhoto,
                          alt: nurse.fullName,
                          title: nurse.fullName,
                          subtitle: `${localizedNurseSpec} · ${copy.homeVisitDispatch}`,
                          badge: copy.homeVisitInfirmierBadge,
                          specs: [
                            { label: copy.careTrackLabel, value: localizedNurseSpec },
                            {
                              label: copy.visitModeLabel,
                              value: copy.homeVisitDomicile,
                            },
                            {
                              label: copy.dispatchBaseLabel,
                              value: nurse.facilityName ?? copy.hospitalNetwork,
                            },
                            {
                              label: copy.homeVisitFeeLabel,
                              value: formatMoney(nurse.consultationFeeMinor, currencyCode),
                            },
                          ],
                          actionHref: `/booking?country=${nurse.countryCode}&doctorId=${nurse.id}&provider=nurse`,
                          actionLabel: copy.requestNurseAction,
                        })
                      }
                      className="h-12 w-12 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-emerald-200 bg-slate-100 ring-emerald-700 transition hover:ring-2 focus:outline-none focus:ring-2"
                    >
                      <img
                        src={nursePhoto}
                        alt={nurse.fullName}
                        className="h-full w-full object-cover object-top"
                      />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-bold text-slate-900">
                          <button
                            type="button"
                            onClick={() => openPractitionerDossier(nurse)}
                            className="text-start hover:text-emerald-800 hover:underline"
                          >
                            <bdi dir="auto">{nurse.fullName}</bdi>
                          </button>
                        </h3>
                        <UiBadge tone="emerald">{copy.homeVisitBadge}</UiBadge>
                      </div>
                      <p className="truncate text-xs text-slate-600">
                        <bdi dir="auto">
                          {localizedNurseSpec} · {copy.dispatchFromPrefix}{" "}
                          {nurse.facilityName ?? countryCode}
                        </bdi>
                      </p>
                      <div className="flex items-center gap-2 pt-0.5 text-[11px]">
                        <span className="font-mono-tabular font-bold text-emerald-800">
                          {formatMoney(nurse.consultationFeeMinor, currencyCode)}{" "}
                          {copy.perHomeVisit}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1.5">
                    <BookmarkButton
                      compact
                      entry={{
                        id: nurse.id,
                        kind: "NURSE",
                        countryCode: nurse.countryCode,
                        title: nurse.fullName,
                        subtitle: `${localizedNurseSpec} · ${copy.homeVisitBadge}`,
                        ...(nurse.facilityId
                          ? { facilityId: nurse.facilityId }
                          : {}),
                        ...(nurse.facilityName
                          ? { facilityName: nurse.facilityName }
                          : {}),
                        href: `/booking?country=${nurse.countryCode}&doctorId=${nurse.id}&provider=nurse`,
                      }}
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openPractitionerDossier(nurse)}
                        className="inline-flex h-8 items-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition hover:text-[#0066CC] active:scale-[0.98]"
                      >
                        {copy.profileBtn}
                      </button>
                      <Link
                        href={`/booking?country=${nurse.countryCode}&doctorId=${nurse.id}&provider=nurse`}
                        className="inline-flex h-8 items-center rounded-xl bg-[#0066CC] px-3.5 text-xs font-semibold text-white transition hover:bg-[#0052A3] active:scale-[0.98]"
                      >
                        {copy.requestHomeVisitBtn}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!loading && showDrivers && filteredDrivers.length > 0 ? (
        <section className="space-y-2.5" aria-labelledby="profiles-drivers-heading">
          <div className="flex items-center justify-between">
            <h2
              id="profiles-drivers-heading"
              className="flex items-center gap-2 text-sm font-bold text-slate-900"
            >
              <Ambulance className="h-4 w-4 text-rose-700" aria-hidden="true" />
              <span>
                {copy.driversHeading} ({filteredDrivers.length})
              </span>
            </h2>
            <span className="text-[11px] font-medium text-slate-500">
              {copy.driversSubtitle}
            </span>
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredDrivers.map((drv) => {
              const driverPhoto =
                drv.avatarUrl ?? resolveDefaultAvatar(drv.fullName, "DRIVER");
              const vehiclePhoto = resolveVehiclePicture(drv.vehicleType);
              return (
                <article
                  key={drv.id}
                  className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-[#D7E4F2] bg-white p-4 transition hover:bg-[#E1EBF2]"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      aria-label={`${copy.inspectPrefix} ${drv.fullName}`}
                      onClick={() =>
                        openImage({
                          src: vehiclePhoto,
                          alt: drv.vehicleLabel,
                          title: `${drv.fullName} · ${drv.vehicleLabel}`,
                          subtitle: drv.serviceZone,
                          badge: drv.liveStatus
                            ? formatDriverStatus(drv.liveStatus, locale)
                            : copy.standbyStatus,
                          specs: [
                            { label: copy.unitTypeLabel, value: drv.vehicleType },
                            { label: copy.vehicleLabel, value: drv.vehicleLabel },
                            { label: copy.zoneLabel, value: drv.serviceZone },
                            {
                              label: copy.homeBaseLabel,
                              value: drv.facilityName ?? copy.regionalDispatch,
                            },
                          ],
                          actionHref: `/map?country=${drv.countryCode}&layer=DRIVER`,
                          actionLabel: copy.trackOnLiveMapAction,
                        })
                      }
                      className="h-12 w-12 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ring-teal-700 transition hover:ring-2 focus:outline-none focus:ring-2"
                    >
                      <img
                        src={driverPhoto}
                        alt={drv.fullName}
                        className="h-full w-full object-cover object-top"
                      />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-bold text-slate-900">
                          <button
                            type="button"
                            onClick={() => openDriverDossier(drv)}
                            className="text-start hover:text-teal-800 hover:underline"
                          >
                            <bdi dir="auto">{drv.fullName}</bdi>
                          </button>
                        </h3>
                        <UiBadge
                          tone={drv.liveStatus === "AVAILABLE" ? "emerald" : "amber"}
                        >
                          {drv.liveStatus
                            ? formatDriverStatus(drv.liveStatus, locale)
                            : copy.standbyStatus}
                        </UiBadge>
                      </div>
                      <p className="truncate text-xs font-medium text-slate-700">
                        {drv.vehicleLabel}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {drv.serviceZone}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                      {drv.vehicleType === "AMBULANCE"
                        ? copy.emsAmbulance
                        : copy.medicalShuttle}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openDriverDossier(drv)}
                        className="inline-flex h-8 items-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition hover:text-[#0066CC] active:scale-[0.98]"
                      >
                        {copy.unitInfoBtn}
                      </button>
                      <Link
                        href={`/map?country=${drv.countryCode}&layer=DRIVER`}
                        className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#0066CC] px-3.5 text-xs font-semibold text-white transition hover:bg-[#0052A3] active:scale-[0.98]"
                      >
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        <span>{copy.trackOnMapBtn}</span>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!loading && showFacilities && filteredFacilities.length > 0 ? (
        <section
          className="space-y-2.5"
          aria-labelledby="profiles-facilities-heading"
        >
          <div className="flex items-center justify-between">
            <h2
              id="profiles-facilities-heading"
              className="flex items-center gap-2 text-sm font-bold text-slate-900"
            >
              <Building2 className="h-4 w-4 text-teal-700" aria-hidden="true" />
              <span>
                {copy.facilitiesHeading} ({filteredFacilities.length})
              </span>
            </h2>
            <span className="text-[11px] font-medium text-slate-500">
              {copy.facilitiesSubtitle}
            </span>
          </div>

          <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredFacilities.map((fac) => {
              const facPhoto = resolveFacilityPicture(fac.kind);
              const kindLabel = formatFacilityKind(fac.kind, locale);
              const isPharmacy = fac.kind === "PHARMACY";
              const targetHref = isPharmacy
                ? `/pharmacy?country=${fac.countryCode}&facilityId=${fac.id}`
                : `/map?country=${fac.countryCode}&facilityId=${fac.id}`;
              const ctaLabel = isPharmacy
                ? copy.browsePharmacyCta
                : copy.viewOnMapCta;

              return (
                <article
                  key={fac.id}
                  className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-[#D7E4F2] bg-white p-4 transition hover:bg-[#E1EBF2]"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        openImage({
                          src: facPhoto,
                          alt: fac.name,
                          title: fac.name,
                          subtitle: `${kindLabel} · ${fac.address}`,
                          badge: formatOpenStatus(fac.openStatus, locale),
                          specs: [
                            { label: copy.facilityTypeLabel, value: kindLabel },
                            { label: copy.licenseLabel, value: fac.licenseNumber },
                            { label: copy.addressLabel, value: fac.address },
                            {
                              label: copy.statusLabel,
                              value: formatOpenStatus(fac.openStatus, locale),
                            },
                          ],
                          actionHref: targetHref,
                          actionLabel: ctaLabel,
                        })
                      }
                      aria-label={`${copy.inspectPrefix} ${fac.name}`}
                      className="h-14 w-14 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ring-teal-700 transition hover:ring-2 focus:outline-none focus:ring-2"
                    >
                      <img
                        src={facPhoto}
                        alt={fac.name}
                        className="h-full w-full object-cover"
                      />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-bold text-slate-900">
                          <button
                            type="button"
                            onClick={() => openFacilityDossier(fac)}
                            className="text-start hover:text-teal-800 hover:underline"
                          >
                            <bdi dir="auto">{fac.name}</bdi>
                          </button>
                        </h3>
                        <UiBadge
                          tone={fac.openStatus === "OPEN" ? "emerald" : "amber"}
                        >
                          {formatOpenStatus(fac.openStatus, locale)}
                        </UiBadge>
                      </div>
                      <p className="truncate text-xs text-slate-600">
                        <bdi dir="auto">{fac.address}</bdi>
                      </p>
                      <p className="font-mono-tabular text-[11px] text-slate-500">
                        {kindLabel} · {fac.licenseNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    <BookmarkButton
                      compact
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
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openFacilityDossier(fac)}
                        className="inline-flex h-8 items-center rounded-xl bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition hover:text-[#0066CC] active:scale-[0.98]"
                      >
                        {copy.teamAndInfoBtn}
                      </button>
                      <Link
                        href={targetHref}
                        className="inline-flex h-8 items-center rounded-xl bg-white px-3.5 text-xs font-semibold text-slate-800 shadow-2xs transition hover:text-[#0066CC] active:scale-[0.98]"
                      >
                        {ctaLabel}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!loading &&
      doctors.length === 0 &&
      nurses.length === 0 &&
      filteredDrivers.length === 0 &&
      filteredFacilities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-slate-800">
            {copy.emptyTitlePrefix} {countryDisplayName}.
          </p>
          <p className="mt-1 text-xs text-slate-500">{copy.emptyHint}</p>
        </div>
      ) : null}
      </ConsumerWorkspaceGuard>

      {dossierTarget ? (
        <ProfileDossierModal
          target={dossierTarget}
          apiBaseUrl={apiBaseUrl}
          currencyCode={currencyCode}
          onClose={() => setDossierTarget(null)}
          onInspectDoctor={(doc) => openPractitionerDossier(doc)}
          onInspectDriver={(drv) => openDriverDossier(drv)}
          onInspectFacility={(fac) => openFacilityDossier(fac)}
        />
      ) : null}
    </div>
  );
}
