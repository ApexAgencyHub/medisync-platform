"use client";

import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type {
  DispatchStatus,
  DispatchUrgency,
  FacilityKind,
  LiveDriverMarker,
  ViewportFacilityItem,
} from "@medisync/contracts";
import {
  Ambulance,
  FlaskConical,
  Hospital,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Minus,
  Pill,
  Plus,
  Stethoscope,
} from "lucide-react";
import {
  formatDispatchStatus,
  formatDriverStatus,
  formatFacilityKind,
  formatOpenStatus,
  formatUrgencyLabel,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { MAPS_COPY } from "../maps-i18n";
import {
  estimateZoomForViewport,
  getViewportCenter,
  latToWorldPx,
  lngToWorldPx,
  MAP_TILE_SIZE,
  panViewportByPixels,
  worldPxToLat,
  worldPxToLng,
  type ViewportBox,
} from "../presets";
import {
  estimateFallbackRoadRoute,
  useRoadRoute,
  type RoadRouteGeometry,
} from "./useRoadRoute";

interface ProjectedRoadLeg {
  id: "pickup" | "dropoff";
  legLabel: string;
  stroke: string;
  badgeClass: string;
  dotClass: string;
  chains: readonly string[];
  hasVisibleGeometry: boolean;
  startPx: readonly [number, number] | null;
  endPx: readonly [number, number] | null;
  badgePx: readonly [number, number] | null;
  durationMins: number;
  distanceKm: string;
  showEta: boolean;
}

function clipSegmentToViewport(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): readonly [readonly [number, number], readonly [number, number]] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const checks: ReadonlyArray<readonly [number, number]> = [
    [-dx, ax - minX],
    [dx, maxX - ax],
    [-dy, ay - minY],
    [dy, maxY - ay],
  ];

  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }

  return [
    [ax + t0 * dx, ay + t0 * dy],
    [ax + t1 * dx, ay + t1 * dy],
  ];
}

function buildCompactZoomArc(
  startPx: readonly [number, number],
  endPx: readonly [number, number],
  offsetDirection: 1 | -1,
): Array<readonly [number, number]> {
  const mx = (startPx[0] + endPx[0]) / 2;
  const my = (startPx[1] + endPx[1]) / 2;
  const dx = endPx[0] - startPx[0];
  const dy = endPx[1] - startPx[1];
  const dist = Math.hypot(dx, dy);
  const nx = dist > 0.5 ? -dy / dist : 0;
  const ny = dist > 0.5 ? dx / dist : -1;
  const bulge = Math.max(14, Math.min(24, 24 - dist * 0.4));
  const cx = mx + nx * bulge * offsetDirection;
  const cy = my + ny * bulge * offsetDirection;
  const pts: Array<readonly [number, number]> = [];
  for (let i = 0; i <= 6; i += 1) {
    const t = i / 6;
    const inv = 1 - t;
    pts.push([
      inv * inv * startPx[0] + 2 * inv * t * cx + t * t * endPx[0],
      inv * inv * startPx[1] + 2 * inv * t * cy + t * t * endPx[1],
    ]);
  }
  return pts;
}

function projectRoadLeg(
  id: "pickup" | "dropoff",
  legLabel: string,
  geometry: RoadRouteGeometry | null,
  fallbackEndpoints: readonly [readonly [number, number], readonly [number, number]],
  zoom: number,
  originX: number,
  originY: number,
  viewportW: number,
  viewportH: number,
): ProjectedRoadLeg {
  const coords =
    geometry && geometry.coordinates.length >= 2
      ? geometry.coordinates
      : fallbackEndpoints;

  const rawPixels = coords.map(([lng, lat]) => [
    lngToWorldPx(lng, zoom) - originX,
    latToWorldPx(lat, zoom) - originY,
  ] as const);

  const rawStart = rawPixels[0]!;
  const rawEnd = rawPixels[rawPixels.length - 1]!;
  const spanPx = Math.hypot(rawEnd[0] - rawStart[0], rawEnd[1] - rawStart[1]);

  // Keep the route ribbon clearly visible even when zoomed way out (roads hidden / pins close)
  const pixels =
    spanPx < 24
      ? buildCompactZoomArc(rawStart, rawEnd, id === "pickup" ? -1 : 1)
      : rawPixels;

  const pad = 16;
  const chainArrays: Array<Array<readonly [number, number]>> = [];
  const allVisiblePoints: Array<readonly [number, number]> = [];

  for (let i = 0; i < pixels.length - 1; i += 1) {
    const a = pixels[i]!;
    const b = pixels[i + 1]!;
    const clipped = clipSegmentToViewport(
      a[0],
      a[1],
      b[0],
      b[1],
      -pad,
      -pad,
      viewportW + pad,
      viewportH + pad,
    );
    if (!clipped) continue;
    const [ca, cb] = clipped;
    allVisiblePoints.push(ca, cb);
    const activeChain = chainArrays[chainArrays.length - 1];
    const lastPt = activeChain?.[activeChain.length - 1];
    if (
      activeChain &&
      lastPt &&
      Math.hypot(lastPt[0] - ca[0], lastPt[1] - ca[1]) < 0.75
    ) {
      activeChain.push(cb);
    } else {
      chainArrays.push([ca, cb]);
    }
  }

  const chains = chainArrays
    .filter((pts) => pts.length >= 2)
    .map((pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "));

  const isInBounds = (pt: readonly [number, number]) =>
    pt[0] >= -pad &&
    pt[0] <= viewportW + pad &&
    pt[1] >= -pad &&
    pt[1] <= viewportH + pad;

  const midVisible =
    allVisiblePoints.length >= 2
      ? allVisiblePoints[Math.floor(allVisiblePoints.length / 2)]!
      : null;
  const staggerY = spanPx < 88 ? (id === "pickup" ? -24 : 24) : 0;
  const badgePx: readonly [number, number] | null = midVisible
    ? [
        Math.min(Math.max(midVisible[0], 74), Math.max(74, viewportW - 74)),
        Math.min(
          Math.max(midVisible[1] + staggerY, 64),
          Math.max(64, viewportH - 64),
        ),
      ]
    : null;

  return {
    id,
    legLabel,
    stroke: id === "pickup" ? "#DC2626" : "#0066CC",
    badgeClass:
      id === "pickup"
        ? "border-rose-200 bg-white/98 text-rose-950"
        : "border-[#BFDBFE] bg-white/98 text-[#0F243E]",
    dotClass: id === "pickup" ? "bg-[#DC2626]" : "bg-[#0066CC]",
    chains,
    hasVisibleGeometry: chains.length > 0,
    startPx: isInBounds(rawStart) ? rawStart : chainArrays[0]?.[0] ?? null,
    endPx: isInBounds(rawEnd)
      ? rawEnd
      : chainArrays[chainArrays.length - 1]?.[
          chainArrays[chainArrays.length - 1]!.length - 1
        ] ?? null,
    badgePx,
    durationMins:
      geometry && geometry.distanceMeters > 0
        ? Math.max(1, Math.round(geometry.durationSeconds / 60))
        : 0,
    distanceKm:
      geometry && geometry.distanceMeters > 0
        ? (geometry.distanceMeters / 1000).toFixed(1)
        : "0.0",
    showEta: Boolean(geometry && geometry.distanceMeters > 0),
  };
}

function RoadEtaReadout({
  durationMins,
  distanceKm,
  minutesShort,
  kmShort,
  isRtl,
  className = "",
}: {
  durationMins: number;
  distanceKm: string;
  minutesShort: string;
  kmShort: string;
  isRtl: boolean;
  className?: string;
}) {
  return (
    <span
      dir={isRtl ? "rtl" : "ltr"}
      className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}
    >
      <span className="inline-flex items-baseline gap-0.5">
        <bdi dir="ltr">{durationMins}</bdi>
        <span>{minutesShort}</span>
      </span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-baseline gap-0.5">
        <bdi dir="ltr">{distanceKm}</bdi>
        <span>{kmShort}</span>
      </span>
    </span>
  );
}

export interface LiveDoctorPin {
  id: string;
  name: string;
  specialty: string;
  facilityId: string;
  facilityName: string;
  lat: number;
  lng: number;
}

export interface ClientDispatchPin {
  id: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  urgency: DispatchUrgency;
  status: DispatchStatus;
  targetFacilityId: string | null;
  driverUserId: string | null;
}

interface ViewportVectorMapProps {
  countryCode: string;
  viewport: ViewportBox;
  facilities: readonly ViewportFacilityItem[];
  drivers: readonly LiveDriverMarker[];
  doctorPins?: readonly LiveDoctorPin[];
  clientPins?: readonly ClientDispatchPin[];
  driverLabels?: Readonly<Record<string, string>>;
  activeLayer?: "ALL" | "DRIVER" | "DOCTOR" | FacilityKind;
  driverWorkspaceMode?: boolean;
  disableWheelZoom?: boolean;
  selectedFacilityId: string | null;
  highlightedTargetFacilityId?: string | null;
  selectedDoctorId?: string | null;
  selectedDriverId?: string | null;
  selectedDispatchId?: string | null;
  postgisQueryMs: number | null;
  redisQueryMs: number | null;
  busy: boolean;
  edgeToEdge?: boolean;
  hudTopPaddingPx?: number;
  hudStartOffsetClass?: string;
  hasSideDrawerOpen?: boolean;
  onSelectFacility: (facilityId: string) => void;
  onSelectDoctor?: (doctorId: string) => void;
  onSelectDriver?: (driverId: string) => void;
  onSelectDispatch?: (dispatchId: string) => void;
  onZoom: (factor: number) => void;
  onPan: (dLat: number, dLng: number) => void;
  onReset: () => void;
  onSearchViewport?: () => void;
  onViewportChange?: ((next: ViewportBox) => void) | undefined;
  pickupPin?: { lat: number; lng: number } | null | undefined;
  allFacilities?: readonly ViewportFacilityItem[];
  previewOrigin?: { lat: number; lng: number } | null | undefined;
  previewDestination?: {
    lat: number;
    lng: number;
    label: string;
    legKind: "pickup" | "dropoff";
  } | null | undefined;
  onPickLocation?: ((lat: number, lng: number) => void) | undefined;
}

const FACILITY_PIN_THEME: Record<
  FacilityKind,
  {
    badgeBg: string;
    border: string;
    accent: string;
    icon: typeof Hospital;
  }
> = {
  HOSPITAL: {
    badgeBg: "bg-[#DC2626]",
    border: "border-rose-200",
    accent: "text-[#0F243E]",
    icon: Hospital,
  },
  CLINIC: {
    badgeBg: "bg-[#0066CC]",
    border: "border-[#BFDBFE]",
    accent: "text-[#0F243E]",
    icon: Stethoscope,
  },
  PHARMACY: {
    badgeBg: "bg-[#0F9D88]",
    border: "border-[#B2E5DC]",
    accent: "text-[#0F243E]",
    icon: Pill,
  },
  DIAGNOSTIC_LAB: {
    badgeBg: "bg-[#0284C7]",
    border: "border-sky-200",
    accent: "text-[#0F243E]",
    icon: FlaskConical,
  },
};

const EMPTY_DOCTOR_PINS: readonly LiveDoctorPin[] = [];
const EMPTY_CLIENT_PINS: readonly ClientDispatchPin[] = [];

function ViewportVectorMapInner({
  countryCode,
  viewport,
  facilities,
  drivers,
  doctorPins = EMPTY_DOCTOR_PINS,
  clientPins = EMPTY_CLIENT_PINS,
  driverLabels,
  activeLayer = "DRIVER",
  driverWorkspaceMode = false,
  disableWheelZoom = false,
  selectedFacilityId,
  highlightedTargetFacilityId = null,
  selectedDoctorId = null,
  selectedDriverId = null,
  selectedDispatchId = null,
  postgisQueryMs,
  redisQueryMs,
  busy,
  edgeToEdge = false,
  hudTopPaddingPx = 12,
  hudStartOffsetClass = "",
  hasSideDrawerOpen = false,
  onSelectFacility,
  onSelectDoctor,
  onSelectDriver,
  onSelectDispatch,
  onZoom,
  onPan,
  onReset,
  onSearchViewport,
  onViewportChange,
  pickupPin = null,
  allFacilities,
  previewOrigin = null,
  previewDestination = null,
  onPickLocation,
}: ViewportVectorMapProps) {
  const { locale, isRtl, t } = useLocale();
  const copy = MAPS_COPY[locale];
  const fullScreenWrapperRef = useRef<HTMLDivElement | null>(null);
  const nativeFullScreenRef = useRef(false);
  const desiredFullScreenRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panLayerRef = useRef<HTMLDivElement | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const pendingDragDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const lastWheelAtRef = useRef<number>(0);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 1280,
    height: 740,
  });
  const dragSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (dragRafRef.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width >= 200 && rect.height >= 200) {
        const nextW = Math.round(rect.width);
        const nextH = Math.round(rect.height);
        setSize((prev) =>
          prev.width === nextW && prev.height === nextH
            ? prev
            : { width: nextW, height: nextH },
        );
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
    () => lngToWorldPx(center.lng, zoom) - size.width / 2,
    [center.lng, zoom, size.width],
  );
  const originY = useMemo(
    () => latToWorldPx(center.lat, zoom) - size.height / 2,
    [center.lat, zoom, size.height],
  );

  const tiles = useMemo(() => {
    const worldTileCount = Math.pow(2, zoom);
    const startX = Math.floor(originX / MAP_TILE_SIZE) - 1;
    const endX = Math.floor((originX + size.width) / MAP_TILE_SIZE) + 1;
    const startY = Math.max(0, Math.floor(originY / MAP_TILE_SIZE) - 1);
    const endY = Math.min(
      worldTileCount - 1,
      Math.floor((originY + size.height) / MAP_TILE_SIZE) + 1,
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

  function resetPanTransform() {
    if (dragRafRef.current !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    pendingDragDeltaRef.current = { dx: 0, dy: 0 };
    const layer = panLayerRef.current;
    if (layer) {
      layer.style.transform = "";
      layer.style.willChange = "";
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button") || target?.closest("[data-map-hud='true']")) {
      return;
    }

    dragSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    if (panLayerRef.current) {
      panLayerRef.current.style.willChange = "transform";
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore synthetic pointer events without capture target
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    pendingDragDeltaRef.current = {
      dx: event.clientX - session.startX,
      dy: event.clientY - session.startY,
    };
    if (dragRafRef.current === null) {
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null;
        const layer = panLayerRef.current;
        if (!layer || !dragSessionRef.current) return;
        const { dx, dy } = pendingDragDeltaRef.current;
        layer.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      });
    }
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;

    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    dragSessionRef.current = null;
    resetPanTransform();

    if (Math.hypot(dx, dy) < 6) {
      const target = event.target as HTMLElement | null;
      if (
        onPickLocation &&
        !driverWorkspaceMode &&
        !target?.closest("button") &&
        !target?.closest("[data-map-hud='true']")
      ) {
        const rect = event.currentTarget.getBoundingClientRect();
        const pickedLng = worldPxToLng(
          originX + (event.clientX - rect.left),
          zoom,
        );
        const pickedLat = worldPxToLat(
          originY + (event.clientY - rect.top),
          zoom,
        );
        onPickLocation(
          Number(pickedLat.toFixed(5)),
          Number(pickedLng.toFixed(5)),
        );
      }
      return;
    }

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

  function handleWheelZoom(event: ReactWheelEvent<HTMLDivElement>) {
    if (disableWheelZoom) return;
    if (Math.abs(event.deltaY) < 4) return;
    const now = Date.now();
    if (now - lastWheelAtRef.current < 110) return;
    lastWheelAtRef.current = now;
    onZoom(event.deltaY < 0 ? 0.72 : 1.38);
  }

  const facilitiesLabel = `${facilities.length} ${t("map.facilitiesFound")}`;
  const unitTelemetryText = `${drivers.length} ${t("map.activeUnits")}`;
  const doctorsTelemetryText = `${doctorPins.length} ${copy.verifiedDoctorsWord}`;
  const driverWorkspaceTelemetryText = `${clientPins.length} ${clientPins.length === 1 ? copy.clientWord : copy.clientsWord} · ${facilities.length} ${facilities.length === 1 ? copy.dropoffWord : copy.dropoffsWord}`;
  const selectedClientPin = useMemo(
    () =>
      (selectedDispatchId
        ? clientPins.find((p) => p.id === selectedDispatchId)
        : null) ??
      (!driverWorkspaceMode ? clientPins[0] ?? null : null),
    [clientPins, selectedDispatchId, driverWorkspaceMode],
  );
  const assignedDriverMarker = useMemo(() => {
    if (!selectedClientPin?.driverUserId) return null;
    return (
      drivers.find((d) => d.driverId === selectedClientPin.driverUserId) ?? null
    );
  }, [drivers, selectedClientPin]);
  const routeDriverMarker = useMemo(() => {
    if (assignedDriverMarker) return assignedDriverMarker;
    if (driverWorkspaceMode) {
      return (
        drivers.find((d) => d.driverId === selectedDriverId) ??
        drivers[0] ??
        null
      );
    }
    return null;
  }, [assignedDriverMarker, driverWorkspaceMode, drivers, selectedDriverId]);
  const facilityPoolForLookup = allFacilities && allFacilities.length > 0 ? allFacilities : facilities;
  const destinationFacility = useMemo(() => {
    const targetId =
      highlightedTargetFacilityId ??
      selectedClientPin?.targetFacilityId ??
      null;
    if (!targetId) return null;
    return facilityPoolForLookup.find((f) => f.id === targetId) ?? null;
  }, [facilityPoolForLookup, highlightedTargetFacilityId, selectedClientPin]);

  const showPickupLeg = Boolean(
    selectedClientPin &&
      routeDriverMarker &&
      selectedClientPin.status !== "ARRIVED",
  );
  const pickupRoadRoute = useRoadRoute(
    showPickupLeg ? routeDriverMarker!.lat : null,
    showPickupLeg ? routeDriverMarker!.lng : null,
    showPickupLeg ? selectedClientPin!.pickupLat : null,
    showPickupLeg ? selectedClientPin!.pickupLng : null,
  );
  const dropoffRoadRoute = useRoadRoute(
    selectedClientPin && destinationFacility
      ? selectedClientPin.pickupLat
      : null,
    selectedClientPin && destinationFacility
      ? selectedClientPin.pickupLng
      : null,
    selectedClientPin && destinationFacility ? destinationFacility.lat : null,
    selectedClientPin && destinationFacility ? destinationFacility.lng : null,
  );
  const previewRoadRoute = useRoadRoute(
    !selectedClientPin && previewOrigin && previewDestination
      ? previewOrigin.lat
      : null,
    !selectedClientPin && previewOrigin && previewDestination
      ? previewOrigin.lng
      : null,
    !selectedClientPin && previewOrigin && previewDestination
      ? previewDestination.lat
      : null,
    !selectedClientPin && previewOrigin && previewDestination
      ? previewDestination.lng
      : null,
  );
  // Preserve optional telemetry/legacy callback props without cluttering the open map
  void postgisQueryMs;
  void redisQueryMs;
  void busy;
  void onSearchViewport;

  const [isFullScreen, setIsFullScreen] = useState(false);

  function exitNativeFullScreen() {
    nativeFullScreenRef.current = false;
    if (
      typeof document !== "undefined" &&
      document.fullscreenElement === fullScreenWrapperRef.current &&
      typeof document.exitFullscreen === "function"
    ) {
      document.exitFullscreen().catch(() => undefined);
    }
  }

  function toggleFullScreen() {
    if (!isFullScreen) {
      desiredFullScreenRef.current = true;
      setIsFullScreen(true);
      const wrapper = fullScreenWrapperRef.current;
      if (wrapper && typeof wrapper.requestFullscreen === "function") {
        wrapper
          .requestFullscreen()
          .then(() => {
            // Abort if Escape/toggle closed fullscreen while the browser request was in-flight
            if (!desiredFullScreenRef.current) {
              exitNativeFullScreen();
              return;
            }
            nativeFullScreenRef.current = true;
          })
          .catch(() => {
            nativeFullScreenRef.current = false;
          });
      }
      return;
    }

    desiredFullScreenRef.current = false;
    setIsFullScreen(false);
    exitNativeFullScreen();
  }

  useEffect(() => {
    function onFullScreenChange() {
      if (typeof document === "undefined") return;
      if (
        document.fullscreenElement === fullScreenWrapperRef.current &&
        !desiredFullScreenRef.current
      ) {
        exitNativeFullScreen();
        return;
      }
      if (nativeFullScreenRef.current && !document.fullscreenElement) {
        desiredFullScreenRef.current = false;
        nativeFullScreenRef.current = false;
        setIsFullScreen(false);
      }
    }
    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullScreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isFullScreen) {
      desiredFullScreenRef.current = false;
      exitNativeFullScreen();
      return;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        desiredFullScreenRef.current = false;
        setIsFullScreen(false);
        exitNativeFullScreen();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullScreen]);

  const projectedLegs = useMemo<ProjectedRoadLeg[]>(() => {
    const legs: ProjectedRoadLeg[] = [];
    if (selectedClientPin) {
      if (showPickupLeg && routeDriverMarker) {
        const effectivePickup =
          pickupRoadRoute ??
          estimateFallbackRoadRoute(
            routeDriverMarker.lat,
            routeDriverMarker.lng,
            selectedClientPin.pickupLat,
            selectedClientPin.pickupLng,
          );
        legs.push(
          projectRoadLeg(
            "pickup",
            copy.routePickupLegLabel,
            effectivePickup,
            [
              [routeDriverMarker.lng, routeDriverMarker.lat],
              [selectedClientPin.pickupLng, selectedClientPin.pickupLat],
            ],
            zoom,
            originX,
            originY,
            size.width,
            size.height,
          ),
        );
      }
      if (destinationFacility) {
        const effectiveDropoff =
          dropoffRoadRoute ??
          estimateFallbackRoadRoute(
            selectedClientPin.pickupLat,
            selectedClientPin.pickupLng,
            destinationFacility.lat,
            destinationFacility.lng,
          );
        legs.push(
          projectRoadLeg(
            "dropoff",
            copy.routeDropoffLegLabel,
            effectiveDropoff,
            [
              [selectedClientPin.pickupLng, selectedClientPin.pickupLat],
              [destinationFacility.lng, destinationFacility.lat],
            ],
            zoom,
            originX,
            originY,
            size.width,
            size.height,
          ),
        );
      }
    } else if (previewOrigin && previewDestination) {
      const effectivePreview =
        previewRoadRoute ??
        estimateFallbackRoadRoute(
          previewOrigin.lat,
          previewOrigin.lng,
          previewDestination.lat,
          previewDestination.lng,
        );
      legs.push(
        projectRoadLeg(
          previewDestination.legKind,
          previewDestination.label,
          effectivePreview,
          [
            [previewOrigin.lng, previewOrigin.lat],
            [previewDestination.lng, previewDestination.lat],
          ],
          zoom,
          originX,
          originY,
          size.width,
          size.height,
        ),
      );
    }
    return legs;
  }, [
    selectedClientPin,
    showPickupLeg,
    routeDriverMarker,
    pickupRoadRoute,
    copy.routePickupLegLabel,
    copy.routeDropoffLegLabel,
    destinationFacility,
    dropoffRoadRoute,
    previewOrigin,
    previewDestination,
    previewRoadRoute,
    zoom,
    originX,
    originY,
    size.width,
    size.height,
  ]);

  return (
    <div
      ref={fullScreenWrapperRef}
      className={
        isFullScreen
          ? "fixed inset-0 z-[120] flex h-dvh w-screen flex-col overflow-hidden bg-[#edf1ee]"
          : edgeToEdge
            ? "relative h-full w-full"
            : "relative h-auto"
      }
    >
      {/* Interactive Web Mercator Slippy Street Map Canvas (LTR coordinate plane) */}
      <div
        ref={containerRef}
        dir="ltr"
        role="region"
        aria-label={`${copy.interactiveStreetMapAria} ${viewport.districtLabel}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onWheel={handleWheelZoom}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          onZoom(0.65);
        }}
        className={`relative w-full cursor-grab touch-none overflow-hidden bg-[#edf1ee] select-none active:cursor-grabbing ${
          isFullScreen
            ? "h-full min-h-0 flex-1"
            : edgeToEdge
              ? "h-full w-full"
              : "h-[24rem] rounded-2xl border border-[#D7E4F2] lg:h-[34rem]"
        }`}
      >
        {/* GPU-Composited Pan Plane: Tiles, Pins, and Projected Road Polylines */}
        <div ref={panLayerRef} className="absolute inset-0">
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

          {/* Crisp Medical Facility Pins Projected onto Street Coordinates */}
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
          const Icon = theme.icon;
          const isSelected = facility.id === selectedFacilityId;
          const isDropoffDestination =
            facility.id === highlightedTargetFacilityId ||
            facility.id === destinationFacility?.id;

          return (
            <button
              key={facility.id}
              type="button"
              data-map-pin="true"
              onClick={() => onSelectFacility(facility.id)}
              aria-label={`${facility.name} (${formatFacilityKind(facility.kind, locale)}, ${formatOpenStatus(facility.openStatus, locale)})${isDropoffDestination ? " - Destination" : ""}`}
              style={{ left: `${px}px`, top: `${py}px` }}
              className={`group absolute -translate-x-1/2 -translate-y-full scroll-mt-24 flex flex-col items-center transition-transform hover:z-30 hover:scale-105 active:scale-95 ${
                isDropoffDestination || isSelected ? "z-25 scale-105" : "z-10"
              }`}
            >
              <span
                className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[11px] font-bold shadow-[0_8px_22px_-6px_rgba(15,36,62,0.22)] backdrop-blur-sm ${
                  isDropoffDestination
                    ? "border-[#0052A3] bg-[#0066CC] text-white ring-4 ring-[#0066CC]/20"
                    : isSelected
                      ? "border-[#0052A3] bg-[#0066CC] text-white ring-4 ring-[#0066CC]/20"
                      : `${theme.border} bg-white/97 ${theme.accent}`
                }`}
              >
                <span
                  className={`relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-xs ${
                    isDropoffDestination ? "bg-[#00448A]" : theme.badgeBg
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                      facility.openStatus === "OPEN"
                        ? "bg-[#10B981]"
                        : facility.openStatus === "BUSY"
                          ? "bg-amber-400"
                          : "bg-red-500"
                    }`}
                  />
                </span>
                <span dir="auto" className="max-w-[78px] truncate sm:max-w-[152px]">
                  {facility.name}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`-mt-1 h-2.5 w-2.5 rotate-45 border-r border-b shadow-xs ${
                  isDropoffDestination
                    ? "border-[#0052A3] bg-[#0066CC]"
                    : isSelected
                      ? "border-[#0052A3] bg-[#0066CC]"
                      : `${theme.border} bg-white`
                }`}
              />
            </button>
          );
        })}

          {/* Shared Live Road Navigation Overlay: Zoom-Proof Polyline & Clear ETA + Distance */}
          {projectedLegs.length > 0 ? (
            <>
              <svg
                aria-hidden="true"
                width={size.width}
                height={size.height}
                viewBox={`0 0 ${size.width} ${size.height}`}
                className="pointer-events-none absolute inset-0 z-15 h-full w-full"
              >
                {projectedLegs
                  .filter((leg) => leg.hasVisibleGeometry)
                  .map((leg) => (
                    <g key={leg.id}>
                      {leg.chains.map((chainPoints, chainIdx) => (
                        <g key={`${leg.id}-c-${chainIdx}`}>
                          <polyline
                            points={chainPoints}
                            fill="none"
                            stroke="rgba(15, 23, 42, 0.28)"
                            strokeWidth={10}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <polyline
                            points={chainPoints}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth={7.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <polyline
                            data-route-leg={chainIdx === 0 ? leg.id : undefined}
                            points={chainPoints}
                            fill="none"
                            stroke={leg.stroke}
                            strokeWidth={4.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </g>
                      ))}
                      {leg.startPx ? (
                        <circle
                          cx={leg.startPx[0]}
                          cy={leg.startPx[1]}
                          r={5.5}
                          fill={leg.stroke}
                          stroke="#ffffff"
                          strokeWidth={2.25}
                        />
                      ) : null}
                      {leg.endPx ? (
                        <circle
                          cx={leg.endPx[0]}
                          cy={leg.endPx[1]}
                          r={5.5}
                          fill={leg.stroke}
                          stroke="#ffffff"
                          strokeWidth={2.25}
                        />
                      ) : null}
                    </g>
                  ))}
              </svg>
              {projectedLegs
                .filter((leg) => leg.showEta && leg.badgePx !== null)
                .map((leg) => (
                  <div
                    key={`eta-${leg.id}`}
                    aria-hidden="true"
                    style={{
                      left: `${leg.badgePx![0]}px`,
                      top: `${leg.badgePx![1]}px`,
                    }}
                    className={`pointer-events-none absolute z-18 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-0.5 font-mono-tabular text-[11px] font-extrabold whitespace-nowrap shadow-lg backdrop-blur-xs ${leg.badgeClass}`}
                  >
                    <RoadEtaReadout
                      durationMins={leg.durationMins}
                      distanceKm={leg.distanceKm}
                      minutesShort={copy.minutesShort}
                      kmShort={copy.kmShort}
                      isRtl={isRtl}
                    />
                  </div>
                ))}
            </>
          ) : null}

        {/* User Tap-to-Set Emerald Pickup Pin */}
        {pickupPin && clientPins.length === 0 ? (() => {
          const px = lngToWorldPx(pickupPin.lng, zoom) - originX;
          const py = latToWorldPx(pickupPin.lat, zoom) - originY;
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
              data-map-hud="true"
              style={{ left: `${px}px`, top: `${py}px` }}
              aria-label={copy.selectedPickupPinAria}
              className="pointer-events-none absolute z-25 -translate-x-1/2 -translate-y-full flex flex-col items-center"
            >
              <span className="flex items-center gap-1 rounded-full border border-[#0052A3] bg-[#0066CC] px-3 py-1 text-[11px] font-bold text-white shadow-xl">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">{copy.yourPickupWord}</span>
              </span>
              <span
                aria-hidden="true"
                className="-mt-1 h-2.5 w-2.5 rotate-45 border-r border-b border-[#0052A3] bg-[#0066CC] shadow-xs"
              />
            </div>
          );
        })() : null}

        {/* Active Dispatch Pickup Pins (Driver Relay & Patient Live Tracking) */}
        {clientPins.map((pin) => {
          const px = lngToWorldPx(pin.pickupLng, zoom) - originX;
          const py = latToWorldPx(pin.pickupLat, zoom) - originY;
          if (
            px < -40 ||
            px > size.width + 40 ||
            py < -40 ||
            py > size.height + 40
          ) {
            return null;
          }
          const isSelectedClient = pin.id === selectedDispatchId;
          const isActiveRide =
            pin.status === "ASSIGNED" ||
            pin.status === "EN_ROUTE" ||
            pin.status === "ARRIVED";
          const pinLabel = driverWorkspaceMode
            ? pin.pickupAddress
            : `${copy.yourPickupWord} · ${pin.pickupAddress}`;
          return (
            <button
              key={`client-${pin.id}`}
              type="button"
              data-map-pin="true"
              onClick={() => onSelectDispatch?.(pin.id)}
              style={{ left: `${px}px`, top: `${py}px` }}
              title={`${formatUrgencyLabel(pin.urgency, locale)} · ${pinLabel} (${formatDispatchStatus(pin.status, locale)})`}
              aria-label={`${driverWorkspaceMode ? copy.clientPickupWord : copy.yourPickupWord} ${pin.pickupAddress} (${formatDispatchStatus(pin.status, locale)})`}
              className={`group absolute -translate-x-1/2 -translate-y-full flex flex-col items-center transition-transform hover:z-35 hover:scale-105 active:scale-95 ${
                isSelectedClient ? "z-30 scale-105" : "z-20"
              }`}
            >
              <span
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[11px] font-bold shadow-[0_8px_22px_-6px_rgba(15,36,62,0.22)] backdrop-blur-sm ${
                  isSelectedClient
                    ? "border-[#0052A3] bg-[#0066CC] text-white ring-4 ring-[#0066CC]/20"
                    : isActiveRide
                      ? "border-[#0052A3] bg-[#0066CC] text-white"
                      : pin.urgency === "EMERGENCY"
                        ? "border-rose-200 bg-white/97 text-rose-950"
                        : "border-amber-200 bg-white/97 text-amber-950"
                }`}
              >
                <span
                  className={`relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-xs ${
                    isActiveRide
                      ? "bg-[#00448A]"
                      : pin.urgency === "EMERGENCY"
                        ? "bg-[#DC2626]"
                        : "bg-amber-600"
                  }`}
                >
                  {driverWorkspaceMode && !isActiveRide ? (
                    <span
                      aria-hidden="true"
                      className={`absolute inset-0 rounded-full opacity-50 animate-ping ${
                        pin.urgency === "EMERGENCY"
                          ? "bg-[#DC2626]"
                          : "bg-amber-500"
                      }`}
                    />
                  ) : null}
                  <MapPin className="relative h-3.5 w-3.5 text-white" aria-hidden="true" />
                </span>
                <span className="max-w-[140px] truncate">
                  <bdi dir="auto">
                    {driverWorkspaceMode ? pin.pickupAddress : copy.yourPickupWord}
                  </bdi>
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`-mt-1 h-2.5 w-2.5 rotate-45 border-r border-b shadow-xs ${
                  isSelectedClient
                    ? "border-[#0052A3] bg-[#0066CC]"
                    : isActiveRide
                      ? "border-[#0052A3] bg-[#0066CC]"
                      : pin.urgency === "EMERGENCY"
                        ? "border-rose-200 bg-white"
                        : "border-amber-200 bg-white"
                }`}
              />
            </button>
          );
        })}

        {/* Crisp Vector Ambulance / Medical Driver Pins */}
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

          const isSelectedDriver = driver.driverId === selectedDriverId;
          const isAssignedDriver =
            !driverWorkspaceMode &&
            selectedClientPin?.driverUserId === driver.driverId;
          const isUrgentRoute = driver.status === "EN_ROUTE" || isAssignedDriver;
          const driverDisplayLabel = driverLabels?.[driver.driverId];
          return (
            <button
              key={driver.driverId}
              type="button"
              data-map-pin="true"
              onClick={() => onSelectDriver?.(driver.driverId)}
              style={{ left: `${px}px`, top: `${py}px` }}
              title={`${driverDisplayLabel ?? copy.medicalUnitWord} (${formatDriverStatus(driver.status, locale)})${isAssignedDriver ? ` · ${copy.assignedToTripSuffix}` : ""}`}
              aria-label={`${isAssignedDriver ? copy.yourAssignedDriverAria : copy.selectDriverAria} (${formatDriverStatus(driver.status, locale)})`}
              className={`group absolute -translate-x-1/2 -translate-y-full flex flex-col items-center transition-transform hover:z-30 hover:scale-105 active:scale-95 ${
                isSelectedDriver
                  ? "z-30 scale-105"
                  : isAssignedDriver
                    ? "z-25 scale-105"
                    : "z-15"
              }`}
            >
              <span
                className={`flex min-h-[34px] items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[11px] font-bold shadow-[0_8px_22px_-6px_rgba(15,36,62,0.22)] backdrop-blur-sm ${
                  isSelectedDriver
                    ? "border-[#0052A3] bg-[#0066CC] text-white ring-4 ring-[#0066CC]/20"
                    : isUrgentRoute
                      ? "border-rose-200 bg-white/97 text-rose-950 ring-2 ring-rose-500/20"
                      : "border-[#BFDBFE] bg-white/97 text-[#0F243E]"
                }`}
              >
                <span
                  className={`relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white shadow-xs ${
                    isUrgentRoute
                      ? "bg-[#DC2626]"
                      : driver.status === "AVAILABLE"
                        ? "bg-[#0066CC]"
                        : "bg-amber-600"
                  }`}
                >
                  <Ambulance className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                      driver.status === "AVAILABLE"
                        ? "bg-[#10B981]"
                        : driver.status === "EN_ROUTE"
                          ? "bg-red-400"
                          : "bg-amber-400"
                    }`}
                  />
                </span>
                <span className="max-w-[148px] truncate whitespace-nowrap">
                  {isAssignedDriver
                    ? copy.yourDriverWord
                    : driverDisplayLabel ?? formatDriverStatus(driver.status, locale)}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`-mt-1 h-2.5 w-2.5 rotate-45 border-r border-b shadow-xs ${
                  isSelectedDriver
                    ? "border-[#0052A3] bg-[#0066CC]"
                    : isUrgentRoute
                      ? "border-rose-200 bg-white"
                      : "border-[#BFDBFE] bg-white"
                }`}
              />
            </button>
          );
        })}

        {/* Crisp Vector Doctor & Nurse Pins */}
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
              data-map-pin="true"
              onClick={() => onSelectDoctor?.(doc.id)}
              style={{ left: `${px}px`, top: `${py}px` }}
              title={`${doc.name} · ${doc.specialty}`}
              aria-label={`${copy.selectDoctorAria} ${doc.name}`}
              className={`group absolute -translate-x-1/2 -translate-y-full flex flex-col items-center transition-transform hover:z-30 hover:scale-105 active:scale-95 ${
                isSelected ? "z-25 scale-105" : "z-15"
              }`}
            >
              <span
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-[11px] font-bold shadow-[0_8px_22px_-6px_rgba(15,36,62,0.22)] backdrop-blur-sm ${
                  isSelected
                    ? "border-[#0052A3] bg-[#0066CC] text-white ring-4 ring-[#0066CC]/20"
                    : "border-[#BFDBFE] bg-white/97 text-[#0F243E]"
                }`}
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#0066CC] shadow-xs">
                  <Stethoscope className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                </span>
                <span className="max-w-[110px] truncate">
                  <bdi dir="auto">{doc.name}</bdi>
                </span>
              </span>
                <span
                aria-hidden="true"
                className={`-mt-1 h-2.5 w-2.5 rotate-45 border-r border-b shadow-xs ${
                  isSelected
                    ? "border-[#0052A3] bg-[#0066CC]"
                    : "border-[#BFDBFE] bg-white"
                }`}
              />
            </button>
          );
        })}
        </div>

        {/* Stationary HUD Overlays (Never Pan With Map Drag) */}
        {isFullScreen ? (
          <div
            data-map-hud="true"
            onPointerDown={(e) => e.stopPropagation()}
            style={{ ["--map-top" as string]: "12px" } as Record<string, string>}
            className="pointer-events-none absolute inset-x-2.5 top-[var(--map-top)] z-20 flex items-center justify-end gap-2 sm:inset-x-3.5"
          >
            <button
              type="button"
              onClick={toggleFullScreen}
              className="pointer-events-auto inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#D7E4F2] bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-[#0F243E] shadow-lg transition-colors hover:bg-[#F3F8FD]"
            >
              <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Exit Full Screen</span>
            </button>
          </div>
        ) : null}

        {projectedLegs.some((leg) => leg.showEta) ? (
          <div
            data-map-hud="true"
            data-map-route-summary="true"
            dir={isRtl ? "rtl" : "ltr"}
            aria-label={copy.routeSummaryAria}
            style={{
              ["--map-route-top" as string]: `${isFullScreen ? 14 : hudTopPaddingPx}px`,
            } as Record<string, string>}
            className={`pointer-events-none absolute z-25 flex-wrap items-center justify-center gap-1.5 ${
              driverWorkspaceMode
                ? "hidden sm:flex sm:inset-x-3 sm:top-[var(--map-route-top)]"
                : "flex max-sm:inset-x-3 max-sm:bottom-14 sm:inset-x-3 sm:top-[var(--map-route-top)]"
            } ${
              !isFullScreen && hasSideDrawerOpen
                ? "lg:ps-[25rem]"
                : !isFullScreen && hudStartOffsetClass
                  ? hudStartOffsetClass
                  : ""
            }`}
          >
            {projectedLegs
              .filter((leg) => leg.showEta)
              .map((leg) => (
                <div
                  key={`summary-${leg.id}`}
                  dir={isRtl ? "rtl" : "ltr"}
                  className="inline-flex items-center gap-2 rounded-full border border-[#D7E4F2] bg-white/96 px-3.5 py-1.5 text-[11px] font-bold text-[#0F243E] shadow-[0_10px_28px_rgba(15,36,62,0.14)] backdrop-blur-xl"
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${leg.dotClass}`}
                  />
                  <span
                    dir="auto"
                    className="max-w-[165px] truncate text-[#4A627D]"
                  >
                    {leg.legLabel}
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-px shrink-0 bg-[#D7E4F2]"
                  />
                  <RoadEtaReadout
                    durationMins={leg.durationMins}
                    distanceKm={leg.distanceKm}
                    minutesShort={copy.minutesShort}
                    kmShort={copy.kmShort}
                    isRtl={isRtl}
                    className="font-mono-tabular font-extrabold text-[#0052A3]"
                  />
                </div>
              ))}
          </div>
        ) : null}

        {/* Unobtrusive District & Live Status Strip */}
        <div
          data-map-hud="true"
          style={{
            ["--map-top" as string]: `${isFullScreen ? 12 : hudTopPaddingPx}px`,
          } as Record<string, string>}
          className={`pointer-events-none absolute z-20 flex items-center gap-2 ${
            isFullScreen
              ? isRtl
                ? "bottom-3 left-16"
                : "bottom-3 left-2.5 sm:left-3"
              : isRtl
                ? "left-16 max-sm:top-[var(--map-top)] sm:bottom-3"
                : "left-2.5 max-sm:top-[var(--map-top)] sm:bottom-3 sm:left-3"
          } ${isFullScreen ? "" : hudStartOffsetClass}`}
        >
          <div
            dir={isRtl ? "rtl" : "ltr"}
            className="inline-flex max-w-[215px] items-center gap-1.5 rounded-full border border-[#D7E4F2] bg-white/95 px-3 py-1.5 text-[11.5px] shadow-[0_6px_18px_-6px_rgba(15,36,62,0.14)] backdrop-blur-md sm:max-w-none"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#0F9D88]" aria-hidden="true" />
            <span className="truncate font-semibold text-[#0F243E]">
              <bdi dir="auto">{viewport.districtLabel}</bdi> ({countryCode})
            </span>
            <span
              dir={isRtl ? "rtl" : "ltr"}
              className="hidden font-mono-tabular text-[11px] font-medium text-[#556E89] sm:inline"
            >
              ·{" "}
              <bdi dir={isRtl ? "rtl" : "ltr"}>
                {driverWorkspaceMode
                  ? driverWorkspaceTelemetryText
                  : activeLayer === "DRIVER"
                    ? unitTelemetryText
                    : activeLayer === "DOCTOR"
                      ? doctorsTelemetryText
                      : facilitiesLabel}
              </bdi>
            </span>
          </div>

          <span className="hidden rounded-full border border-[#D7E4F2]/80 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-[#6B829D] shadow-xs lg:inline-block">
            © OpenStreetMap · Esri
          </span>
        </div>

        {/* Clean Medical Map Zoom, Center & Full-Screen Stack */}
        <div
          data-map-hud="true"
          onPointerDown={(e) => e.stopPropagation()}
          style={
            !isFullScreen
              ? { ["--map-mobile-ctrl-top" as string]: `${hudTopPaddingPx}px` }
              : undefined
          }
          className={`pointer-events-auto absolute z-20 flex flex-col gap-1 rounded-2xl border border-[#D7E4F2] bg-white/96 p-1.5 shadow-[0_12px_30px_-8px_rgba(15,36,62,0.16)] backdrop-blur-md ${
            isRtl ? "left-2.5 sm:left-3.5" : "right-2.5 sm:right-3.5"
          } ${
            isFullScreen
              ? "bottom-5 top-auto"
              : "top-[var(--map-mobile-ctrl-top)] sm:top-auto sm:bottom-6"
          }`}
        >
          <button
            type="button"
            aria-label={copy.zoomInAria}
            onClick={() => onZoom(0.65)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#2F4661] hover:bg-[#EBF4FF] hover:text-[#0066CC] active:scale-95"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={copy.zoomOutAria}
            onClick={() => onZoom(1.5)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#2F4661] hover:bg-[#EBF4FF] hover:text-[#0066CC] active:scale-95"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={copy.centerMapAria}
            onClick={onReset}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#0066CC] hover:bg-[#EBF4FF] active:scale-95"
          >
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={isFullScreen ? copy.exitFullscreenAria : copy.expandFullscreenAria}
            onClick={toggleFullScreen}
            className="flex h-9 w-9 items-center justify-center rounded-xl border-t border-[#E8F1FA] text-[#2F4661] hover:bg-[#EBF4FF] hover:text-[#0066CC] active:scale-95"
          >
            {isFullScreen ? (
              <Minimize2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {facilities.length === 0 &&
        drivers.length === 0 &&
        doctorPins.length === 0 &&
        clientPins.length === 0 ? (
          <div
            className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 text-center ${
              isFullScreen ? "" : hudStartOffsetClass
            }`}
          >
            <p className="max-w-sm rounded-2xl border border-[#D7E4F2] bg-white/95 px-4 py-3 text-xs leading-relaxed text-[#4A627D] shadow-lg backdrop-blur-md">
              {t("map.emptyOverlay")}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export const ViewportVectorMap = memo(ViewportVectorMapInner);
ViewportVectorMap.displayName = "ViewportVectorMap";
