"use client";

import type { FormEvent } from "react";
import type {
  DirectoryDriverSummary,
  DispatchRequestSummary,
  LiveDriverMarker,
  ViewportFacilityItem,
} from "@medisync/contracts";
import {
  Ambulance,
  Building2,
  LocateFixed,
  RefreshCw,
  X,
} from "lucide-react";
import { formatDispatchStatus, formatUrgencyLabel } from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { UiBadge } from "@/shared/ui/primitives";
import { MAPS_COPY } from "../maps-i18n";
import { useRoadRoute } from "./useRoadRoute";

export interface AutoDetectedPickupState {
  lat: number;
  lng: number;
  label: string;
  source: "GPS" | "PIN" | "AREA";
  detecting: boolean;
}

interface PatientDispatchHudProps {
  trackedDispatch: DispatchRequestSummary | null;
  assignedDriverMarker: LiveDriverMarker | null;
  assignedDriverDir: DirectoryDriverSummary | null;
  destinationFacility: ViewportFacilityItem | null;
  autoPickup: AutoDetectedPickupState;
  selectedFastBookFacility: ViewportFacilityItem | null;
  autoClosestFacility: { facility: ViewportFacilityItem; distanceKm: number } | null;
  fastBookOpen: boolean;
  busy: boolean;
  detailsDrawerOpen?: boolean;
  onOpenFastBook: () => void;
  onCloseFastBook: () => void;
  onRedetectPickup: () => void;
  onClearSelectedFacility: () => void;
  onSubmitFastBook: (event: FormEvent<HTMLFormElement>) => void;
  onCancelDispatch: (dispatchId: string) => void;
}

/**
 * Patient Dispatch HUD for /map (localized EN/FR/AR + RTL-aware positioning).
 */
export function PatientDispatchHud({
  trackedDispatch,
  assignedDriverMarker,
  assignedDriverDir,
  destinationFacility,
  autoPickup,
  selectedFastBookFacility,
  autoClosestFacility,
  fastBookOpen,
  busy,
  detailsDrawerOpen = false,
  onOpenFastBook,
  onCloseFastBook,
  onRedetectPickup,
  onClearSelectedFacility,
  onSubmitFastBook,
  onCancelDispatch,
}: PatientDispatchHudProps) {
  const { locale, isRtl } = useLocale();
  const copy = MAPS_COPY[locale];

  const driverLegRoute = useRoadRoute(
    trackedDispatch && assignedDriverMarker ? assignedDriverMarker.lat : null,
    trackedDispatch && assignedDriverMarker ? assignedDriverMarker.lng : null,
    trackedDispatch ? trackedDispatch.pickupLat : null,
    trackedDispatch ? trackedDispatch.pickupLng : null,
  );
  const destinationLegRoute = useRoadRoute(
    trackedDispatch && destinationFacility ? trackedDispatch.pickupLat : null,
    trackedDispatch && destinationFacility ? trackedDispatch.pickupLng : null,
    trackedDispatch && destinationFacility ? destinationFacility.lat : null,
    trackedDispatch && destinationFacility ? destinationFacility.lng : null,
  );

  if (!trackedDispatch && !fastBookOpen) {
    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        className={`pointer-events-auto absolute z-30 transition-all ${
          detailsDrawerOpen
            ? "max-sm:hidden sm:bottom-3.5 sm:start-[404px]"
            : "bottom-3 start-2.5 sm:bottom-11 sm:start-3"
        }`}
      >
        <button
          type="button"
          onClick={onOpenFastBook}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white shadow-[0_10px_28px_rgba(225,29,72,0.28)] ring-1 ring-rose-700 transition hover:bg-rose-700 active:scale-[0.98]"
        >
          <Ambulance className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{copy.fastBookPill}</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      dir={isRtl ? "rtl" : "ltr"}
      className={`pointer-events-auto absolute z-30 w-[min(360px,calc(100vw-1.5rem))] space-y-2 transition-all ${
        detailsDrawerOpen
          ? "bottom-3 start-2.5 sm:bottom-3.5 sm:start-[404px]"
          : "bottom-3 start-2.5 sm:bottom-11 sm:start-3"
      }`}
    >
      {trackedDispatch ? (
        <section
          aria-label={copy.liveRideTrackerAria}
          className="space-y-2.5 rounded-2xl bg-white/95 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.14)] ring-1 ring-emerald-700/25 backdrop-blur-2xl"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
                <Ambulance className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-rose-700">
                  {copy.liveRideTrackerPrefix} ·{" "}
                  {formatUrgencyLabel(trackedDispatch.urgency, locale)}
                </p>
                <p className="truncate text-xs font-bold text-slate-950">
                  {trackedDispatch.pickupAddress}
                </p>
              </div>
            </div>
            <UiBadge tone="emerald">
              {formatDispatchStatus(trackedDispatch.status, locale)}
            </UiBadge>
          </div>

          <div className="space-y-1.5 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] p-3 text-xs">
            {assignedDriverDir || assignedDriverMarker ? (
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-bold text-slate-900">
                  {assignedDriverDir
                    ? `${assignedDriverDir.fullName} · ${assignedDriverDir.vehicleLabel}`
                    : `${copy.unitLabel} ${trackedDispatch.driverUserId?.slice(0, 6).toUpperCase()}`}
                </span>
                {assignedDriverMarker ? (
                  <span
                    dir={isRtl ? "rtl" : "ltr"}
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-mono-tabular font-bold text-[#0066CC]"
                  >
                    {driverLegRoute && driverLegRoute.distanceMeters > 0 ? (
                      <>
                        <span className="inline-flex items-baseline gap-0.5">
                          <bdi dir="ltr">
                            {Math.max(1, Math.round(driverLegRoute.durationSeconds / 60))}
                          </bdi>
                          <span>{copy.minutesShort}</span>
                        </span>
                        <span aria-hidden="true">·</span>
                      </>
                    ) : null}
                    <span className="inline-flex items-baseline gap-0.5">
                      <bdi dir="ltr">{assignedDriverMarker.distanceKm.toFixed(1)}</bdi>
                      <span>{copy.kmAwaySuffix}</span>
                    </span>
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="text-amber-800">{copy.broadcastingPickup}</p>
            )}

            <p className="flex items-center justify-between gap-2 text-[11px] text-slate-700">
              <span className="flex min-w-0 items-center gap-1.5">
                <Building2
                  className="h-3.5 w-3.5 shrink-0 text-[#0066CC]"
                  aria-hidden="true"
                />
                <span className="truncate">
                  {copy.destinationLabel}{" "}
                  <strong className="text-slate-900">
                    {destinationFacility?.name ?? copy.nearestHospitalFallback}
                  </strong>
                </span>
              </span>
              {destinationLegRoute && destinationLegRoute.distanceMeters > 0 ? (
                <span
                  dir={isRtl ? "rtl" : "ltr"}
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-mono-tabular font-bold text-emerald-800"
                >
                  <span className="inline-flex items-baseline gap-0.5">
                    <bdi dir="ltr">
                      {Math.max(1, Math.round(destinationLegRoute.durationSeconds / 60))}
                    </bdi>
                    <span>{copy.minutesShort}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-baseline gap-0.5">
                    <bdi dir="ltr">
                      {(destinationLegRoute.distanceMeters / 1000).toFixed(1)}
                    </bdi>
                    <span>{copy.kmShort}</span>
                  </span>
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onCancelDispatch(trackedDispatch.id)}
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copy.cancelRequestBtn}</span>
            </button>
            {!fastBookOpen ? (
              <button
                type="button"
                onClick={onOpenFastBook}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-rose-600 px-3 text-[11px] font-bold text-white shadow-xs transition hover:bg-rose-700"
              >
                <Ambulance className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.newFastBookBtn}</span>
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {fastBookOpen ? (
        <section className="rounded-2xl border border-[#D7E4F2] bg-white/96 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white shadow-xs">
                <Ambulance className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span>{copy.fastBookPill}</span>
            </h2>
            <button
              type="button"
              aria-label={copy.closeFastBookAria}
              onClick={onCloseFastBook}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={onSubmitFastBook} className="space-y-2 text-xs">
            <div
              aria-label={copy.autoPickupAria}
              className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50/90 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <LocateFixed
                  className="h-4 w-4 shrink-0 text-[#0066CC]"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    {autoPickup.source === "GPS"
                      ? copy.pickupGpsDetected
                      : autoPickup.source === "PIN"
                        ? copy.pickupPinSet
                        : copy.pickupAutoArea}
                  </p>
                  <p className="truncate font-semibold text-slate-900">
                    {autoPickup.label}{" "}
                    <span className="font-mono-tabular text-[10px] font-medium text-slate-500">
                      ({autoPickup.lat.toFixed(4)}, {autoPickup.lng.toFixed(4)})
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={copy.redetectPickupAria}
                onClick={onRedetectPickup}
                title={copy.redetectPickupTitle}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] text-[#0066CC]  transition hover:bg-emerald-100"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${autoPickup.detecting ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
              </button>
            </div>

            <div
              aria-label={copy.fastBookDestAria}
              className="flex items-center justify-between gap-2 rounded-xl bg-[#F3F8FD] border border-[#D7E4F2] px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Building2
                  className={`h-4 w-4 shrink-0 ${selectedFastBookFacility ? "text-[#0066CC]" : "text-slate-600"}`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {selectedFastBookFacility
                      ? copy.destFromMap
                      : copy.destAutoClosest}
                  </p>
                  <p className="truncate font-semibold text-slate-900">
                    {selectedFastBookFacility
                      ? selectedFastBookFacility.name
                      : autoClosestFacility
                        ? `${autoClosestFacility.facility.name} (~${autoClosestFacility.distanceKm.toFixed(1)} km)`
                        : copy.nearestOpenClinicHospital}
                  </p>
                  {!selectedFastBookFacility ? (
                    <p className="truncate text-[10px] text-slate-500">
                      {copy.tapMapIconHint}
                    </p>
                  ) : null}
                </div>
              </div>
              {selectedFastBookFacility ? (
                <button
                  type="button"
                  onClick={onClearSelectedFacility}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  {copy.autoClosestBtn}
                </button>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-rose-600 px-4 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 active:scale-[0.99] disabled:opacity-50"
            >
              <Ambulance className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{copy.fastBookNearestDriverBtn}</span>
            </button>
          </form>
        </section>
      ) : null}
    </aside>
  );
}
