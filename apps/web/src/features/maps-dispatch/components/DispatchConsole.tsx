"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  DispatchStreamEventSchema,
  FacilityKindSchema,
  LoginSchema,
  type AuthenticatedUser,
  type CountryPack,
  type DispatchRequestSummary,
  type DispatchUrgency,
  type DriverStatus,
  type FacilityKind,
  type LiveDriverMarker,
  type ViewportFacilityItem,
} from "@medisync/contracts";
import { loginUser } from "@/features/auth-portal";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "@/shared/auth/session-storage";
import {
  CheckCircle2,
  KeyRound,
  LogOut,
  Navigation,
  Radio,
  ShieldAlert,
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
  const defaultCode = packs[0]?.code ?? "INTL";
  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCode);
  const [viewport, setViewport] = useState<ViewportBox>(() =>
    getPresetForCountry(defaultCode),
  );
  const [sectorFilter, setSectorFilter] = useState<FacilityKind | "ALL">("ALL");
  const [openNowOnly, setOpenNowOnly] = useState(false);

  const [facilities, setFacilities] = useState<ViewportFacilityItem[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(
    null,
  );
  const [postgisQueryMs, setPostgisQueryMs] = useState<number | null>(null);

  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(
    null,
  );
  const [drivers, setDrivers] = useState<LiveDriverMarker[]>([]);
  const [redisQueryMs, setRedisQueryMs] = useState<number | null>(null);
  const [dispatches, setDispatches] = useState<DispatchRequestSummary[]>([]);
  const [streamConnected, setStreamConnected] = useState(false);

  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{
    tone: "info" | "success" | "error";
    text: string;
  } | null>(null);

  // Quick Login Form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

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
    if (stored) {
      setSessionToken(stored.token);
      setCurrentUser(stored.user);
      setSelectedCountry(stored.user.countryCode);
      setViewport(getPresetForCountry(stored.user.countryCode));
    }
  }, []);

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
      text: `Loaded ${vpRes.data.facilities.length} verified facility pin(s) inside PostGIS bounding box (${vpRes.data.queryMs}ms).`,
    });
  }

  async function handleQuickSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = LoginSchema.safeParse({
      email: loginEmail,
      password: loginPassword,
    });
    if (!parsed.success) {
      setBanner({
        tone: "error",
        text: "Enter valid email and password credentials.",
      });
      return;
    }

    setBusy(true);
    setBanner(null);
    const res = await loginUser(apiBaseUrl, parsed.data);
    if (!res.ok) {
      setBusy(false);
      setBanner({
        tone: "error",
        text:
          res.error === "API_UNREACHABLE"
            ? `API unreachable at ${apiBaseUrl}.`
            : `Sign-in failed (${res.error}).`,
      });
      return;
    }

    writeStoredSession(res.data);
    const token = res.data.token;
    const user = res.data.user;
    setSessionToken(token);
    setCurrentUser(user);
    handleCountrySelect(user.countryCode);

    const [dispatchRes, nearbyRes] = await Promise.all([
      listDispatchRequests(apiBaseUrl, token, user.countryCode),
      queryNearbyDrivers(apiBaseUrl, token, {
        countryCode: user.countryCode,
        ...getViewportCenter(getPresetForCountry(user.countryCode)),
        radiusKm: 30,
      }),
    ]);

    if (dispatchRes.ok) setDispatches(dispatchRes.data.dispatches);
    if (nearbyRes.ok) {
      setDrivers(nearbyRes.data.drivers);
      setRedisQueryMs(nearbyRes.data.queryMs);
    }

    setBusy(false);
    setBanner({
      tone: "success",
      text: `Signed in as ${user.fullName} (${user.role} · ${user.countryCode}). Connecting Redis Pub/Sub SSE stream.`,
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
      text: `Redis Geo updated for ${res.data.driver.status} (${res.data.driver.lat.toFixed(4)}, ${res.data.driver.lng.toFixed(4)}).`,
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
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-teal-800">
              PostGIS Spatial Discovery · Redis Geo Telemetry · SSE Broadcast
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Live Medical Map & Dispatch Console
            </h1>
            {activePack ? (
              <p className="mt-1 text-sm text-slate-600">
                CountryPack <strong className="text-slate-900">{activePack.name}</strong> ·
                Emergency Dispatch{" "}
                <span className="font-mono-tabular font-semibold text-red-700">
                  {activePack.emergencyHotlines.ambulance}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Map CountryPack selector">
            {packs.map((pack) => {
              const selected = pack.code === selectedCountry;
              return (
                <button
                  key={pack.code}
                  type="button"
                  onClick={() => handleCountrySelect(pack.code)}
                  className={`min-h-[40px] rounded-lg border px-3 py-1.5 font-mono-tabular text-xs font-semibold transition-colors ${
                    selected
                      ? "border-teal-800 bg-teal-800 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-700 hover:text-teal-800"
                  }`}
                >
                  {pack.code}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
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

          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={openNowOnly}
              onChange={(e) => setOpenNowOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-800"
            />
            <span>Open Now Only</span>
          </label>
        </div>
      </section>

      {banner ? (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium ${
            banner.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : banner.tone === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-slate-200 bg-white text-slate-800"
          }`}
        >
          {banner.tone === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
          ) : (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          )}
          <span>{banner.text}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Interactive PostGIS Map + Facility Results */}
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
          />

          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
              Viewport Facility Results ({facilities.length})
            </h2>
            {facilities.length === 0 ? (
              <p className="text-sm text-slate-500">
                Run a viewport query to inspect verified medical centers inside the current envelope.
              </p>
            ) : (
              <ul className="space-y-2">
                {facilities.map((fac) => (
                  <li
                    key={fac.id}
                    className={`rounded-xl border p-3 text-sm transition-colors ${
                      fac.id === selectedFacilityId
                        ? "border-teal-700 bg-teal-50/40"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{fac.name}</p>
                        <p className="font-mono-tabular text-xs text-slate-600">
                          {fac.kind} · {fac.licenseNumber}
                          {fac.distanceMeters !== null
                            ? ` · ${(fac.distanceMeters / 1000).toFixed(2)} km`
                            : ""}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono-tabular text-[11px] font-semibold text-slate-800">
                        {fac.openStatus}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{fac.address}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Right: Authentication, SSE Status, Telemetry & Dispatch Controls */}
        <aside className="min-w-0 space-y-4 lg:col-span-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radio
                  className={`h-4 w-4 ${
                    streamConnected ? "text-emerald-600" : "text-slate-400"
                  }`}
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold text-slate-900">
                  {currentUser ? currentUser.fullName : "Live Dispatch Stream"}
                </h2>
              </div>

              <span
                className={`rounded-full px-2.5 py-0.5 font-mono-tabular text-[11px] font-semibold ${
                  streamConnected
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {streamConnected ? "SSE Connected" : "Offline Preview"}
              </span>
            </div>

            {currentUser ? (
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <span className="font-mono-tabular font-semibold text-teal-800">
                  {currentUser.role} · {currentUser.countryCode}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearStoredSession();
                    setSessionToken(null);
                    setCurrentUser(null);
                    setDrivers([]);
                    setDispatches([]);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleQuickSignIn} className="mt-3 space-y-3">
                <p className="text-xs text-slate-600">
                  Sign in below to stream Redis Geo ambulances over SSE and create or accept
                  dispatch requests, or{" "}
                  <Link href="/portal" className="font-semibold text-teal-800 underline">
                    register on the Clinical Portal
                  </Link>
                  .
                </p>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Account email"
                  aria-label="Dispatch sign-in email"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Password"
                  aria-label="Dispatch sign-in password"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Connect Authenticated Stream</span>
                </button>
              </form>
            )}
          </section>

          {currentUser?.role === "DRIVER" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-teal-800" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Driver GPS Beacon (Redis Geo)
                </h2>
              </div>
              <form onSubmit={handleDriverPingSubmit} className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="any"
                    required
                    aria-label="Driver latitude"
                    value={driverLat}
                    onChange={(e) => setDriverLat(e.target.value)}
                    className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-tabular text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    required
                    aria-label="Driver longitude"
                    value={driverLng}
                    onChange={(e) => setDriverLng(e.target.value)}
                    className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-tabular text-sm"
                  />
                </div>
                <select
                  aria-label="Driver availability status"
                  value={driverStatus}
                  onChange={(e) => setDriverStatus(e.target.value as DriverStatus)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="EN_ROUTE">EN_ROUTE</option>
                  <option value="OFF_DUTY">OFF_DUTY</option>
                </select>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[42px] w-full rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900"
                >
                  Transmit Live GPS Ping
                </button>
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
                <input
                  type="text"
                  required
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Pickup street address"
                  aria-label="Pickup address"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="any"
                    required
                    aria-label="Pickup latitude"
                    value={pickupLat}
                    onChange={(e) => setPickupLat(e.target.value)}
                    className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-tabular text-sm"
                  />
                  <input
                    type="number"
                    step="any"
                    required
                    aria-label="Pickup longitude"
                    value={pickupLng}
                    onChange={(e) => setPickupLng(e.target.value)}
                    className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono-tabular text-sm"
                  />
                </div>
                <select
                  aria-label="Dispatch urgency"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as DispatchUrgency)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="ROUTINE">ROUTINE</option>
                  <option value="URGENT">URGENT</option>
                  <option value="EMERGENCY">EMERGENCY</option>
                </select>
                <button
                  type="submit"
                  disabled={busy}
                  className="min-h-[42px] w-full rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
                >
                  Broadcast Dispatch Request
                </button>
              </form>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-base font-semibold text-slate-900">
              Scoped Dispatch Queue ({dispatches.length})
            </h2>
            {dispatches.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                No active dispatches loaded for your role and jurisdiction scope.
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
                        className={`rounded-full px-2 py-0.5 font-mono-tabular font-semibold ${
                          item.urgency === "EMERGENCY"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {item.urgency}
                      </span>
                      <span className="font-mono-tabular font-semibold text-teal-800">
                        {item.status}
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
