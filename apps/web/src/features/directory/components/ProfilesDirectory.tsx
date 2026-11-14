"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  CountryPack,
  DirectoryDoctorSummary,
  DirectoryDriverSummary,
  DirectoryFacilitySummary,
} from "@medisync/contracts";
import { Search } from "lucide-react";
import {
  fetchDirectoryDoctors,
  fetchDirectoryDrivers,
  fetchDirectoryFacilities,
} from "@/shared/api/directory-client";
import {
  formatDriverStatus,
  formatFacilityKind,
  formatOpenStatus,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import {
  resolveDefaultAvatar,
  resolveFacilityPicture,
  resolveVehiclePicture,
} from "@/shared/ui/EntityAvatar";
import { EntityMediaPair } from "@/shared/ui/EntityMediaPair";
import { useImageLightbox } from "@/shared/ui/ImageLightboxProvider";
import {
  RegionTabs,
  StatusBanner,
  UiBadge,
  UiInput,
  type RegionTabOption,
} from "@/shared/ui/primitives";

type DirectoryCategory =
  | "ALL"
  | "DOCTORS"
  | "NURSES"
  | "DRIVERS"
  | "FACILITIES";

function isNurseSpecialty(specialty: string): boolean {
  return /nursing|infirmier|nurse/i.test(specialty);
}

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
  const { t } = useLocale();
  const { openImage } = useImageLightbox();

  const [countryCode, setCountryCode] = useState<string>(
    packs[0]?.code ?? "MA",
  );
  const [category, setCategory] = useState<DirectoryCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [doctorsAndNurses, setDoctorsAndNurses] = useState<
    DirectoryDoctorSummary[]
  >([]);
  const [drivers, setDrivers] = useState<DirectoryDriverSummary[]>([]);
  const [facilities, setFacilities] = useState<DirectoryFacilitySummary[]>([]);

  const regionOptions: readonly RegionTabOption[] = useMemo(
    () =>
      packs.map((pack) => ({
        code: pack.code,
        label: `${pack.code} · ${pack.name}`,
      })),
    [packs],
  );

  const activePack = useMemo(
    () => packs.find((p) => p.code === countryCode) ?? packs[0],
    [packs, countryCode],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg(null);

    Promise.all([
      fetchDirectoryDoctors(apiBaseUrl, { countryCode, limit: 50 }),
      fetchDirectoryDrivers(apiBaseUrl, { countryCode, limit: 50 }),
      fetchDirectoryFacilities(apiBaseUrl, { countryCode, limit: 50 }),
    ])
      .then(([docRes, drvRes, facRes]) => {
        if (!active) return;
        if (!docRes.ok || !drvRes.ok || !facRes.ok) {
          setErrorMsg(
            "Unable to refresh live directory records right now. Showing last synced profiles.",
          );
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
  }, [apiBaseUrl, countryCode]);

  const q = searchQuery.trim().toLowerCase();

  const doctors = useMemo(
    () =>
      doctorsAndNurses.filter(
        (d) =>
          !isNurseSpecialty(d.specialty) &&
          (!q ||
            d.fullName.toLowerCase().includes(q) ||
            d.specialty.toLowerCase().includes(q) ||
            (d.facilityName?.toLowerCase().includes(q) ?? false)),
      ),
    [doctorsAndNurses, q],
  );

  const nurses = useMemo(
    () =>
      doctorsAndNurses.filter(
        (d) =>
          isNurseSpecialty(d.specialty) &&
          (!q ||
            d.fullName.toLowerCase().includes(q) ||
            d.specialty.toLowerCase().includes(q) ||
            (d.facilityName?.toLowerCase().includes(q) ?? false)),
      ),
    [doctorsAndNurses, q],
  );

  const filteredDrivers = useMemo(
    () =>
      drivers.filter(
        (drv) =>
          !q ||
          drv.fullName.toLowerCase().includes(q) ||
          drv.vehicleLabel.toLowerCase().includes(q) ||
          drv.serviceZone.toLowerCase().includes(q) ||
          (drv.facilityName?.toLowerCase().includes(q) ?? false),
      ),
    [drivers, q],
  );

  const filteredFacilities = useMemo(
    () =>
      facilities.filter(
        (fac) =>
          !q ||
          fac.name.toLowerCase().includes(q) ||
          fac.kind.toLowerCase().includes(q) ||
          fac.address.toLowerCase().includes(q),
      ),
    [facilities, q],
  );

  const currencyCode = activePack?.currencyCode ?? "MAD";

  const showDoctors = category === "ALL" || category === "DOCTORS";
  const showNurses = category === "ALL" || category === "NURSES";
  const showDrivers = category === "ALL" || category === "DRIVERS";
  const showFacilities = category === "ALL" || category === "FACILITIES";

  return (
    <div className="min-w-0 w-full space-y-6 overflow-x-hidden">
      <header className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
          {t("profiles.eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {t("profiles.heading")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {t("profiles.subtitle")}
        </p>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <RegionTabs
            value={countryCode}
            onChange={setCountryCode}
            options={regionOptions}
          />

          <div className="relative w-full lg:max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <UiInput
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctors, nurses, drivers, clinics..."
              aria-label="Search profiles directory"
              className="pl-9"
            />
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Profile directory categories"
          className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4"
        >
          {(
            [
              { id: "ALL", label: "All Profiles" },
              { id: "DOCTORS", label: `Doctors (${doctors.length})` },
              {
                id: "NURSES",
                label: `Nurses & Infirmiers (${nurses.length})`,
              },
              {
                id: "DRIVERS",
                label: `Drivers & Fleet (${filteredDrivers.length})`,
              },
              {
                id: "FACILITIES",
                label: `Centers & Pharmacies (${filteredFacilities.length})`,
              },
            ] as const
          ).map((tab) => {
            const active = category === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(tab.id)}
                className={
                  active
                    ? "min-h-[36px] rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white"
                    : "min-h-[36px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-teal-700 hover:bg-white hover:text-teal-900"
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {errorMsg ? <StatusBanner tone="warning" message={errorMsg} /> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((skeleton) => (
            <div
              key={skeleton}
              className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-5"
            />
          ))}
        </div>
      ) : null}

      {!loading && showDoctors && doctors.length > 0 ? (
        <section className="space-y-3" aria-labelledby="profiles-doctors-heading">
          <div className="flex items-center justify-between">
            <h2
              id="profiles-doctors-heading"
              className="text-base font-bold text-slate-900"
            >
              Doctors & Practicing Clinics
            </h2>
            <span className="text-xs font-medium text-slate-500">
              Click any photo to zoom
            </span>
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {doctors.map((doc) => {
              const docPhoto =
                doc.avatarUrl ??
                resolveDefaultAvatar(doc.fullName, "DOCTOR", doc.specialty);
              const workplacePhoto = resolveFacilityPicture("CLINIC");
              return (
                <article
                  key={doc.id}
                  className="flex min-w-0 w-full flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
                >
                  <div className="flex min-w-0 flex-wrap items-start gap-3.5 sm:flex-nowrap">
                    <EntityMediaPair
                      primarySrc={docPhoto}
                      primaryAlt={doc.fullName}
                      primaryLabel="Doctor Portrait"
                      secondarySrc={workplacePhoto}
                      secondaryAlt={doc.facilityName ?? "Medical Clinic"}
                      secondaryLabel="Clinic Interior"
                      title={doc.fullName}
                      subtitle={`${doc.specialty} · ${doc.facilityName ?? countryCode}`}
                      badge={doc.specialty}
                      specs={[
                        { label: "Specialty", value: doc.specialty },
                        {
                          label: "Clinic Workplace",
                          value: doc.facilityName ?? "Regional Practice",
                        },
                        {
                          label: "Consultation Fee",
                          value: formatMoney(
                            doc.consultationFeeMinor,
                            currencyCode,
                          ),
                        },
                        { label: "Care Region", value: doc.countryCode },
                      ]}
                      actionHref={`/booking?country=${doc.countryCode}&doctorId=${doc.id}`}
                      actionLabel="Book Doctor Appointment"
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-bold text-slate-900">
                          <bdi dir="auto">{doc.fullName}</bdi>
                        </h3>
                        <UiBadge tone="teal">{doc.specialty}</UiBadge>
                      </div>
                      <p className="truncate text-xs font-medium text-slate-600">
                        <bdi dir="auto">
                          {doc.facilityName ?? `${doc.countryCode} Medical Clinic`}
                        </bdi>
                      </p>
                      <p className="font-mono-tabular text-xs font-semibold text-teal-800">
                        {formatMoney(doc.consultationFeeMinor, currencyCode)} per visit
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-slate-100 pt-3">
                    <Link
                      href={`/booking?country=${doc.countryCode}&doctorId=${doc.id}`}
                      className="inline-flex min-h-[36px] items-center rounded-lg bg-teal-800 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-900"
                    >
                      Book Visit
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!loading && showNurses && nurses.length > 0 ? (
        <section className="space-y-3" aria-labelledby="profiles-nurses-heading">
          <div className="flex items-center justify-between">
            <h2
              id="profiles-nurses-heading"
              className="text-base font-bold text-slate-900"
            >
              Nurses (Infirmiers) & Care Hubs
            </h2>
            <span className="text-xs font-medium text-slate-500">
              Home care & post-op support
            </span>
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {nurses.map((nurse) => {
              const nursePhoto =
                nurse.avatarUrl ??
                resolveDefaultAvatar(nurse.fullName, "DOCTOR", nurse.specialty);
              const hubPhoto = resolveFacilityPicture("HOSPITAL");
              return (
                <article
                  key={nurse.id}
                  className="flex min-w-0 w-full flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
                >
                  <div className="flex min-w-0 flex-wrap items-start gap-3.5 sm:flex-nowrap">
                    <EntityMediaPair
                      primarySrc={nursePhoto}
                      primaryAlt={nurse.fullName}
                      primaryLabel="Infirmier Portrait"
                      secondarySrc={hubPhoto}
                      secondaryAlt={nurse.facilityName ?? "Care Hub"}
                      secondaryLabel="Hospital Hub"
                      title={nurse.fullName}
                      subtitle={`${nurse.specialty} · ${nurse.facilityName ?? countryCode}`}
                      badge="Registered Infirmier"
                      specs={[
                        { label: "Care Track", value: nurse.specialty },
                        {
                          label: "Affiliated Hub",
                          value: nurse.facilityName ?? "Hospital Network",
                        },
                        {
                          label: "Visit Fee",
                          value: formatMoney(
                            nurse.consultationFeeMinor,
                            currencyCode,
                          ),
                        },
                        { label: "Care Region", value: nurse.countryCode },
                      ]}
                      actionHref={`/booking?country=${nurse.countryCode}&doctorId=${nurse.id}&provider=nurse`}
                      actionLabel="Schedule Nurse Care"
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-bold text-slate-900">
                          <bdi dir="auto">{nurse.fullName}</bdi>
                        </h3>
                        <UiBadge tone="emerald">Infirmier</UiBadge>
                      </div>
                      <p className="truncate text-xs font-medium text-slate-600">
                        <bdi dir="auto">
                          {nurse.facilityName ?? `${nurse.countryCode} Hospital Hub`}
                        </bdi>
                      </p>
                      <p className="font-mono-tabular text-xs font-semibold text-teal-800">
                        {formatMoney(nurse.consultationFeeMinor, currencyCode)} per visit
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-slate-100 pt-3">
                    <Link
                      href={`/booking?country=${nurse.countryCode}&doctorId=${nurse.id}&provider=nurse`}
                      className="inline-flex min-h-[36px] items-center rounded-lg bg-teal-800 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-900"
                    >
                      Book Infirmier
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!loading && showDrivers && filteredDrivers.length > 0 ? (
        <section className="space-y-3" aria-labelledby="profiles-drivers-heading">
          <div className="flex items-center justify-between">
            <h2
              id="profiles-drivers-heading"
              className="text-base font-bold text-slate-900"
            >
              Drivers & Medical Transport Fleet
            </h2>
            <span className="text-xs font-medium text-slate-500">
              Driver portrait paired with assigned vehicle
            </span>
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {filteredDrivers.map((drv) => {
              const driverPhoto =
                drv.avatarUrl ?? resolveDefaultAvatar(drv.fullName, "DRIVER");
              const vehiclePhoto = resolveVehiclePicture(drv.vehicleType);
              return (
                <article
                  key={drv.id}
                  className="flex min-w-0 w-full flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
                >
                  <div className="flex min-w-0 flex-wrap items-start gap-3.5 sm:flex-nowrap">
                    <EntityMediaPair
                      primarySrc={driverPhoto}
                      primaryAlt={drv.fullName}
                      primaryLabel="Driver Photo"
                      secondarySrc={vehiclePhoto}
                      secondaryAlt={drv.vehicleLabel}
                      secondaryLabel={
                        drv.vehicleType === "AMBULANCE"
                          ? "Ambulance Unit"
                          : "Shuttle Car"
                      }
                      title={drv.fullName}
                      subtitle={`${drv.vehicleLabel} · ${drv.serviceZone}`}
                      badge={
                        drv.liveStatus
                          ? formatDriverStatus(drv.liveStatus)
                          : "On Standby"
                      }
                      specs={[
                        { label: "Assigned Vehicle", value: drv.vehicleLabel },
                        { label: "Service Zone", value: drv.serviceZone },
                        {
                          label: "Home Base",
                          value: drv.facilityName ?? "Regional Dispatch",
                        },
                        {
                          label: "Live Status",
                          value: drv.liveStatus
                            ? formatDriverStatus(drv.liveStatus)
                            : "Standby",
                        },
                      ]}
                      actionHref={`/map?country=${drv.countryCode}`}
                      actionLabel="Request Pickup on Live Map"
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-bold text-slate-900">
                          <bdi dir="auto">{drv.fullName}</bdi>
                        </h3>
                        <UiBadge
                          tone={
                            drv.liveStatus === "AVAILABLE" ? "emerald" : "amber"
                          }
                        >
                          {drv.liveStatus
                            ? formatDriverStatus(drv.liveStatus)
                            : "Standby"}
                        </UiBadge>
                      </div>
                      <p className="truncate text-xs font-medium text-slate-700">
                        {drv.vehicleLabel}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {drv.serviceZone}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-slate-100 pt-3">
                    <Link
                      href={`/map?country=${drv.countryCode}`}
                      className="inline-flex min-h-[36px] items-center rounded-lg bg-teal-800 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-900"
                    >
                      Open Dispatch Map
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {!loading && showFacilities && filteredFacilities.length > 0 ? (
        <section
          className="space-y-3"
          aria-labelledby="profiles-facilities-heading"
        >
          <div className="flex items-center justify-between">
            <h2
              id="profiles-facilities-heading"
              className="text-base font-bold text-slate-900"
            >
              Hospitals, Clinics, Pharmacies & Diagnostic Labs
            </h2>
            <span className="text-xs font-medium text-slate-500">
              Verified locations
            </span>
          </div>

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {filteredFacilities.map((fac) => {
              const facPhoto = resolveFacilityPicture(fac.kind);
              const kindLabel = formatFacilityKind(fac.kind);
              const isPharmacy = fac.kind === "PHARMACY";
              const targetHref = isPharmacy
                ? `/pharmacy?country=${fac.countryCode}&facilityId=${fac.id}`
                : `/map?country=${fac.countryCode}&facilityId=${fac.id}`;
              const ctaLabel = isPharmacy
                ? "Browse Storefront"
                : "View on Live Map";

              return (
                <article
                  key={fac.id}
                  className="flex min-w-0 w-full flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
                >
                  <div className="flex min-w-0 flex-wrap items-start gap-3.5 sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={() =>
                        openImage({
                          src: facPhoto,
                          alt: fac.name,
                          title: fac.name,
                          subtitle: `${kindLabel} · ${fac.address}`,
                          badge: formatOpenStatus(fac.openStatus),
                          specs: [
                            { label: "Facility Type", value: kindLabel },
                            {
                              label: "License",
                              value: fac.licenseNumber,
                            },
                            { label: "Address", value: fac.address },
                            {
                              label: "Status",
                              value: formatOpenStatus(fac.openStatus),
                            },
                          ],
                          actionHref: targetHref,
                          actionLabel: ctaLabel,
                        })
                      }
                      aria-label={`Inspect ${fac.name} photo`}
                      className="group relative h-16 w-24 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition hover:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    >
                      <img
                        src={facPhoto}
                        alt={fac.name}
                        className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                      />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-bold text-slate-900">
                          <bdi dir="auto">{fac.name}</bdi>
                        </h3>
                        <UiBadge tone="slate">{kindLabel}</UiBadge>
                        <UiBadge
                          tone={
                            fac.openStatus === "OPEN" ? "emerald" : "amber"
                          }
                        >
                          {formatOpenStatus(fac.openStatus)}
                        </UiBadge>
                      </div>
                      <p className="truncate text-xs text-slate-600">
                        <bdi dir="auto">{fac.address}</bdi>
                      </p>
                      <p className="font-mono-tabular text-[11px] text-slate-500">
                        License {fac.licenseNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-slate-100 pt-3">
                    <Link
                      href={targetHref}
                      className="inline-flex min-h-[36px] items-center rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-teal-700 hover:text-teal-900"
                    >
                      {ctaLabel}
                    </Link>
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
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-800">
            No matching profiles found in {countryCode}.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Try clearing the search query or switching regions above.
          </p>
        </div>
      ) : null}
    </div>
  );
}
