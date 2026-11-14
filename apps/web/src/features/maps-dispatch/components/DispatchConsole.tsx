"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DispatchStreamEventSchema,
  FacilityKindSchema,
  type AuthResponse,
  type CountryPack,
  type DirectoryDriverSummary,
  type DispatchRequestSummary,
  type DispatchUrgency,
  type DriverStatus,
  type FacilityKind,
  type LiveDriverMarker,
  type ViewportFacilityItem,
} from "@medisync/contracts";
import {
  checkBackendOnline,
  fetchDirectoryDrivers,
} from "@/shared/api/directory-client";
import {
  clearStoredSession,
  readStoredSession,
} from "@/shared/auth/session-storage";
import {
  formatDispatchStatus,
  formatFacilityKind,
  formatOpenStatus,
  formatUrgencyLabel,
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
  SessionAccountBar,
  StatusBanner,
  UiBadge,
  UiButton,
  UiInput,
  UiSelect,
  UiSwitch,
  type RegionTabOption,
} from "@/shared/ui/primitives";
import {
  Navigation,
  Radio,
  Siren,
} from "lucide-react";
import {
  createDispatchRequest,
  listDispatchRequests,
  queryNearbyDrivers,
  queryViewportFacilities,
  sendDriverLocationPing,
  updateDispatchStatus,
} from "../api-client";
import {
  getPresetForCountry,
  getViewportCenter,
  panViewport,
  zoomViewport,
  type ViewportBox,
} from "../presets";
import { ViewportVectorMap } from "./ViewportVectorMap";

interface DispatchConsoleProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
}

const SECTOR_FILTER_OPTIONS: ReadonlyArray<{
  label: string;
  value: FacilityKind | "ALL";
}> = [
  { label: "All Sectors", value: "ALL" },
  { label: "Hospitals", value: "HOSPITAL" },
  { label: "Clinics", value: "CLINIC" },
  { label: "Pharmacies", value: "PHARMACY" },
  { label: "Diagnostic Labs", value: "DIAGNOSTIC_LAB" },
];

export function DispatchConsole({ packs, apiBaseUrl }: DispatchConsoleProps) {
  const { t } = useLocale();
  const { openImage } = useImageLightbox();
  const defaultCode = packs[0]?.code ?? "INTL";
  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCode);
  const [viewport, setViewport] = useState<ViewportBox>(() =>
    getPresetForCountry(defaultCode),
  );
  const [sectorFilter, setSectorFilter] = useState<FacilityKind | "ALL">("ALL");
  const [openNowOnly, setOpenNowOnly] = useState(false);

  const [facilities, setFacilities] = useState<ViewportFacilityItem[]>([]);
  const [directoryDrivers, setDirectoryDrivers] = useState<
    DirectoryDriverSummary[]
  >([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(
    null,
  );
  const [postgisQueryMs, setPostgisQueryMs] = useState<number | null>(null);

  const [session, setSession] = useState<AuthResponse | null>(null);
  const sessionToken = session?.token ?? null;
  const currentUser = session?.user ?? null;
  const [drivers, setDrivers] = useState<LiveDriverMarker[]>([]);
  const [redisQueryMs, setRedisQueryMs] = useState<number | null>(null);
  const [dispatches, setDispatches] = useState<DispatchRequestSummary[]>([]);
  const [streamConnected, setStreamConnected] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{
    tone: "info" | "success" | "error";
    text: string;
  } | null>(null);

  const regionOptions: readonly RegionTabOption[] = useMemo(
    () =>
      packs.map((pack) => ({
        code: pack.code,
        label: `${pack.code} · ${pack.name}`,
      })),
    [packs],
  );

  // Dispatch Request Form
  const initialCenter = getViewportCenter(viewport);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState(String(initialCenter.lat));
  const [pickupLng, setPickupLng] = useState(String(initialCenter.lng));
  const [urgency, setUrgency] = useState<DispatchUrgency>("URGENT");

  // Driver GPS Simulator Form
  const [driverLat, setDriverLat] = useState(String(initialCenter.lat));
  const [driverLng, setDriverLng] = useState(String(initialCenter.lng));
  const [driverStatus, setDriverStatus] = useState<DriverStatus>("AVAILABLE");

  useEffect(() => {
    const stored = readStoredSession();
    const params = new URLSearchParams(window.location.search);
    const urlCountry = params.get("country");
    const urlFacilityId = params.get("facilityId");
    const initialCountry =
      stored?.user.countryCode && stored.user.role !== "OPS_ADMIN"
        ? stored.user.countryCode
        : (urlCountry ?? stored?.user.countryCode ?? defaultCode);

    if (stored) {
      setSession(stored);
    }
    setSelectedCountry(initialCountry);
    setViewport(getPresetForCountry(initialCountry));
    if (urlFacilityId) {
      setSelectedFacilityId(urlFacilityId);
    }

    let cancelled = false;
    checkBackendOnline().then((online) => {
      if (!cancelled) {
        setApiOnline(online);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [defaultCode]);

  // Automatically load viewport facilities, fleet profiles, and live dispatches whenever backend is online
  useEffect(() => {
    if (!apiOnline) return;
    let active = true;
    const kindParam =
      sectorFilter === "ALL"
        ? undefined
        : FacilityKindSchema.parse(sectorFilter);

    queryViewportFacilities(apiBaseUrl, selectedCountry, viewport, {
      ...(kindParam ? { kind: kindParam } : {}),
      ...(openNowOnly ? { openNow: true } : {}),
    }).then((vpRes) => {
      if (!active || !vpRes.ok) return;
      setFacilities(vpRes.data.facilities);
      setPostgisQueryMs(vpRes.data.queryMs);
      if (vpRes.data.facilities[0] && !selectedFacilityId) {
        setSelectedFacilityId(vpRes.data.facilities[0].id);
      }
    });

    fetchDirectoryDrivers(apiBaseUrl, { countryCode: selectedCountry }).then(
      (fleetRes) => {
        if (!active || !fleetRes.ok) return;
        setDirectoryDrivers(fleetRes.drivers);
      },
    );

    if (sessionToken && currentUser) {
      const center = getViewportCenter(viewport);
      const scopedCountry =
        currentUser.role === "OPS_ADMIN"
          ? selectedCountry
          : currentUser.countryCode;

      queryNearbyDrivers(apiBaseUrl, sessionToken, {
        countryCode: scopedCountry,
        lat: center.lat,
        lng: center.lng,
        radiusKm: 30,
      }).then((drvRes) => {
        if (!active || !drvRes.ok) return;
        setDrivers(drvRes.data.drivers);
        setRedisQueryMs(drvRes.data.queryMs);
      });

      listDispatchRequests(apiBaseUrl, sessionToken, scopedCountry).then(
        (dispRes) => {
          if (!active || !dispRes.ok) return;
          setDispatches(dispRes.data.dispatches);
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
    viewport,
    sectorFilter,
    openNowOnly,
    sessionToken,
    currentUser,
    selectedFacilityId,
  ]);

  // Live Server-Sent Events Subscription (zero setInterval polling)
  useEffect(() => {
    if (!sessionToken || typeof EventSource === "undefined") {
      setStreamConnected(false);
      return;
    }

    const streamUrl = `${apiBaseUrl}/v1/dispatch/stream?token=${encodeURIComponent(
      sessionToken,
    )}`;
    const es = new EventSource(streamUrl);

    const handleDriverLocation = (event: MessageEvent<string>) => {
      try {
        const parsed = DispatchStreamEventSchema.safeParse(
          JSON.parse(event.data),
        );
        if (!parsed.success || parsed.data.type !== "driver.location") return;
        const incoming = parsed.data.driver;

        setDrivers((prev) => {
          const without = prev.filter((d) => d.driverId !== incoming.driverId);
          if (incoming.status === "OFF_DUTY") {
            return without;
          }
          return [incoming, ...without];
        });
      } catch {
        // Ignore malformed SSE payload
      }
    };

    const handleDispatchUpdated = (event: MessageEvent<string>) => {
      try {
        const parsed = DispatchStreamEventSchema.safeParse(
          JSON.parse(event.data),
        );
        if (!parsed.success || parsed.data.type !== "dispatch.updated") return;
        const incoming = parsed.data.dispatch;

        setDispatches((prev) => {
          const idx = prev.findIndex((item) => item.id === incoming.id);
          if (idx === -1) return [incoming, ...prev];
          return prev.map((item) => (item.id === incoming.id ? incoming : item));
        });
      } catch {
        // Ignore malformed SSE payload
      }
    };

    es.addEventListener("snapshot", () => setStreamConnected(true));
    es.addEventListener("driver.location", handleDriverLocation as EventListener);
    es.addEventListener(
      "dispatch.updated",
      handleDispatchUpdated as EventListener,
    );
    es.onerror = () => setStreamConnected(false);

    return () => {
      es.close();
      setStreamConnected(false);
    };
  }, [apiBaseUrl, sessionToken]);

  function handleCountrySelect(code: string) {
    const preset = getPresetForCountry(code);
    const center = getViewportCenter(preset);
    setSelectedCountry(code);
    setViewport(preset);
    setSelectedFacilityId(null);
    setPickupLat(String(center.lat));
    setPickupLng(String(center.lng));
    setDriverLat(String(center.lat));
    setDriverLng(String(center.lng));
  }

  async function handleSearchViewport(
    overrideBox?: ViewportBox,
    overrideCountry?: string,
  ) {
    const boxToQuery = overrideBox ?? viewport;
    const country = overrideCountry ?? selectedCountry;
    setBusy(true);
    setBanner(null);

    const kindParam =
      sectorFilter === "ALL"
        ? undefined
        : FacilityKindSchema.parse(sectorFilter);

    const vpRes = await queryViewportFacilities(apiBaseUrl, country, boxToQuery, {
      ...(kindParam ? { kind: kindParam } : {}),
      ...(openNowOnly ? { openNow: true } : {}),
    });

    if (!vpRes.ok) {
      setBusy(false);
      setBanner({
        tone: "error",
        text:
          vpRes.error === "API_UNREACHABLE"
            ? `API unreachable at ${apiBaseUrl}. Ensure PostgreSQL + Redis + Fastify API are running.`
            : `Viewport query failed (${vpRes.error}).`,
      });
      return;
    }

    setFacilities(vpRes.data.facilities);
    setPostgisQueryMs(vpRes.data.queryMs);

    if (sessionToken && currentUser) {
      const center = getViewportCenter(boxToQuery);
      const drvRes = await queryNearbyDrivers(apiBaseUrl, sessionToken, {
        countryCode:
          currentUser.role === "OPS_ADMIN" ? country : currentUser.countryCode,
        lat: center.lat,
        lng: center.lng,
        radiusKm: 30,
      });
      if (drvRes.ok) {
        setDrivers(drvRes.data.drivers);
        setRedisQueryMs(drvRes.data.queryMs);
      }
    }

    setBusy(false);
    setBanner({
      tone: "success",
      text: `Loaded ${vpRes.data.facilities.length} verified medical center(s) in this map view (${vpRes.data.queryMs}ms).`,
    });
  }

  async function handleDispatchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || !currentUser) return;

    setBusy(true);
    const res = await createDispatchRequest(apiBaseUrl, sessionToken, {
      pickupLat: Number(pickupLat),
      pickupLng: Number(pickupLng),
      pickupAddress,
      urgency,
      ...(selectedFacilityId ? { targetFacilityId: selectedFacilityId } : {}),
    });
    setBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text: `Dispatch request rejected (${res.error}).`,
      });
      return;
    }

    setPickupAddress("");
    setDispatches((prev) => [
      res.data.dispatch,
      ...prev.filter((d) => d.id !== res.data.dispatch.id),
    ]);
    setBanner({
      tone: "success",
      text: `Dispatch request broadcasted (${res.data.dispatch.urgency}).`,
    });
  }

  async function handleDriverPingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionToken || currentUser?.role !== "DRIVER") return;

    setBusy(true);
    const res = await sendDriverLocationPing(apiBaseUrl, sessionToken, {
      lat: Number(driverLat),
      lng: Number(driverLng),
      status: driverStatus,
    });
    setBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text: `GPS telemetry ping failed (${res.error}).`,
      });
      return;
    }

    setBanner({
      tone: "success",
      text: `Live GPS updated for ${res.data.driver.status} (${res.data.driver.lat.toFixed(4)}, ${res.data.driver.lng.toFixed(4)}).`,
    });
  }

  async function handleTransition(
    dispatchId: string,
    nextStatus: "ASSIGNED" | "EN_ROUTE" | "ARRIVED" | "COMPLETED" | "CANCELLED",
  ) {
    if (!sessionToken) return;
    setBusy(true);
    const res = await updateDispatchStatus(
      apiBaseUrl,
      sessionToken,
      dispatchId,
      nextStatus,
    );
    setBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text: `Dispatch update failed (${res.error}).`,
      });
      return;
    }

    setDispatches((prev) =>
      prev.map((d) => (d.id === dispatchId ? res.data.dispatch : d)),
    );
  }

  const activePack =
    packs.find((p) => p.code === selectedCountry) ?? packs[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Map Header & Filters */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-teal-800">
              {t("map.eyebrow")}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              {t("map.heading")}
            </h1>
            {activePack ? (
              <p className="mt-1 text-sm text-slate-600">
                <strong className="text-slate-900">
                  <bdi dir="auto">{activePack.name}</bdi>
                </strong>{" "}
                · {t("home.hotlineLabel")}{" "}
                <bdi
                  dir="ltr"
                  className="font-mono-tabular font-semibold text-red-700"
                >
                  {activePack.emergencyHotlines.ambulance}
                </bdi>
              </p>
            ) : null}
          </div>

          <RegionTabs
            options={regionOptions}
            value={selectedCountry}
            onChange={handleCountrySelect}
          />
        </div>

        <SessionAccountBar
          session={session}
          prompt="Sign in on the Care Portal to request medical transport or track live ambulances."
          onSignOut={() => {
            clearStoredSession();
            setSession(null);
            setDrivers([]);
            setDispatches([]);
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Facility sector filter">
            {SECTOR_FILTER_OPTIONS.map((opt) => {
              const active = sectorFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSectorFilter(opt.value)}
                  className={`min-h-[36px] rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <UiSwitch
            id="map-open-now"
            checked={openNowOnly}
            onChange={setOpenNowOnly}
            label={t("map.openNowOnly")}
          />
        </div>
      </section>

      {banner ? <StatusBanner tone={banner.tone} message={banner.text} /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Interactive Street Map + Facility Results */}
        <section className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5 lg:col-span-7">
          <ViewportVectorMap
            countryCode={selectedCountry}
            viewport={viewport}
            facilities={facilities}
            drivers={drivers}
            selectedFacilityId={selectedFacilityId}
            postgisQueryMs={postgisQueryMs}
            redisQueryMs={redisQueryMs}
            busy={busy}
            onSelectFacility={(id) => setSelectedFacilityId(id)}
            onZoom={(factor) => setViewport((box) => zoomViewport(box, factor))}
            onPan={(dLat, dLng) =>
              setViewport((box) => panViewport(box, dLat, dLng))
            }
            onReset={() => setViewport(getPresetForCountry(selectedCountry))}
            onSearchViewport={() => void handleSearchViewport()}
            onViewportChange={setViewport}
          />

          {(() => {
            const activeFacility =
              facilities.find((f) => f.id === selectedFacilityId) ?? null;
            if (!activeFacility) return null;
            const facPhoto = resolveFacilityPicture(activeFacility.kind);
            return (
              <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        openImage({
                          src: facPhoto,
                          alt: activeFacility.name,
                          primaryLabel: "Care Center Exterior / Interior",
                          title: activeFacility.name,
                          subtitle: `${formatFacilityKind(activeFacility.kind)} · ${activeFacility.address}`,
                          badge: formatOpenStatus(activeFacility.openStatus),
                          specs: [
                            {
                              label: "License",
                              value: activeFacility.licenseNumber,
                            },
                            {
                              label: "Specialties",
                              value:
                                activeFacility.specialties.join(", ") ||
                                formatFacilityKind(activeFacility.kind),
                            },
                          ],
                          actionHref: `/booking?country=${encodeURIComponent(activeFacility.countryCode)}&facilityId=${encodeURIComponent(activeFacility.id)}`,
                          actionLabel: "Book Visit",
                        })
                      }
                      aria-label={`Inspect ${activeFacility.name} facility photo`}
                      className="h-14 w-16 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-teal-200 bg-white transition hover:border-teal-700"
                    >
                      <img
                        src={facPhoto}
                        alt={activeFacility.name}
                        className="h-full w-full object-cover"
                      />
                    </button>
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate font-bold text-teal-950">
                        {activeFacility.name}
                      </p>
                      <p className="truncate text-slate-700">
                        {activeFacility.address}
                      </p>
                      <p className="text-[11px] font-medium text-teal-900">
                        {formatFacilityKind(activeFacility.kind)} ·{" "}
                        {formatOpenStatus(activeFacility.openStatus)}
                        {activeFacility.is24_7 ? " · Open 24/7" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <UiButton
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        setPickupAddress(activeFacility.address);
                        setPickupLat(String(activeFacility.lat));
                        setPickupLng(String(activeFacility.lng));
                      }}
                    >
                      Use for Pickup
                    </UiButton>
                    <Link
                      href={`/booking?country=${encodeURIComponent(activeFacility.countryCode)}&facilityId=${encodeURIComponent(activeFacility.id)}`}
                      className="text-xs font-semibold text-teal-800 hover:underline"
                    >
                      Book Visit →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
              Nearby Care Centers ({facilities.length})
            </h2>
            {facilities.length === 0 ? (
              <p className="text-sm text-slate-500">
                {apiOnline
                  ? "No verified medical centers found in this area or filter."
                  : "Click Search This Area once connected to view nearby care centers."}
              </p>
            ) : (
              <ul className="space-y-2">
                {facilities.map((fac) => {
                  const facPhoto = resolveFacilityPicture(fac.kind);
                  return (
                    <li
                      key={fac.id}
                      onClick={() => setSelectedFacilityId(fac.id)}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${
                        fac.id === selectedFacilityId
                          ? "border-teal-700 bg-teal-50/40"
                          : "border-slate-200 bg-slate-50 hover:border-teal-400"
                      }`}
                    >
                      <img
                        src={facPhoto}
                        alt={fac.name}
                        className="h-12 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {fac.name}
                            </p>
                            <p className="text-xs text-slate-600">
                              {formatFacilityKind(fac.kind)} · {fac.licenseNumber}
                              {fac.distanceMeters !== null
                                ? ` · ${(fac.distanceMeters / 1000).toFixed(2)} km`
                                : ""}
                            </p>
                          </div>
                          <UiBadge tone={fac.openStatus === "OPEN" ? "emerald" : "slate"}>
                            {formatOpenStatus(fac.openStatus)}
                          </UiBadge>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-600">
                          {fac.address}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Right: Live Transport Fleet, Driver/Requester Tools & Active Dispatches */}
        <aside className="min-w-0 space-y-4 lg:col-span-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio
                  className={`h-4 w-4 ${
                    streamConnected ? "text-emerald-600" : "text-slate-400"
                  }`}
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold text-slate-900">
                  Medical Transport & Fleet ({directoryDrivers.length})
                </h2>
              </div>

              <UiBadge tone={streamConnected ? "emerald" : "slate"}>
                {streamConnected ? "Live Updates On" : "Directory View"}
              </UiBadge>
            </div>

            {directoryDrivers.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                No verified medical transport units listed in this region yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {directoryDrivers.map((drv) => {
                  const liveMarker = drivers.find((d) => d.driverId === drv.id);
                  const currentStatus =
                    liveMarker?.status ?? drv.liveStatus ?? "AVAILABLE";
                  const vehicleKindLabel =
                    drv.vehicleType === "AMBULANCE"
                      ? "Ambulance Unit"
                      : "Medical Shuttle";
                  return (
                    <li
                      key={drv.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <EntityMediaPair
                          primarySrc={
                            drv.avatarUrl ??
                            resolveDefaultAvatar(drv.fullName, "DRIVER")
                          }
                          primaryAlt={drv.fullName}
                          primaryLabel="Driver Profile"
                          secondarySrc={resolveVehiclePicture(drv.vehicleType)}
                          secondaryAlt={drv.vehicleLabel}
                          secondaryLabel={vehicleKindLabel}
                          title={drv.fullName}
                          subtitle={`${drv.vehicleLabel} · ${drv.facilityName ?? drv.countryCode}`}
                          badge={currentStatus}
                          specs={[
                            { label: "Vehicle Type", value: vehicleKindLabel },
                            { label: "Unit", value: drv.vehicleLabel },
                            { label: "Service Zone", value: drv.serviceZone },
                            {
                              label: "Home Base",
                              value: drv.facilityName ?? drv.countryCode,
                            },
                            { label: "Status", value: currentStatus },
                          ]}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <p className="truncate text-sm font-bold text-slate-900">
                              {drv.fullName}
                            </p>
                            <UiBadge
                              tone={
                                currentStatus === "AVAILABLE"
                                  ? "emerald"
                                  : currentStatus === "OFF_DUTY"
                                    ? "slate"
                                    : "amber"
                              }
                            >
                              {currentStatus}
                            </UiBadge>
                          </div>
                          <p className="truncate text-xs font-medium text-teal-900">
                            {drv.vehicleLabel} · {drv.serviceZone}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {drv.facilityName ?? drv.countryCode}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {currentUser?.role === "DRIVER" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-teal-800" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  {t("map.driverBeaconTitle")}
                </h2>
              </div>
              <form onSubmit={handleDriverPingSubmit} className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <UiInput
                    type="number"
                    step="any"
                    required
                    aria-label="Driver latitude"
                    value={driverLat}
                    onChange={(e) => setDriverLat(e.target.value)}
                    className="font-mono-tabular"
                  />
                  <UiInput
                    type="number"
                    step="any"
                    required
                    aria-label="Driver longitude"
                    value={driverLng}
                    onChange={(e) => setDriverLng(e.target.value)}
                    className="font-mono-tabular"
                  />
                </div>
                <UiSelect
                  aria-label="Driver availability status"
                  value={driverStatus}
                  onChange={(e) => setDriverStatus(e.target.value as DriverStatus)}
                >
                  <option value="AVAILABLE">Ready for Requests</option>
                  <option value="ASSIGNED">Assigned to Patient</option>
                  <option value="EN_ROUTE">On the Way</option>
                  <option value="OFF_DUTY">Off Duty</option>
                </UiSelect>
                <UiButton
                  type="submit"
                  disabled={busy}
                  className="w-full"
                >
                  Update Ambulance Location
                </UiButton>
              </form>
            </section>
          ) : null}

          {currentUser &&
          ["PATIENT", "CAREGIVER", "CLINIC_STAFF", "HOSPITAL_ADMIN", "OPS_ADMIN"].includes(
            currentUser.role,
          ) ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <Siren className="h-4 w-4 text-red-700" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Request Medical Transport
                </h2>
              </div>
              <form onSubmit={handleDispatchSubmit} className="mt-3 space-y-3">
                <p className="text-[11px] text-slate-500">
                  Tip: Click any hospital or clinic on the map to auto-fill pickup details.
                </p>
                <UiInput
                  type="text"
                  required
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Pickup street address"
                  aria-label="Pickup address"
                />
                <div className="grid grid-cols-2 gap-3">
                  <UiInput
                    type="number"
                    step="any"
                    required
                    aria-label="Pickup latitude"
                    value={pickupLat}
                    onChange={(e) => setPickupLat(e.target.value)}
                    className="font-mono-tabular"
                  />
                  <UiInput
                    type="number"
                    step="any"
                    required
                    aria-label="Pickup longitude"
                    value={pickupLng}
                    onChange={(e) => setPickupLng(e.target.value)}
                    className="font-mono-tabular"
                  />
                </div>
                <UiSelect
                  aria-label="Dispatch urgency"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as DispatchUrgency)}
                >
                  <option value="ROUTINE">Standard Medical Transfer</option>
                  <option value="URGENT">Urgent Care Pickup</option>
                  <option value="EMERGENCY">Emergency Dispatch</option>
                </UiSelect>
                <UiButton
                  type="submit"
                  variant="danger"
                  disabled={busy}
                  className="w-full"
                >
                  Request Medical Pickup
                </UiButton>
              </form>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-base font-semibold text-slate-900">
              Active Transport Requests ({dispatches.length})
            </h2>
            {dispatches.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                No active medical transport requests right now.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {dispatches.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${
                          item.urgency === "EMERGENCY"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {formatUrgencyLabel(item.urgency)}
                      </span>
                      <span className="font-semibold text-teal-800">
                        {formatDispatchStatus(item.status)}
                      </span>
                    </div>
                    <p className="mt-1.5 font-medium text-slate-900">
                      {item.pickupAddress}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {currentUser?.role === "DRIVER" &&
                      item.status === "REQUESTED" ? (
                        <button
                          type="button"
                          onClick={() => void handleTransition(item.id, "ASSIGNED")}
                          className="rounded-md bg-teal-800 px-2.5 py-1 font-semibold text-white hover:bg-teal-900"
                        >
                          Claim Dispatch
                        </button>
                      ) : null}
                      {currentUser?.role === "DRIVER" &&
                      item.driverUserId === currentUser.id &&
                      item.status === "ASSIGNED" ? (
                        <button
                          type="button"
                          onClick={() => void handleTransition(item.id, "EN_ROUTE")}
                          className="rounded-md bg-slate-900 px-2.5 py-1 font-semibold text-white"
                        >
                          Start En Route
                        </button>
                      ) : null}
                      {currentUser?.role === "DRIVER" &&
                      item.driverUserId === currentUser.id &&
                      item.status === "EN_ROUTE" ? (
                        <button
                          type="button"
                          onClick={() => void handleTransition(item.id, "ARRIVED")}
                          className="rounded-md bg-emerald-700 px-2.5 py-1 font-semibold text-white"
                        >
                          Mark Arrived
                        </button>
                      ) : null}
                      {currentUser?.role === "DRIVER" &&
                      item.driverUserId === currentUser.id &&
                      item.status === "ARRIVED" ? (
                        <button
                          type="button"
                          onClick={() => void handleTransition(item.id, "COMPLETED")}
                          className="rounded-md bg-emerald-800 px-2.5 py-1 font-semibold text-white"
                        >
                          Complete
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
