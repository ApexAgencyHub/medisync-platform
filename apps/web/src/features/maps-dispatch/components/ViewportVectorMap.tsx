"use client";

import type {
  FacilityKind,
  LiveDriverMarker,
  ViewportFacilityItem,
} from "@medisync/contracts";
import {
  Activity,
  Ambulance,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Building2,
  FlaskConical,
  Minus,
  Pill,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { projectPoint, type ViewportBox } from "../presets";

interface ViewportVectorMapProps {
  countryCode: string;
  viewport: ViewportBox;
  facilities: readonly ViewportFacilityItem[];
  drivers: readonly LiveDriverMarker[];
  selectedFacilityId: string | null;
  postgisQueryMs: number | null;
  redisQueryMs: number | null;
  busy: boolean;
  onSelectFacility: (facilityId: string) => void;
  onZoom: (factor: number) => void;
  onPan: (dLat: number, dLng: number) => void;
  onReset: () => void;
  onSearchViewport: () => void;
}

const KIND_BADGE: Record<
  FacilityKind,
  { label: string; bg: string; icon: typeof Building2 }
> = {
  HOSPITAL: {
    label: "HOSP",
    bg: "border-red-700 bg-red-700 text-white",
    icon: Activity,
  },
  CLINIC: {
    label: "CLIN",
    bg: "border-teal-800 bg-teal-800 text-white",
    icon: Building2,
  },
  PHARMACY: {
    label: "PHRM",
    bg: "border-emerald-700 bg-emerald-700 text-white",
    icon: Pill,
  },
  DIAGNOSTIC_LAB: {
    label: "LAB",
    bg: "border-slate-800 bg-slate-800 text-white",
    icon: FlaskConical,
  },
};

export function ViewportVectorMap({
  countryCode,
  viewport,
  facilities,
  drivers,
  selectedFacilityId,
  postgisQueryMs,
  redisQueryMs,
  busy,
  onSelectFacility,
  onZoom,
  onPan,
  onReset,
  onSearchViewport,
}: ViewportVectorMapProps) {
  return (
    <div className="space-y-3">
      {/* Coordinates & Latency Readout Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
        <div className="min-w-0 break-words">
          <span className="font-semibold text-slate-900">
            {viewport.districtLabel}
          </span>
          <span className="block font-mono-tabular text-slate-600 sm:ml-2 sm:inline">
            [{countryCode}] {viewport.minLat.toFixed(3)},{viewport.minLng.toFixed(3)} →{" "}
            {viewport.maxLat.toFixed(3)},{viewport.maxLng.toFixed(3)}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono-tabular">
          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-slate-700">
            PostGIS: {postgisQueryMs !== null ? `${postgisQueryMs}ms` : "Ready"}
          </span>
          <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-teal-900">
            Redis Geo: {redisQueryMs !== null ? `${redisQueryMs}ms` : "Standby"}
          </span>
        </div>
      </div>

        {/* Interactive WGS84 Topographic Street & Water Vector Canvas */}
      <div className="relative h-80 w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#f1f5f4] sm:h-96">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <defs>
            <pattern
              id="medisync-geo-grid"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="0.7"
              />
              <rect
                x="6"
                y="6"
                width="16"
                height="14"
                rx="2"
                fill="#e2e8f0"
                fillOpacity="0.45"
              />
              <rect
                x="26"
                y="24"
                width="16"
                height="16"
                rx="2"
                fill="#e2e8f0"
                fillOpacity="0.45"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#medisync-geo-grid)" />
          {/* Topographic green zones & river/coastline contours */}
          <path
            d={
              countryCode === "MA"
                ? "M -10 110 Q 180 55 420 75 T 880 35 L 880 0 L -10 0 Z"
                : countryCode === "FR"
                  ? "M -10 210 Q 220 140 460 195 T 900 165"
                  : countryCode === "US"
                    ? "M 50 -10 Q 25 180 65 400"
                    : "M 520 -10 Q 600 120 740 160 T 920 240 L 920 -10 Z"
            }
            fill={countryCode === "FR" || countryCode === "US" ? "none" : "#bae6fd"}
            fillOpacity={countryCode === "FR" || countryCode === "US" ? undefined : "0.35"}
            stroke="#38bdf8"
            strokeOpacity="0.55"
            strokeWidth={countryCode === "FR" || countryCode === "US" ? "18" : "2"}
          />
          {/* Arterial avenues */}
          <path
            d="M 0 180 L 900 95 M 160 0 L 540 420 M 440 0 L 290 420"
            fill="none"
            stroke="#ffffff"
            strokeWidth="5"
            strokeOpacity="0.85"
          />
          <line
            x1="50%"
            y1="0"
            x2="50%"
            y2="100%"
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1="50%"
            x2="100%"
            y2="50%"
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
        </svg>

        {/* Pan & Zoom Map Controls */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-xs backdrop-blur-xs">
          <button
            type="button"
            aria-label="Zoom in viewport"
            onClick={() => onZoom(0.65)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:scale-95"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Zoom out viewport"
            onClick={() => onZoom(1.5)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:scale-95"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Reset region bounds"
            onClick={onReset}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Directional Pan Pad */}
        <div className="absolute bottom-3 right-3 z-20 grid grid-cols-3 gap-0.5 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-xs backdrop-blur-xs">
          <span />
          <button
            type="button"
            aria-label="Pan north"
            onClick={() => onPan(0.2, 0)}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-700 hover:bg-slate-100"
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span />
          <button
            type="button"
            aria-label="Pan west"
            onClick={() => onPan(0, -0.2)}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-700 hover:bg-slate-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="flex h-7 w-7 items-center justify-center font-mono-tabular text-[10px] font-bold text-slate-400">
            WGS
          </span>
          <button
            type="button"
            aria-label="Pan east"
            onClick={() => onPan(0, 0.2)}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-700 hover:bg-slate-100"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span />
          <button
            type="button"
            aria-label="Pan south"
            onClick={() => onPan(-0.2, 0)}
            className="flex h-7 w-7 items-center justify-center rounded text-slate-700 hover:bg-slate-100"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span />
        </div>

        {/* Search Viewport Button */}
        <div className="absolute top-3 left-3 z-20">
          <button
            type="button"
            disabled={busy}
            onClick={onSearchViewport}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-teal-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-teal-900 active:scale-[0.98] disabled:opacity-60"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{busy ? "Querying PostGIS..." : "Query PostGIS Viewport"}</span>
          </button>
        </div>

        {/* Facility Pins from PostGIS */}
        {facilities.map((facility) => {
          const pos = projectPoint(facility.lat, facility.lng, viewport);
          const cfg = KIND_BADGE[facility.kind];
          const Icon = cfg.icon;
          const isSelected = facility.id === selectedFacilityId;
          return (
            <button
              key={facility.id}
              type="button"
              onClick={() => onSelectFacility(facility.id)}
              aria-label={`${facility.name} (${facility.kind})`}
              style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%` }}
              className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold shadow-sm transition-transform hover:scale-105 ${
                cfg.bg
              } ${isSelected ? "ring-2 ring-slate-900 ring-offset-2" : ""}`}
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="max-w-[96px] truncate">{facility.name}</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  facility.openStatus === "OPEN"
                    ? "bg-emerald-300"
                    : facility.openStatus === "BUSY"
                      ? "bg-amber-300"
                      : "bg-red-300"
                }`}
              />
            </button>
          );
        })}

        {/* Live Ambulance / Driver Pins from Redis Geo + SSE */}
        {drivers.map((driver) => {
          const pos = projectPoint(driver.lat, driver.lng, viewport);
          return (
            <div
              key={driver.driverId}
              style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%` }}
              title={`Driver ${driver.driverId.slice(0, 8)} (${driver.status})`}
              className={`absolute z-15 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg border px-2 py-1 font-mono-tabular text-[10px] font-bold shadow-sm ${
                driver.status === "EN_ROUTE"
                  ? "border-red-700 bg-red-50 text-red-900"
                  : "border-teal-800 bg-white text-teal-900"
              }`}
            >
              <Ambulance className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
              <span>{driver.status}</span>
            </div>
          );
        })}

        {facilities.length === 0 && drivers.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="max-w-sm rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-xs leading-relaxed text-slate-600 shadow-xs backdrop-blur-xs">
              Click <strong>Query PostGIS Viewport</strong> to fetch verified clinics, hospitals,
              pharmacies, and diagnostic labs inside these bounds without loading full tables.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
