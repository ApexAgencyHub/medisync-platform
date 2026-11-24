"use client";

import type { CSSProperties } from "react";
import type {
  DispatchRequestSummary,
  DriverStatus,
  ViewportFacilityItem,
} from "@medisync/contracts";
import { DRIVER_OFFER_WINDOW_SECONDS } from "@medisync/contracts";
import {
  Ambulance,
  Building2,
  Check,
  Clock,
  ExternalLink,
  Hospital,
  LocateFixed,
  Navigation,
  Power,
  Radio,
  X,
} from "lucide-react";
import {
  formatDispatchStatus,
  formatUrgencyLabel,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { UiBadge } from "@/shared/ui/primitives";
import { MAPS_COPY } from "../maps-i18n";
import {
  DriverJobTypeBadge,
  DriverMissionStepper,
  DriverQueueFilterBar,
  type DriverQueueFilter,
} from "./DriverDashboardPanels";
import { useRoadRoute } from "./useRoadRoute";

interface DriverDispatchHudProps {
  driverStatus: DriverStatus;
  dutyHydrated?: boolean;
  streamConnected: boolean;
  autoGpsActive: boolean;
  driverLat: number;
  driverLng: number;
  activeTrip: DispatchRequestSummary | null;
  pendingOffers: readonly DispatchRequestSummary[];
  totalPendingCount: number;
  pendingCounts?: {
    all: number;
    ems: number;
    courier: number;
  };
  focusedOffer: DispatchRequestSummary | null;
  destinationFacility: ViewportFacilityItem | null;
  resolveDestination: (
    dispatch: DispatchRequestSummary,
  ) => ViewportFacilityItem | null;
  getRemainingOfferMs: (dispatch: DispatchRequestSummary) => number;
  queueFilter: DriverQueueFilter;
  hasActiveSearchFilter?: boolean;
  busy: boolean;
  pendingDispatchIds: readonly string[];
  detailsDrawerOpen?: boolean;
  hudTopPaddingPx?: number;
  onFocusLiveOffer?: () => void;
  onQueueFilterChange: (next: DriverQueueFilter) => void;
  onClearSearchFilter?: () => void;
  onSelectOffer: (dispatchId: string) => void;
  onAcceptOffer: (dispatchId: string) => void;
  onRefuseOffer: (dispatchId: string) => void;
  onAdvanceTrip: (
    dispatchId: string,
    nextStatus: "EN_ROUTE" | "ARRIVED" | "COMPLETED",
  ) => void;
  onReleaseTrip: (dispatchId: string) => void;
  onToggleStatus: (nextStatus: DriverStatus) => void;
  onSyncGps: () => void;
  onToggleAutoGps: () => void;
}

function getCountdownTone(remainingSeconds: number): {
  bar: string;
  pill: string;
  text: string;
} {
  if (remainingSeconds <= 10) {
    return {
      bar: "bg-[#DC2626] animate-pulse",
      pill: "border-rose-300 bg-rose-50 text-[#B91C1C] animate-pulse",
      text: "text-[#B91C1C]",
    };
  }
  if (remainingSeconds <= 20) {
    return {
      bar: "bg-amber-500",
      pill: "border-amber-300 bg-amber-50 text-amber-900",
      text: "text-amber-800",
    };
  }
  return {
    bar: "bg-[#0F9D88]",
    pill: "border-[#B2E5DC] bg-[#E6F7F4] text-[#0B6B5C]",
    text: "text-[#0B6B5C]",
  };
}

function CountdownReadout({
  seconds,
  secondsShort,
  isRtl,
}: {
  seconds: number;
  secondsShort: string;
  isRtl: boolean;
}) {
  return (
    <span
      dir={isRtl ? "rtl" : "ltr"}
      className="inline-flex items-baseline gap-0.5 font-mono-tabular"
    >
      <bdi dir="ltr">{seconds}</bdi>
      <span>{secondsShort}</span>
    </span>
  );
}

/**
 * Compact Driver Dispatch HUD for /driver — mirrors PatientDispatchHud's airy floating
 * bottom-start footprint while adding a live 60-second accept/refuse offer countdown.
 */
export function DriverDispatchHud({
  driverStatus,
  dutyHydrated = true,
  streamConnected,
  autoGpsActive,
  driverLat,
  driverLng,
  activeTrip,
  pendingOffers,
  totalPendingCount,
  pendingCounts,
  focusedOffer,
  destinationFacility,
  resolveDestination,
  getRemainingOfferMs,
  queueFilter,
  hasActiveSearchFilter = false,
  busy,
  pendingDispatchIds,
  detailsDrawerOpen = false,
  hudTopPaddingPx = 64,
  onFocusLiveOffer,
  onQueueFilterChange,
  onClearSearchFilter,
  onSelectOffer,
  onAcceptOffer,
  onRefuseOffer,
  onAdvanceTrip,
  onReleaseTrip,
  onToggleStatus,
  onSyncGps,
  onToggleAutoGps,
}: DriverDispatchHudProps) {
  const { locale, isRtl } = useLocale();
  const copy = MAPS_COPY[locale];

  const primaryDispatch = activeTrip ?? focusedOffer;
  const pickupLegRoute = useRoadRoute(
    primaryDispatch && primaryDispatch.status !== "ARRIVED" ? driverLat : null,
    primaryDispatch && primaryDispatch.status !== "ARRIVED" ? driverLng : null,
    primaryDispatch && primaryDispatch.status !== "ARRIVED"
      ? primaryDispatch.pickupLat
      : null,
    primaryDispatch && primaryDispatch.status !== "ARRIVED"
      ? primaryDispatch.pickupLng
      : null,
  );
  const dropoffLegRoute = useRoadRoute(
    primaryDispatch && destinationFacility ? primaryDispatch.pickupLat : null,
    primaryDispatch && destinationFacility ? primaryDispatch.pickupLng : null,
    primaryDispatch && destinationFacility ? destinationFacility.lat : null,
    primaryDispatch && destinationFacility ? destinationFacility.lng : null,
  );

  const positionClass = detailsDrawerOpen
    ? "max-lg:hidden lg:bottom-3.5 lg:start-[404px]"
    : "bottom-3 start-2.5 sm:bottom-11 sm:start-3";

  // 1. Off Duty state — ultra-minimal floating pill
  if (driverStatus === "OFF_DUTY" && !activeTrip) {
    return (
      <aside
        dir={isRtl ? "rtl" : "ltr"}
        data-driver-hud="true"
        className={`pointer-events-auto absolute z-30 w-[min(368px,calc(100vw-1.5rem))] transition-all ${positionClass}`}
      >
        <section className="flex items-center justify-between gap-2.5 rounded-2xl border border-[#D7E4F2] bg-white/96 px-3.5 py-2.5 shadow-[0_14px_34px_rgba(15,36,62,0.14)] backdrop-blur-2xl">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Power className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[11px] font-bold tracking-tight text-[#0F243E]">
                {copy.driverWorkspaceTitle}
              </h1>
              <p className="truncate text-[11px] text-[#556E89]">
                {copy.offDutyPaused}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggleStatus("AVAILABLE")}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#0066CC] px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0052A3] active:scale-[0.98] disabled:opacity-50"
          >
            <Radio className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{copy.goOnlineBtn}</span>
          </button>
        </section>
      </aside>
    );
  }

  // 2. Active Accepted Mission — clean mirror of PatientDispatchHud Live Ride Tracker
  if (activeTrip) {
    const isItemPending = busy || pendingDispatchIds.includes(activeTrip.id);
    return (
      <aside
        dir={isRtl ? "rtl" : "ltr"}
        data-driver-hud="true"
        className={`pointer-events-auto absolute z-30 w-[min(372px,calc(100vw-1.5rem))] transition-all ${positionClass}`}
      >
        <section
          aria-label={copy.activeClientPickup}
          className="space-y-2.5 rounded-2xl bg-white/96 p-3.5 shadow-[0_18px_40px_rgba(15,23,42,0.15)] ring-1 ring-[#0066CC]/25 backdrop-blur-2xl"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white ${
                  activeTrip.urgency === "EMERGENCY"
                    ? "bg-[#DC2626]"
                    : "bg-[#0066CC]"
                }`}
              >
                <Ambulance className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-[10px] font-bold uppercase tracking-wider text-[#0066CC]">
                  {copy.driverWorkspaceTitle} ·{" "}
                  {formatUrgencyLabel(activeTrip.urgency, locale)}
                </h1>
                <p className="truncate text-xs font-bold text-slate-950">
                  <bdi dir="auto">{activeTrip.pickupAddress}</bdi>
                </p>
              </div>
            </div>
            <UiBadge tone="emerald" className="shrink-0">
              {formatDispatchStatus(activeTrip.status, locale)}
            </UiBadge>
          </div>

          <DriverMissionStepper dispatch={activeTrip} />

          <div className="space-y-1.5 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <DriverJobTypeBadge dispatch={activeTrip} />
              {pickupLegRoute && pickupLegRoute.distanceMeters > 0 ? (
                <span
                  dir={isRtl ? "rtl" : "ltr"}
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-mono-tabular text-[11px] font-bold text-[#0066CC]"
                >
                  <span className="inline-flex items-baseline gap-0.5">
                    <bdi dir="ltr">
                      {Math.max(1, Math.round(pickupLegRoute.durationSeconds / 60))}
                    </bdi>
                    <span>{copy.minutesShort}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-baseline gap-0.5">
                    <bdi dir="ltr">
                      {(pickupLegRoute.distanceMeters / 1000).toFixed(1)}
                    </bdi>
                    <span>{copy.kmShort}</span>
                  </span>
                </span>
              ) : null}
            </div>

            <p className="flex items-center justify-between gap-2 text-[11px] text-slate-700">
              <span className="flex min-w-0 items-center gap-1.5">
                <Building2
                  className="h-3.5 w-3.5 shrink-0 text-[#0066CC]"
                  aria-hidden="true"
                />
                <span className="truncate">
                  {copy.takeClientToLabel}{" "}
                  <strong className="text-slate-900">
                    {destinationFacility?.name ?? copy.nearestHospitalFallback}
                  </strong>
                </span>
              </span>
              {dropoffLegRoute && dropoffLegRoute.distanceMeters > 0 ? (
                <span
                  dir={isRtl ? "rtl" : "ltr"}
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-mono-tabular font-bold text-emerald-800"
                >
                  <span className="inline-flex items-baseline gap-0.5">
                    <bdi dir="ltr">
                      {Math.max(
                        1,
                        Math.round(dropoffLegRoute.durationSeconds / 60),
                      )}
                    </bdi>
                    <span>{copy.minutesShort}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-baseline gap-0.5">
                    <bdi dir="ltr">
                      {(dropoffLegRoute.distanceMeters / 1000).toFixed(1)}
                    </bdi>
                    <span>{copy.kmShort}</span>
                  </span>
                </span>
              ) : null}
            </p>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${activeTrip.pickupLat},${activeTrip.pickupLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#BFDBFE] bg-white px-2 text-[11px] font-bold text-[#0052A3] transition hover:bg-[#EBF4FF]"
              >
                <Navigation className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{copy.navigatePickupBtn}</span>
                <ExternalLink
                  className="h-2.5 w-2.5 shrink-0 opacity-70"
                  aria-hidden="true"
                />
              </a>
              {destinationFacility ? (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${destinationFacility.lat},${destinationFacility.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[#B2E5DC] bg-[#E6F7F4] px-2 text-[11px] font-bold text-[#0A6E5E] transition hover:bg-[#D1F2EB]"
                >
                  <Hospital className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{copy.navigateHospitalBtn}</span>
                  <ExternalLink
                    className="h-2.5 w-2.5 shrink-0 opacity-70"
                    aria-hidden="true"
                  />
                </a>
              ) : (
                <span className="inline-flex h-8 items-center justify-center rounded-lg border border-dashed border-[#CBDDF0] bg-white/70 px-2 text-[10.5px] font-semibold text-[#7D95B0]">
                  {copy.nearestHospitalFallback}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTrip.status === "ASSIGNED" ? (
              <>
                <button
                  type="button"
                  disabled={isItemPending}
                  onClick={() => onAdvanceTrip(activeTrip.id, "EN_ROUTE")}
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0066CC] px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0052A3] active:scale-[0.98] disabled:opacity-55"
                >
                  <span>{copy.startEnRouteBtn}</span>
                </button>
                <button
                  type="button"
                  disabled={isItemPending}
                  onClick={() => onReleaseTrip(activeTrip.id)}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] px-3 text-xs font-semibold text-slate-700 transition hover:bg-white active:scale-[0.98] disabled:opacity-55"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.releaseRideBtn}</span>
                </button>
              </>
            ) : activeTrip.status === "EN_ROUTE" ? (
              <button
                type="button"
                disabled={isItemPending}
                onClick={() => onAdvanceTrip(activeTrip.id, "ARRIVED")}
                className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#0066CC] px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0052A3] active:scale-[0.98] disabled:opacity-55"
              >
                <span>{copy.markArrivedBtn}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isItemPending}
                onClick={() => onAdvanceTrip(activeTrip.id, "COMPLETED")}
                className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#0F9D88] px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0A7D6B] active:scale-[0.98] disabled:opacity-55"
              >
                <span>{copy.completeDropoffBtn}</span>
              </button>
            )}
          </div>
        </section>
      </aside>
    );
  }

  // 3. Online & Live Incoming Demand(s) with 60-Second Countdown & Auto-Refuse
  if (focusedOffer) {
    const windowMs =
      (focusedOffer.offerWindowSeconds ?? DRIVER_OFFER_WINDOW_SECONDS) * 1000;
    const remainingMs = Math.max(0, getRemainingOfferMs(focusedOffer));
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const progressPct = Math.max(0, Math.min(100, (remainingMs / windowMs) * 100));
    const tone = getCountdownTone(remainingSeconds);
    const isItemPending = busy || pendingDispatchIds.includes(focusedOffer.id);
    const otherPending = pendingOffers.filter((d) => d.id !== focusedOffer.id);

    return (
      <>
        {detailsDrawerOpen && onFocusLiveOffer ? (
          <div
            dir={isRtl ? "rtl" : "ltr"}
            data-driver-live-alert="true"
            style={{ ["--hud-top" as string]: `${hudTopPaddingPx}px` } as CSSProperties}
            className="pointer-events-auto absolute top-[var(--hud-top)] start-2.5 end-14 z-40 sm:end-auto sm:w-[376px] lg:hidden"
          >
            <button
              type="button"
              onClick={onFocusLiveOffer}
              className="flex w-full items-center justify-between gap-2 rounded-2xl border border-[#0066CC]/35 bg-white/98 px-3 py-2 text-start shadow-[0_14px_34px_rgba(15,36,62,0.2)] backdrop-blur-xl transition active:scale-[0.99]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#DC2626]"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[10.5px] font-bold uppercase tracking-wider text-[#0066CC]">
                    {copy.liveOfferBadge}
                  </span>
                  <span className="block truncate text-xs font-bold text-[#0F243E]">
                    <bdi dir="auto">{focusedOffer.pickupAddress}</bdi>
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${tone.pill}`}
                >
                  <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <CountdownReadout
                    seconds={remainingSeconds}
                    secondsShort={copy.secondsShort}
                    isRtl={isRtl}
                  />
                </span>
                <span className="rounded-full bg-[#0066CC] px-2.5 py-1 text-[11px] font-bold text-white">
                  {copy.returnToOfferCta}
                </span>
              </span>
            </button>
          </div>
        ) : null}

        <aside
          dir={isRtl ? "rtl" : "ltr"}
          data-driver-hud="true"
          className={`pointer-events-auto absolute z-30 w-[min(376px,calc(100vw-1.5rem))] transition-all ${positionClass}`}
        >
          <section
            aria-label={copy.liveOfferBadge}
            className="flex max-h-[56dvh] flex-col overflow-hidden rounded-2xl border border-[#BFDBFE] bg-white/97 shadow-[0_18px_42px_-8px_rgba(15,36,62,0.2)] backdrop-blur-2xl sm:max-h-[72dvh]"
          >
            {/* 60-Second Live Countdown Progress Strip */}
            <div
              role="progressbar"
              aria-label={copy.autoRefusePrefix}
              aria-valuemin={0}
              aria-valuemax={
                focusedOffer.offerWindowSeconds ?? DRIVER_OFFER_WINDOW_SECONDS
              }
              aria-valuenow={remainingSeconds}
              className="h-1.5 w-full shrink-0 bg-slate-100"
            >
              <div
                className={`h-full transition-[width] duration-200 ease-linear ${tone.bar}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5 [scrollbar-width:thin]">
              {/* Compact Header: Workspace Title + Badges + Live 60s Timer Pill */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#DC2626]"
                    />
                    <h1 className="truncate text-[10.5px] font-bold uppercase tracking-wider text-[#0066CC]">
                      {copy.driverWorkspaceTitle}
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <UiBadge
                      tone={focusedOffer.urgency === "EMERGENCY" ? "red" : "amber"}
                    >
                      {formatUrgencyLabel(focusedOffer.urgency, locale)}
                    </UiBadge>
                    <DriverJobTypeBadge dispatch={focusedOffer} />
                  </div>
                </div>

                <span
                  data-offer-countdown="true"
                  data-dispatch-id={focusedOffer.id}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-extrabold ${tone.pill}`}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <CountdownReadout
                    seconds={remainingSeconds}
                    secondsShort={copy.secondsShort}
                    isRtl={isRtl}
                  />
                </span>
              </div>

              {/* Pickup & Destination Summary */}
              <div className="space-y-1.5 rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-bold text-[#0F243E]">
                    <bdi dir="auto">{focusedOffer.pickupAddress}</bdi>
                  </p>
                  {pickupLegRoute && pickupLegRoute.distanceMeters > 0 ? (
                    <span
                      dir={isRtl ? "rtl" : "ltr"}
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-mono-tabular text-[11px] font-bold text-[#0066CC]"
                    >
                      <span className="inline-flex items-baseline gap-0.5">
                        <bdi dir="ltr">
                          {Math.max(
                            1,
                            Math.round(pickupLegRoute.durationSeconds / 60),
                          )}
                        </bdi>
                        <span>{copy.minutesShort}</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-baseline gap-0.5">
                        <bdi dir="ltr">
                          {(pickupLegRoute.distanceMeters / 1000).toFixed(1)}
                        </bdi>
                        <span>{copy.kmShort}</span>
                      </span>
                    </span>
                  ) : null}
                </div>

                <p className="flex items-center justify-between gap-2 text-[11px] text-[#4A627D]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Building2
                      className="h-3.5 w-3.5 shrink-0 text-[#0066CC]"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {copy.takeClientToLabel}{" "}
                      <strong className="text-[#0F243E]">
                        {destinationFacility?.name ??
                          copy.nearestHospitalFallback}
                      </strong>
                    </span>
                  </span>
                  {dropoffLegRoute && dropoffLegRoute.distanceMeters > 0 ? (
                    <span
                      dir={isRtl ? "rtl" : "ltr"}
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-mono-tabular text-[10.5px] font-bold text-emerald-800"
                    >
                      <bdi dir="ltr">
                        {(dropoffLegRoute.distanceMeters / 1000).toFixed(1)}
                      </bdi>
                      <span>{copy.kmShort}</span>
                    </span>
                  ) : null}
                </p>

                {focusedOffer.notes ? (
                  <p className="line-clamp-1 text-[11px] text-[#556E89]">
                    <bdi dir="auto">{focusedOffer.notes}</bdi>
                  </p>
                ) : null}
              </div>

              {/* Primary Accept / Refuse Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isItemPending}
                  onClick={() => onAcceptOffer(focusedOffer.id)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0066CC] px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#0052A3] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    {isItemPending ? copy.acceptingBtn : copy.acceptClientBtn}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isItemPending}
                  onClick={() => onRefuseOffer(focusedOffer.id)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3.5 text-xs font-bold text-rose-800 transition hover:bg-rose-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <X className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{copy.refuseBtn}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 pt-1.5">
                <span
                  className={`inline-flex items-center gap-1 text-[10.5px] font-semibold ${tone.text}`}
                >
                  <span>{copy.autoRefusePrefix}</span>
                  <span className="font-bold">
                    <CountdownReadout
                      seconds={remainingSeconds}
                      secondsShort={copy.secondsShort}
                      isRtl={isRtl}
                    />
                  </span>
                </span>
                <DriverQueueFilterBar
                  value={queueFilter}
                  onChange={onQueueFilterChange}
                  {...(pendingCounts ? { counts: pendingCounts } : {})}
                />
              </div>

              {/* Compact 1-line Waiting Queue Strip (only when >1 simultaneous live demand) */}
              {otherPending.length > 0 ? (
                <div className="border-t border-slate-100 pt-2">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#6B829D]">
                    {copy.waitingDemandsLabel} ({otherPending.length})
                  </p>
                  <ul className="max-h-[110px] space-y-1 overflow-y-auto [scrollbar-width:thin]">
                    {otherPending.map((item) => {
                      const itemRemSec = Math.ceil(
                        Math.max(0, getRemainingOfferMs(item)) / 1000,
                      );
                      const itemTone = getCountdownTone(itemRemSec);
                      const itemPending =
                        busy || pendingDispatchIds.includes(item.id);
                      const targetFac = resolveDestination(item);
                      return (
                        <li
                          key={item.id}
                          onClick={() => onSelectOffer(item.id)}
                          className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#D7E4F2] bg-[#F8FBFE] px-2.5 py-1.5 text-[11px] transition hover:border-[#93C5FD] hover:bg-white"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-[#0F243E]">
                              <bdi dir="auto">{item.pickupAddress}</bdi>
                            </p>
                            {targetFac ? (
                              <p className="truncate text-[10px] text-[#6B829D]">
                                {isRtl ? "←" : "→"}{" "}
                                <bdi dir="auto">{targetFac.name}</bdi>
                              </p>
                            ) : null}
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${itemTone.pill}`}
                          >
                            <CountdownReadout
                              seconds={itemRemSec}
                              secondsShort={copy.secondsShort}
                              isRtl={isRtl}
                            />
                          </span>
                          <button
                            type="button"
                            disabled={itemPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRefuseOffer(item.id);
                            }}
                            className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[10.5px] font-bold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                            <span>{copy.refuseBtn}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </>
    );
  }

  // 4. Hydrating persisted duty status — neutral pill (prevents false green Online flash on OFF_DUTY reload)
  if (!dutyHydrated) {
    return (
      <aside
        dir={isRtl ? "rtl" : "ltr"}
        data-driver-hud="true"
        data-driver-duty-hydrating="true"
        className={`pointer-events-auto absolute z-30 w-[min(368px,calc(100vw-1.5rem))] transition-all ${positionClass}`}
      >
        <section className="flex items-center gap-2.5 rounded-2xl border border-[#D7E4F2] bg-white/96 px-3.5 py-2.5 shadow-[0_14px_34px_rgba(15,36,62,0.14)] backdrop-blur-2xl">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F3F8FD] text-[#556E89]">
            <Ambulance className="h-4 w-4 animate-pulse" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[11px] font-bold tracking-tight text-[#0F243E]">
              {copy.driverWorkspaceTitle}
            </h1>
            <p className="truncate text-[11px] font-medium text-[#556E89]">
              {copy.syncingDutyStatus}
            </p>
          </div>
        </section>
      </aside>
    );
  }

  // 5. Online & Idle (0 demands) — ultra-minimal floating status pill mirroring Patient's Fast Book pill
  return (
    <aside
      dir={isRtl ? "rtl" : "ltr"}
      data-driver-hud="true"
      className={`pointer-events-auto absolute z-30 w-[min(368px,calc(100vw-1.5rem))] transition-all ${positionClass}`}
    >
      <section className="space-y-2 rounded-2xl border border-[#D7E4F2] bg-white/96 px-3.5 py-2.5 shadow-[0_14px_34px_rgba(15,36,62,0.14)] backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#E6F7F4] text-[#0F9D88]">
              <Ambulance className="h-4 w-4" aria-hidden="true" />
              <span
                aria-hidden="true"
                className={`absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  streamConnected ? "bg-[#0F9D88] animate-pulse" : "bg-amber-400"
                }`}
              />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[11px] font-bold tracking-tight text-[#0F243E]">
                {copy.driverWorkspaceTitle}
              </h1>
              <p className="truncate text-[11px] font-medium text-[#0B6B5C]">
                {copy.onlineListening}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={onSyncGps}
              aria-label={copy.syncGpsAria}
              title={copy.syncGpsAria}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D7E4F2] bg-[#F3F8FD] text-[#0066CC] transition hover:border-[#0066CC] hover:bg-white disabled:opacity-50"
            >
              <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={busy}
              aria-pressed={autoGpsActive}
              aria-label={copy.autoGpsAria}
              title={copy.autoGpsAria}
              onClick={onToggleAutoGps}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-50 ${
                autoGpsActive
                  ? "border-[#0F9D88] bg-[#E6F7F4] text-[#0F9D88]"
                  : "border-[#D7E4F2] bg-[#F3F8FD] text-[#556E89] hover:border-[#0066CC] hover:text-[#0066CC]"
              }`}
            >
              <Radio
                className={`h-3.5 w-3.5 ${autoGpsActive ? "animate-pulse" : ""}`}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onToggleStatus("OFF_DUTY")}
              className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-[#D7E4F2] bg-[#F3F8FD] px-2.5 text-[11px] font-semibold text-[#4A627D] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
            >
              <Power className="h-3 w-3" aria-hidden="true" />
              <span>{copy.offDutyBtn}</span>
            </button>
          </div>
        </div>

        {totalPendingCount > 0 || queueFilter !== "ALL" ? (
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 pt-1">
            <DriverQueueFilterBar
              value={queueFilter}
              onChange={onQueueFilterChange}
              {...(pendingCounts ? { counts: pendingCounts } : {})}
            />
            {hasActiveSearchFilter && onClearSearchFilter ? (
              <button
                type="button"
                onClick={onClearSearchFilter}
                aria-label={copy.clearSearchAria}
                className="inline-flex h-6 items-center gap-1 rounded-full border border-[#BFDBFE] bg-[#EBF4FF] px-2 text-[10.5px] font-semibold text-[#0052A3] transition hover:bg-[#DBEAFE]"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                <span>{copy.resetBtn}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </aside>
  );
}
