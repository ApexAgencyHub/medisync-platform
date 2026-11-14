"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  LocateFixed,
  Minus,
  Pill,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  formatDriverStatus,
  formatFacilityKind,
  formatOpenStatus,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import {
  estimateZoomForViewport,
  getViewportCenter,
  latToWorldPx,
  lngToWorldPx,
  MAP_TILE_SIZE,
  panViewportByPixels,
  type ViewportBox,
} from "../presets";

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
  onViewportChange?: (next: ViewportBox) => void;
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
  onViewportChange,
}: ViewportVectorMapProps) {
  const { t } = useLocale();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 720,
    height: 384,
  });
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({
    dx: 0,
    dy: 0,
  });
  const dragSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width >= 200 && rect.height >= 200) {
        setSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const zoom = useMemo(
    () => estimateZoomForViewport(viewport, size.width),
    [viewport, size.width],
  );
  const center = useMemo(() => getViewportCenter(viewport), [viewport]);

  const originX = useMemo(
    () => lngToWorldPx(center.lng, zoom) - size.width / 2 - dragOffset.dx,
    [center.lng, zoom, size.width, dragOffset.dx],
  );
  const originY = useMemo(
    () => latToWorldPx(center.lat, zoom) - size.height / 2 - dragOffset.dy,
    [center.lat, zoom, size.height, dragOffset.dy],
  );

  const tiles = useMemo(() => {
    const worldTileCount = Math.pow(2, zoom);
    const startX = Math.floor(originX / MAP_TILE_SIZE);
    const endX = Math.floor((originX + size.width) / MAP_TILE_SIZE);
    const startY = Math.max(0, Math.floor(originY / MAP_TILE_SIZE));
    const endY = Math.min(
      worldTileCount - 1,
      Math.floor((originY + size.height) / MAP_TILE_SIZE),
    );

    const list: Array<{
      key: string;
      src: string;
      left: number;
      top: number;
    }> = [];

    for (let tx = startX; tx <= endX; tx += 1) {
      const wrappedX = ((tx % worldTileCount) + worldTileCount) % worldTileCount;
      for (let ty = startY; ty <= endY; ty += 1) {
        list.push({
          key: `${zoom}-${tx}-${ty}`,
          src: `/api/map-tiles/${zoom}/${wrappedX}/${ty}`,
          left: Math.round(tx * MAP_TILE_SIZE - originX),
          top: Math.round(ty * MAP_TILE_SIZE - originY),
        });
      }
    }
    return list;
  }, [zoom, originX, originY, size.width, size.height]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;

    dragSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore synthetic pointer events without capture target
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    setDragOffset({
      dx: event.clientX - session.startX,
      dy: event.clientY - session.startY,
    });
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    dragSessionRef.current = null;
    setDragOffset({ dx: 0, dy: 0 });

    if (Math.hypot(dx, dy) < 6) return;

    if (onViewportChange) {
      const shifted = panViewportByPixels(
        viewport,
        dx,
        dy,
        zoom,
        size.width,
        size.height,
      );
      onViewportChange(shifted);
    } else {
      onPan(dy / Math.max(120, size.height), -dx / Math.max(120, size.width));
    }
  }

  const facilitiesLabel = `${t("map.facilitiesFound")}: ${facilities.length}`;
  const unitTelemetryText = `${drivers.length} ${t("map.activeUnits")}`;
  // Preserve optional telemetry props without surfacing ms timings to patients
  void postgisQueryMs;
  void redisQueryMs;

  return (
    <div className="space-y-3">
      {/* District & Live Care Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs">
        <div className="flex min-w-0 items-center gap-2 break-words">
          <span className="font-semibold text-slate-900">
            <bdi dir="auto">{viewport.districtLabel}</bdi>
          </span>
          <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono-tabular text-[11px] font-semibold text-teal-800">
            {countryCode}
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono-tabular">
          <span
            dir="ltr"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-slate-700"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
            <span>{facilitiesLabel}</span>
          </span>
          <span
            dir="ltr"
            className="rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-teal-900"
          >
            {unitTelemetryText}
          </span>
        </div>
      </div>

      {/* Interactive Web Mercator Slippy Street Map Canvas (LTR coordinate plane) */}
      <div
        ref={containerRef}
        dir="ltr"
        role="region"
        aria-label={`Interactive street map of ${viewport.districtLabel}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        className="relative h-80 w-full cursor-grab overflow-hidden rounded-2xl border border-slate-200 bg-[#edf1ee] select-none active:cursor-grabbing sm:h-[26rem]"
      >
        {/* Slippy Street Map Tiles */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.src}
              alt=""
              width={MAP_TILE_SIZE}
              height={MAP_TILE_SIZE}
              draggable={false}
              className="absolute max-w-none select-none"
              style={{
                left: `${tile.left}px`,
                top: `${tile.top}px`,
                width: `${MAP_TILE_SIZE}px`,
                height: `${MAP_TILE_SIZE}px`,
              }}
            />
          ))}
        </div>

        {/* Pan & Zoom Controls */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-sm backdrop-blur-xs">
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
        <div className="absolute bottom-3 right-3 z-20 grid grid-cols-3 gap-0.5 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur-xs">
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
          <button
            type="button"
            aria-label="Center map on region"
            onClick={onReset}
            className="flex h-7 w-7 items-center justify-center rounded text-teal-800 hover:bg-teal-50"
          >
            <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
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

        {/* Search Area Button */}
        <div className="absolute top-3 left-3 z-20">
          <button
            type="button"
            disabled={busy}
            onClick={onSearchViewport}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-teal-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-teal-900 active:scale-[0.98] disabled:opacity-60"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{busy ? t("map.searching") : t("map.searchArea")}</span>
          </button>
        </div>

        {/* Verified Facility Pins Projected onto Street Coordinates */}
        {facilities.map((facility) => {
          const px = lngToWorldPx(facility.lng, zoom) - originX;
          const py = latToWorldPx(facility.lat, zoom) - originY;
          if (
            px < -40 ||
            px > size.width + 40 ||
            py < -40 ||
            py > size.height + 40
          ) {
            return null;
          }

          const cfg = KIND_BADGE[facility.kind];
          const Icon = cfg.icon;
          const isSelected = facility.id === selectedFacilityId;

          return (
            <button
              key={facility.id}
              type="button"
              onClick={() => onSelectFacility(facility.id)}
              aria-label={`${facility.name} (${formatFacilityKind(facility.kind)}, ${formatOpenStatus(facility.openStatus)})`}
              style={{ left: `${px}px`, top: `${py}px` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-md transition-transform hover:z-30 hover:scale-105 active:scale-95 ${
                cfg.bg
              } ${isSelected ? "z-25 scale-105 ring-2 ring-slate-900 ring-offset-2" : "z-10"}`}
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="max-w-[92px] truncate">{facility.name}</span>
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

        {/* Live Ambulance / Driver Markers */}
        {drivers.map((driver) => {
          const px = lngToWorldPx(driver.lng, zoom) - originX;
          const py = latToWorldPx(driver.lat, zoom) - originY;
          if (
            px < -40 ||
            px > size.width + 40 ||
            py < -40 ||
            py > size.height + 40
          ) {
            return null;
          }

          return (
            <div
              key={driver.driverId}
              style={{ left: `${px}px`, top: `${py}px` }}
              title={`Medical Unit (${formatDriverStatus(driver.status)})`}
              className={`absolute z-15 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold shadow-md ${
                driver.status === "EN_ROUTE"
                  ? "border-red-700 bg-red-50 text-red-900"
                  : "border-teal-800 bg-white text-teal-900"
              }`}
            >
              <Ambulance className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
              <span>{formatDriverStatus(driver.status)}</span>
            </div>
          );
        })}

        {facilities.length === 0 && drivers.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="max-w-sm rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-xs leading-relaxed text-slate-600 shadow-sm backdrop-blur-xs">
              {t("map.emptyOverlay")}
            </p>
          </div>
        ) : null}

        {/* Subtle Tile Attribution */}
        <div className="pointer-events-none absolute bottom-2 left-2.5 z-10 rounded-md bg-white/85 px-2 py-0.5 text-[10px] font-medium text-slate-600 shadow-xs">
          © OpenStreetMap · Esri
        </div>
      </div>
    </div>
  );
}
