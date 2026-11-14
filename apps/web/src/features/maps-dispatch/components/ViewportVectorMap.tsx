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
  LocateFixed,
  Minus,
  Plus,
  Search,
} from "lucide-react";
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
import {
  estimateZoomForViewport,
  getViewportCenter,
  latToWorldPx,
  lngToWorldPx,
  MAP_TILE_SIZE,
  panViewportByPixels,
  type ViewportBox,
} from "../presets";

export interface LiveDoctorPin {
  id: string;
  name: string;
  specialty: string;
  facilityId: string;
  facilityName: string;
  lat: number;
  lng: number;
}

interface ViewportVectorMapProps {
  countryCode: string;
  viewport: ViewportBox;
  facilities: readonly ViewportFacilityItem[];
  drivers: readonly LiveDriverMarker[];
  doctorPins?: readonly LiveDoctorPin[];
  selectedFacilityId: string | null;
  selectedDoctorId?: string | null;
  postgisQueryMs: number | null;
  redisQueryMs: number | null;
  busy: boolean;
  onSelectFacility: (facilityId: string) => void;
  onSelectDoctor?: (doctorId: string) => void;
  onZoom: (factor: number) => void;
  onPan: (dLat: number, dLng: number) => void;
  onReset: () => void;
  onSearchViewport: () => void;
  onViewportChange?: (next: ViewportBox) => void;
}

const FACILITY_PIN_THEME: Record<
  FacilityKind,
  { ring: string; accent: string }
> = {
  HOSPITAL: {
    ring: "border-red-600",
    accent: "text-red-900",
  },
  CLINIC: {
    ring: "border-teal-700",
    accent: "text-teal-950",
  },
  PHARMACY: {
    ring: "border-emerald-600",
    accent: "text-emerald-950",
  },
  DIAGNOSTIC_LAB: {
    ring: "border-slate-700",
    accent: "text-slate-900",
  },
};

export function ViewportVectorMap({
  countryCode,
  viewport,
  facilities,
  drivers,
  doctorPins = [],
  selectedFacilityId,
  selectedDoctorId = null,
  postgisQueryMs,
  redisQueryMs,
  busy,
  onSelectFacility,
  onSelectDoctor,
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
        className="relative h-80 w-full cursor-grab overflow-hidden rounded-2xl border border-slate-200 bg-[#edf1ee] select-none active:cursor-grabbing sm:h-[26rem] lg:h-[34rem]"
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

        {/* Streamlined 3-Button Zoom & Center Control */}
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
            aria-label="Center map on region"
            onClick={onReset}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-teal-800 hover:bg-teal-50 active:scale-95"
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
          </button>
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

        {/* Photographic Facility Markers Projected onto Street Coordinates */}
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

          const theme = FACILITY_PIN_THEME[facility.kind];
          const isSelected = facility.id === selectedFacilityId;
          const photoSrc = resolveFacilityPicture(facility.kind);

          return (
            <button
              key={facility.id}
              type="button"
              onClick={() => onSelectFacility(facility.id)}
              aria-label={`${facility.name} (${formatFacilityKind(facility.kind)}, ${formatOpenStatus(facility.openStatus)})`}
              style={{ left: `${px}px`, top: `${py}px` }}
              className={`group absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 py-0.5 pl-0.5 pr-2.5 text-[11px] font-semibold shadow-md backdrop-blur-xs transition-transform hover:z-30 hover:scale-105 active:scale-95 ${
                theme.accent
              } ${isSelected ? "z-25 scale-105 ring-2 ring-slate-900 ring-offset-2" : "z-10"}`}
            >
              <span className="relative shrink-0">
                <img
                  src={photoSrc}
                  alt=""
                  className={`h-7 w-7 rounded-full border-2 object-cover ${theme.ring}`}
                />
                <span
                  aria-hidden="true"
                  className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border border-white ${
                    facility.openStatus === "OPEN"
                      ? "bg-emerald-500"
                      : facility.openStatus === "BUSY"
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                />
              </span>
              <span className="max-w-[96px] truncate">
                <bdi dir="auto">{facility.name}</bdi>
              </span>
            </button>
          );
        })}

        {/* Photographic Ambulance / Medical Driver Markers */}
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
              className={`absolute z-15 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-[10px] font-bold shadow-md backdrop-blur-xs ${
                driver.status === "EN_ROUTE"
                  ? "border-red-700 bg-red-50/95 text-red-950"
                  : "border-teal-800 bg-white/95 text-teal-950"
              }`}
            >
              <img
                src={resolveVehiclePicture("AMBULANCE")}
                alt="Medical Transport Unit"
                className="h-6 w-6 rounded-full border border-slate-200 object-cover"
              />
              <span>{formatDriverStatus(driver.status)}</span>
            </div>
          );
        })}

        {/* Photographic Doctor & Nurse Portrait Pins */}
        {doctorPins.map((doc) => {
          const px = lngToWorldPx(doc.lng, zoom) - originX;
          const py = latToWorldPx(doc.lat, zoom) - originY;
          if (
            px < -40 ||
            px > size.width + 40 ||
            py < -40 ||
            py > size.height + 40
          ) {
            return null;
          }
          const isSelected = doc.id === selectedDoctorId;
          return (
            <button
              key={`doc-${doc.id}`}
              type="button"
              onClick={() => onSelectDoctor?.(doc.id)}
              style={{ left: `${px}px`, top: `${py}px` }}
              title={`${doc.name} · ${doc.specialty}`}
              aria-label={`Select doctor ${doc.name}`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-[10px] font-bold shadow-sm transition-transform hover:z-30 hover:scale-105 active:scale-95 ${
                isSelected
                  ? "z-25 scale-105 border-slate-900 bg-emerald-700 text-white ring-2 ring-slate-900 ring-offset-1"
                  : "z-15 border-emerald-700 bg-white/95 text-emerald-950"
              }`}
            >
              <img
                src={resolveDefaultAvatar(doc.name, "DOCTOR", doc.specialty)}
                alt=""
                className="h-6 w-6 shrink-0 rounded-full border border-emerald-200 object-cover"
              />
              <span className="max-w-[96px] truncate">
                <bdi dir="auto">{doc.name}</bdi>
              </span>
            </button>
          );
        })}

        {facilities.length === 0 && drivers.length === 0 && doctorPins.length === 0 ? (
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
