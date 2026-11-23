"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  DispatchStreamEventSchema,
  DRIVER_OFFER_WINDOW_SECONDS,
  FacilityKindSchema,
  type AuthResponse,
  type CountryPack,
  type DirectoryDoctorSummary,
  type DirectoryDriverSummary,
  type DirectoryFacilitySummary,
  type DispatchListResponse,
  type DispatchRequestSummary,
  type DispatchUrgency,
  type DriverStatus,
  type FacilityKind,
  type LiveDriverMarker,
  type UserMediaDocument,
  type ViewportFacilityItem,
} from "@medisync/contracts";
import { listMyUserMedia } from "@/features/media-certifications";
import {
  checkBackendOnline,
  fetchDirectoryDoctors,
  fetchDirectoryDrivers,
  fetchDirectoryFacilities,
} from "@/shared/api/directory-client";
import {
  clearStoredSession,
  readStoredSession,
  revokeClientSession,
} from "@/shared/auth/session-storage";
import { isConsumerUserOrGuest } from "@/shared/auth/role-capabilities";
import { ConsumerWorkspaceGuard } from "@/shared/auth/ConsumerWorkspaceGuard";
import { addGuestActivityPass } from "@/shared/patient/patient-local-store";
import {
  formatFacilityKind,
  formatOpenStatus,
} from "@/shared/i18n/human-labels";
import {
  formatSpecialtyLabel,
  getSpecialtyKeywords,
} from "@/shared/i18n/specialties";
import { useLocale } from "@/shared/i18n/locale-store";
import { MAPS_COPY } from "../maps-i18n";
import {
  isPendingStaffVerification,
  VerificationGateNotice,
} from "@/shared/ui/VerificationGateNotice";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
  resolveEffectiveCountryCode,
} from "@/shared/config/deployment";
import {
  expandMoroccanCityKeywords,
  matchesAccentInsensitiveQuery,
} from "@/shared/config/morocco-standards";
import {
  SessionAccountBar,
  UiSelect,
  UiSwitch,
  useToastSetter,
} from "@/shared/ui/primitives";
import {
  Ambulance,
  Building2,
  FlaskConical,
  Hospital,
  LocateFixed,
  LogOut,
  MapPin,
  Pill,
  Power,
  Radio,
  Search,
  SlidersHorizontal,
  Stethoscope,
  UserCheck,
  X,
} from "lucide-react";
import {
  createDispatchRequest,
  declineDispatchRequest,
  listDispatchRequests,
  queryNearbyDrivers,
  queryViewportFacilities,
  sendDriverLocationPing,
  updateDispatchStatus,
} from "../api-client";
import {
  getCityPresetById,
  getDefaultCityIdForCountry,
  getPresetForCountry,
  getViewportCenter,
  isCoordinateNearViewport,
  MAP_CITY_PRESETS,
  panViewport,
  toViewportBox,
  zoomViewport,
  type ViewportBox,
} from "../presets";
import {
  MapEntityDetailsCard,
  type MapEnrichedFacility,
  type MapSelectedEntity,
} from "./MapEntityDetailsCard";
import dynamic from "next/dynamic";
import {
  type ClientDispatchPin,
  type LiveDoctorPin,
} from "./ViewportVectorMap";

const ViewportVectorMap = dynamic(
  () => import("./ViewportVectorMap").then((m) => m.ViewportVectorMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full animate-pulse bg-[#E8F1FA]" />
    ),
  },
);
import {
  PatientDispatchHud,
  type AutoDetectedPickupState,
} from "./PatientDispatchHud";
import { DriverDispatchHud } from "./DriverDispatchHud";
import {
  DriverCredentialsPanel,
  DriverTabBar,
  DriverTripsStatsPanel,
  isPharmacyCourierDispatch,
  type DriverQueueFilter,
  type DriverSidebarTab,
} from "./DriverDashboardPanels";

interface DispatchConsoleProps {
  packs: readonly CountryPack[];
  apiBaseUrl: string;
  workspaceMode?: "auto" | "driver" | "public";
}

type DriverLayerMode = "ALL" | "CLIENTS" | "DESTINATIONS";

function calcDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * earthKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function resolveDispatchDestinationFromList(
  dispatch: DispatchRequestSummary | null,
  candidates: readonly ViewportFacilityItem[],
): ViewportFacilityItem | null {
  if (!dispatch) return null;
  if (dispatch.targetFacilityId) {
    const exact = candidates.find((f) => f.id === dispatch.targetFacilityId);
    if (exact) return exact;
  }
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) =>
      calcDistanceKm(dispatch.pickupLat, dispatch.pickupLng, a.lat, a.lng) -
      calcDistanceKm(dispatch.pickupLat, dispatch.pickupLng, b.lat, b.lng),
  )[0]!;
}

function doesDispatchMatchSearch(
  dispatch: Pick<DispatchRequestSummary, "pickupAddress" | "notes" | "urgency">,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) return true;
  return `${dispatch.pickupAddress} ${dispatch.notes ?? ""} ${dispatch.urgency}`
    .toLowerCase()
    .includes(normalizedQuery);
}

function doesDispatchMatchQueueFilter(
  dispatch: Pick<DispatchRequestSummary, "notes">,
  filter: DriverQueueFilter,
): boolean {
  if (filter === "ALL") return true;
  const isCourier = isPharmacyCourierDispatch(dispatch);
  return filter === "COURIER" ? isCourier : !isCourier;
}

type MapSectorFilter = "DRIVER" | "DOCTOR" | FacilityKind;

const SECTOR_FILTER_ICONS: Record<MapSectorFilter, typeof Ambulance> = {
  DRIVER: Ambulance,
  DOCTOR: Stethoscope,
  HOSPITAL: Hospital,
  CLINIC: Building2,
  PHARMACY: Pill,
  DIAGNOSTIC_LAB: FlaskConical,
};

interface MapSearchSuggestion {
  key: string;
  targetType: "FACILITY" | "DOCTOR";
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  lat: number;
  lng: number;
  targetLayer: MapSectorFilter;
}

function parseMapLayerParam(raw: string | null): MapSectorFilter | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (upper === "DRIVER" || upper === "DRIVERS" || upper === "AMBULANCE") {
    return "DRIVER";
  }
  if (upper === "DOCTOR" || upper === "DOCTORS" || upper === "NURSE") {
    return "DOCTOR";
  }
  if (
    upper === "HOSPITAL" ||
    upper === "CLINIC" ||
    upper === "PHARMACY" ||
    upper === "DIAGNOSTIC_LAB"
  ) {
    return upper;
  }
  return null;
}

export function DispatchConsole({
  packs,
  apiBaseUrl,
  workspaceMode = "auto",
}: DispatchConsoleProps) {
  const { locale, t, isRtl } = useLocale();
  const copy = MAPS_COPY[locale];
  const driverLayerOptions = useMemo<
    ReadonlyArray<{ label: string; value: DriverLayerMode }>
  >(
    () => [
      { label: copy.driverLayerOptions.ALL, value: "ALL" },
      { label: copy.driverLayerOptions.CLIENTS, value: "CLIENTS" },
      { label: copy.driverLayerOptions.DESTINATIONS, value: "DESTINATIONS" },
    ],
    [copy],
  );
  const sectorFilterOptions = useMemo<
    ReadonlyArray<{ label: string; value: MapSectorFilter }>
  >(
    () => [
      { label: copy.sectorOptions.DRIVER, value: "DRIVER" },
      { label: copy.sectorOptions.DOCTOR, value: "DOCTOR" },
      { label: copy.sectorOptions.HOSPITAL, value: "HOSPITAL" },
      { label: copy.sectorOptions.CLINIC, value: "CLINIC" },
      { label: copy.sectorOptions.PHARMACY, value: "PHARMACY" },
      { label: copy.sectorOptions.DIAGNOSTIC_LAB, value: "DIAGNOSTIC_LAB" },
    ],
    [copy],
  );
  const defaultCode = resolveActivePack(packs)?.code ?? ACTIVE_COUNTRY_CODE;
  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCode);
  const [selectedCityId, setSelectedCityId] = useState<string>(() =>
    getDefaultCityIdForCountry(defaultCode),
  );
  const [viewport, setViewport] = useState<ViewportBox>(() =>
    getPresetForCountry(defaultCode),
  );
  const [sectorFilter, setSectorFilter] = useState<MapSectorFilter>("DRIVER");
  const [driverLayer, setDriverLayer] = useState<DriverLayerMode>("ALL");
  const [openNowOnly, setOpenNowOnly] = useState(false);

  const [facilities, setFacilities] = useState<ViewportFacilityItem[]>([]);
  const [cachedViewportFacilities, setCachedViewportFacilities] = useState<
    ViewportFacilityItem[]
  >([]);
  const [directoryFacilities, setDirectoryFacilities] = useState<
    DirectoryFacilitySummary[]
  >([]);
  const [directoryDoctors, setDirectoryDoctors] = useState<
    DirectoryDoctorSummary[]
  >([]);
  const [directoryDrivers, setDirectoryDrivers] = useState<
    DirectoryDriverSummary[]
  >([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(
    null,
  );
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(
    null,
  );
  const [routePreviewLocked, setRoutePreviewLocked] = useState(false);
  const declinedDispatchIdsRef = useRef<Set<string>>(new Set());
  const [postgisQueryMs, setPostgisQueryMs] = useState<number | null>(null);

  const [session, setSession] = useState<AuthResponse | null>(null);
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const sessionToken = session?.token ?? null;
  const currentUser = session?.user ?? null;
  const isDriverRole = currentUser?.role === "DRIVER";
  const isPendingStaff = Boolean(
    currentUser && isPendingStaffVerification(currentUser),
  );
  const isDriverWorkspace =
    workspaceMode === "driver" || (workspaceMode !== "public" && isDriverRole);
  const driverWorkspaceAuthorized =
    isDriverRole || currentUser?.role === "OPS_ADMIN";
  const isBlockedMapVisitor =
    workspaceMode !== "driver" &&
    sessionHydrated &&
    currentUser !== null &&
    !isConsumerUserOrGuest(currentUser) &&
    currentUser.role !== "HOSPITAL_ADMIN" &&
    currentUser.role !== "OPS_ADMIN";
  const [drivers, setDrivers] = useState<LiveDriverMarker[]>([]);
  const [redisQueryMs, setRedisQueryMs] = useState<number | null>(null);
  const [dispatches, setDispatches] = useState<DispatchRequestSummary[]>([]);
  const activeAssignedDriverIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    activeAssignedDriverIdsRef.current = new Set(
      dispatches
        .map((disp) => disp.driverUserId)
        .filter((id): id is string => Boolean(id)),
    );
  }, [dispatches]);
  const [streamConnected, setStreamConnected] = useState(false);
  const [apiOnline, setApiOnline] = useState(false);
  const [apiCheckDone, setApiCheckDone] = useState(false);

  const [busy, setBusy] = useState(false);
  const pendingTransitionRef = useRef<Set<string>>(new Set());
  const [pendingDispatchIds, setPendingDispatchIds] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [detailCardOpen, setDetailCardOpen] = useState(false);
  const [fastBookOpen, setFastBookOpen] = useState(false);
  const [pickupPin, setPickupPin] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [pickupSource, setPickupSource] = useState<"GPS" | "PIN" | "AREA">("AREA");
  const [pickupLabel, setPickupLabel] = useState<string>("");
  const [detectingPickup, setDetectingPickup] = useState(false);
  const [fastBookFacilityId, setFastBookFacilityId] = useState("");
  const [mapSearchQuery, setMapSearchQuery] = useState("");
  const mapSearchQueryRef = useRef("");
  useEffect(() => {
    mapSearchQueryRef.current = mapSearchQuery;
  }, [mapSearchQuery]);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const entityDetailCardRef = useRef<HTMLDivElement | null>(null);
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const [hudTopPaddingPx, setHudTopPaddingPx] = useState(64);
  const setBanner = useToastSetter();

  const initialCenter = getViewportCenter(viewport);

  // Driver live GPS & 60s offer countdown state
  const [driverLat, setDriverLat] = useState(String(initialCenter.lat));
  const [driverLng, setDriverLng] = useState(String(initialCenter.lng));
  const [driverStatus, setDriverStatus] = useState<DriverStatus>("AVAILABLE");
  const driverStatusRef = useRef<DriverStatus>("AVAILABLE");
  const [driverDutyHydrated, setDriverDutyHydrated] = useState(false);
  const driverDutyHydratedRef = useRef(false);
  const dutyStatusMutationSeqRef = useRef(0);
  useEffect(() => {
    driverStatusRef.current = driverStatus;
  }, [driverStatus]);
  useEffect(() => {
    driverDutyHydratedRef.current = driverDutyHydrated;
  }, [driverDutyHydrated]);
  const [autoGpsActive, setAutoGpsActive] = useState(false);
  const lastAutoPingMsRef = useRef(0);
  const [driverSidebarTab, setDriverSidebarTab] =
    useState<DriverSidebarTab>("radar");
  const [driverQueueFilter, setDriverQueueFilter] =
    useState<DriverQueueFilter>("ALL");
  const driverQueueFilterRef = useRef<DriverQueueFilter>("ALL");
  useEffect(() => {
    driverQueueFilterRef.current = driverQueueFilter;
  }, [driverQueueFilter]);
  const copyRef = useRef(copy);
  useEffect(() => {
    copyRef.current = copy;
  }, [copy]);
  const knownVisibleOfferIdsRef = useRef<Set<string>>(new Set());
  const activeDriverTripRef = useRef<DispatchRequestSummary | null>(null);
  const [driverUserMedia, setDriverUserMedia] = useState<UserMediaDocument[]>(
    [],
  );
  const offerDeadlinesRef = useRef<Map<string, number>>(new Map());
  const autoRefusingIdsRef = useRef<Set<string>>(new Set());
  const lastSseArrivalMsRef = useRef<Map<string, number>>(new Map());
  const [offerClockNowMs, setOfferClockNowMs] = useState<number>(() =>
    Date.now(),
  );

  function syncOfferDeadline(
    item: DispatchRequestSummary,
    nowMs: number,
    isFreshArrival = true,
  ) {
    if (item.status !== "REQUESTED") {
      offerDeadlinesRef.current.delete(item.id);
      return;
    }
    const existing = offerDeadlinesRef.current.get(item.id);
    if (!isFreshArrival && existing !== undefined) {
      return;
    }
    const windowMs =
      (item.offerWindowSeconds ?? DRIVER_OFFER_WINDOW_SECONDS) * 1000;
    let candidate: number | null = null;
    if (
      typeof item.offerRemainingMs === "number" &&
      Number.isFinite(item.offerRemainingMs)
    ) {
      candidate = nowMs + Math.max(0, Math.min(item.offerRemainingMs, windowMs));
    } else if (item.offerExpiresAtIso) {
      const parsedMs = Date.parse(item.offerExpiresAtIso);
      if (Number.isFinite(parsedMs)) {
        candidate = Math.min(parsedMs, nowMs + windowMs);
      }
    }
    if (candidate !== null) {
      offerDeadlinesRef.current.set(
        item.id,
        existing !== undefined ? Math.min(existing, candidate) : candidate,
      );
      return;
    }
    if (existing === undefined) {
      offerDeadlinesRef.current.set(item.id, nowMs + windowMs);
    }
  }

  function getRemainingOfferMs(item: DispatchRequestSummary): number {
    const deadline = offerDeadlinesRef.current.get(item.id);
    if (deadline !== undefined) {
      return Math.max(0, deadline - offerClockNowMs);
    }
    if (item.offerExpiresAtIso) {
      const parsedMs = Date.parse(item.offerExpiresAtIso);
      if (Number.isFinite(parsedMs)) {
        return Math.max(0, parsedMs - offerClockNowMs);
      }
    }
    return (item.offerWindowSeconds ?? DRIVER_OFFER_WINDOW_SECONDS) * 1000;
  }

  useEffect(() => {
    const stored = readStoredSession();
    const params = new URLSearchParams(window.location.search);
    const urlFacilityId = params.get("facilityId");
    const urlLayer = parseMapLayerParam(
      params.get("layer") ?? params.get("focus"),
    );
    const initialCountry = resolveEffectiveCountryCode(
      stored?.user.countryCode ?? defaultCode,
    );

    if (stored) {
      setSession(stored);
    }
    setSessionHydrated(true);
    setSelectedCountry(initialCountry);
    setSelectedCityId(getDefaultCityIdForCountry(initialCountry));
    setViewport(getPresetForCountry(initialCountry));
    if (urlLayer) {
      setSectorFilter(urlLayer);
    } else if (urlFacilityId) {
      setSectorFilter("CLINIC");
    }
    if (urlFacilityId) {
      setSelectedFacilityId(urlFacilityId);
      setFastBookFacilityId(urlFacilityId);
    }
    const storedIsBlockedOnPublicMap =
      workspaceMode !== "driver" &&
      Boolean(stored?.user) &&
      !isConsumerUserOrGuest(stored?.user) &&
      stored?.user.role !== "HOSPITAL_ADMIN" &&
      stored?.user.role !== "OPS_ADMIN";
    if (params.get("fastBook") === "1" && !storedIsBlockedOnPublicMap) {
      const preset = getPresetForCountry(initialCountry);
      const fallbackCenter = getViewportCenter(preset);
      setPickupPin(fallbackCenter);
      setPickupSource("AREA");
      setPickupLabel(preset.districtLabel);
      setFastBookOpen(true);
      if (
        typeof navigator !== "undefined" &&
        "geolocation" in navigator &&
        typeof navigator.geolocation.getCurrentPosition === "function"
      ) {
        setDetectingPickup(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setDetectingPickup(false);
            const { latitude, longitude } = pos.coords;
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
              return;
            }
            const distKm = calcDistanceKm(
              fallbackCenter.lat,
              fallbackCenter.lng,
              latitude,
              longitude,
            );
            if (distKm <= 800) {
              setPickupPin({ lat: latitude, lng: longitude });
              setPickupSource("GPS");
              setPickupLabel("Live GPS Location");
            }
          },
          () => {
            setDetectingPickup(false);
          },
          { enableHighAccuracy: true, timeout: 4500, maximumAge: 60_000 },
        );
      }
    }

    let cancelled = false;
    checkBackendOnline().then((online) => {
      if (!cancelled) {
        setApiOnline(online);
        setApiCheckDone(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [defaultCode, workspaceMode]);

  useEffect(() => {
    if (!sessionHydrated) return;
    const needsDriverDutySync =
      isDriverWorkspace &&
      currentUser?.role === "DRIVER" &&
      !isPendingStaff &&
      Boolean(sessionToken);
    if (!needsDriverDutySync || (apiCheckDone && !apiOnline)) {
      driverDutyHydratedRef.current = true;
      setDriverDutyHydrated(true);
    }
  }, [
    sessionHydrated,
    isDriverWorkspace,
    currentUser?.role,
    isPendingStaff,
    sessionToken,
    apiCheckDone,
    apiOnline,
  ]);

  useEffect(() => {
    if (isDriverWorkspace && currentUser?.role === "DRIVER" && !isPendingStaff) {
      driverDutyHydratedRef.current = false;
      setDriverDutyHydrated(false);
    }
  }, [currentUser?.id, currentUser?.role, isDriverWorkspace, isPendingStaff]);

  useEffect(() => {
    const el = topBarRef.current;
    if (!el) return;
    const syncTopOffset = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        setHudTopPaddingPx(Math.ceil(el.offsetTop + rect.height + 10));
      }
    };
    syncTopOffset();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(syncTopOffset);
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentUser?.id, isDriverWorkspace]);

  useEffect(() => {
    function handlePointerDownOutside(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (
        target.closest('[data-ui-select-menu="true"]') ||
        target.closest('[aria-modal="true"]')
      ) {
        return;
      }

      if (
        !searchContainerRef.current?.contains(target) &&
        !target.closest('[data-driver-filters-toggle="true"]')
      ) {
        setSearchDropdownOpen(false);
        setFiltersOpen(false);
      }

      if (
        !entityDetailCardRef.current?.contains(target) &&
        !target.closest('[data-map-pin="true"]')
      ) {
        setDetailCardOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSearchDropdownOpen(false);
        setFiltersOpen(false);
        setDetailCardOpen(false);
        if (isDriverWorkspace) {
          setDriverSidebarTab("radar");
        }
      }
    }

    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDownOutside,
        true,
      );
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDriverWorkspace]);

  function handleSelectCity(cityId: string, options?: { silent?: boolean }) {
    const preset = getCityPresetById(cityId);
    if (!preset) return;
    setSelectedCityId(preset.id);
    setSelectedCountry(preset.countryCode);
    setViewport(toViewportBox(preset));
    setDetailCardOpen(false);
    setSelectedFacilityId(null);
    setSelectedDoctorId(null);
    setSelectedDriverId(null);
    setSelectedDispatchId(null);
    if (preset.countryCode !== selectedCountry) {
      setFacilities([]);
      setCachedViewportFacilities([]);
      setDirectoryFacilities([]);
      setDirectoryDoctors([]);
      setDirectoryDrivers([]);
      setDrivers([]);
    }
    if (!options?.silent) {
      setBanner({
        tone: "info",
        text: `Map centered on ${preset.city} (${preset.countryCode})`,
      });
    }
  }

  function focusLocationExact(lat: number, lng: number, districtLabel?: string) {
    const matchedCity = MAP_CITY_PRESETS.find((preset) =>
      isCoordinateNearViewport(lat, lng, preset, 0.15, 0.2),
    );
    if (matchedCity && matchedCity.id !== selectedCityId) {
      setSelectedCityId(matchedCity.id);
    }
    setViewport((box) => {
      const spanLat = Math.min(0.022, Math.max(0.014, box.maxLat - box.minLat));
      const spanLng = Math.min(0.032, Math.max(0.018, box.maxLng - box.minLng));
      return {
        districtLabel:
          districtLabel ?? matchedCity?.districtLabel ?? box.districtLabel,
        minLat: Number(Math.max(-89, lat - spanLat / 2).toFixed(4)),
        maxLat: Number(Math.min(89, lat + spanLat / 2).toFixed(4)),
        minLng: Number(Math.max(-179, lng - spanLng / 2).toFixed(4)),
        maxLng: Number(Math.min(179, lng + spanLng / 2).toFixed(4)),
      };
    });
  }

  function focusCoordinatesOnMap(lat: number, lng: number) {
    setViewport((box) => {
      const spanLat = Math.max(0.015, box.maxLat - box.minLat);
      const spanLng = Math.max(0.015, box.maxLng - box.minLng);
      const xRatio = (lng - box.minLng) / spanLng;
      const yRatio = (box.maxLat - lat) / spanLat;
      if (
        xRatio >= 0.14 &&
        xRatio <= 0.88 &&
        yRatio >= 0.2 &&
        yRatio <= 0.84
      ) {
        return box;
      }
      return {
        districtLabel: box.districtLabel,
        minLat: Number(Math.max(-89, lat - spanLat / 2).toFixed(4)),
        maxLat: Number(Math.min(89, lat + spanLat / 2).toFixed(4)),
        minLng: Number(Math.max(-179, lng - spanLng / 2).toFixed(4)),
        maxLng: Number(Math.min(179, lng + spanLng / 2).toFixed(4)),
      };
    });
  }

  const hasAutoSelectedFacilityRef = useRef(false);
  const viewportKey = `${viewport.minLat.toFixed(3)},${viewport.minLng.toFixed(3)},${viewport.maxLat.toFixed(3)},${viewport.maxLng.toFixed(3)}`;

  // 1. Country-scoped static directory catalogs (no refetch on pan/zoom or pin clicks)
  useEffect(() => {
    if (!apiOnline || !sessionHydrated || isBlockedMapVisitor) {
      return;
    }
    let active = true;
    hasAutoSelectedFacilityRef.current = false;

    if (isDriverWorkspace) {
      if (workspaceMode === "driver" && !driverWorkspaceAuthorized) {
        return;
      }
      void Promise.all([
        fetchDirectoryFacilities(apiBaseUrl, {
          countryCode: selectedCountry,
          limit: 100,
        }),
        fetchDirectoryDrivers(apiBaseUrl, {
          countryCode: selectedCountry,
          limit: 100,
        }),
      ]).then(([facDirRes, fleetRes]) => {
        if (!active) return;
        if (facDirRes.ok) setDirectoryFacilities(facDirRes.facilities);
        if (fleetRes.ok) setDirectoryDrivers(fleetRes.drivers);
      });
      return () => {
        active = false;
      };
    }

    void Promise.all([
      fetchDirectoryFacilities(apiBaseUrl, {
        countryCode: selectedCountry,
        limit: 100,
      }),
      fetchDirectoryDoctors(apiBaseUrl, {
        countryCode: selectedCountry,
        limit: 100,
      }),
      fetchDirectoryDrivers(apiBaseUrl, {
        countryCode: selectedCountry,
        limit: 100,
      }),
    ]).then(([facDirRes, docsRes, fleetRes]) => {
      if (!active) return;
      if (facDirRes.ok) setDirectoryFacilities(facDirRes.facilities);
      if (docsRes.ok) setDirectoryDoctors(docsRes.doctors);
      if (fleetRes.ok) setDirectoryDrivers(fleetRes.drivers);
    });

    return () => {
      active = false;
    };
  }, [
    apiOnline,
    apiBaseUrl,
    selectedCountry,
    sessionHydrated,
    isBlockedMapVisitor,
    isDriverWorkspace,
    workspaceMode,
    driverWorkspaceAuthorized,
  ]);

  // 2. Debounced viewport spatial query + nearby live drivers (decoupled from selectedFacilityId)
  useEffect(() => {
    if (!apiOnline || !sessionHydrated || isBlockedMapVisitor) return;
    if (workspaceMode === "driver" && !driverWorkspaceAuthorized) return;
    let active = true;
    const timer = setTimeout(() => {
      const kindParam =
        isDriverWorkspace ||
        sectorFilter === "DRIVER" ||
        sectorFilter === "DOCTOR"
          ? undefined
          : FacilityKindSchema.parse(sectorFilter);

      void queryViewportFacilities(apiBaseUrl, selectedCountry, viewport, {
        ...(kindParam ? { kind: kindParam } : {}),
        ...(openNowOnly ? { openNow: true } : {}),
      }).then((vpRes) => {
        if (!active || !vpRes.ok) return;
        setFacilities(vpRes.data.facilities);
        setCachedViewportFacilities((prev) => {
          const merged = new Map<string, ViewportFacilityItem>();
          for (const item of prev) {
            if (item.countryCode === selectedCountry) {
              merged.set(item.id, item);
            }
          }
          for (const item of vpRes.data.facilities) {
            merged.set(item.id, item);
          }
          return Array.from(merged.values());
        });
        setPostgisQueryMs(vpRes.data.queryMs);
        if (
          !isDriverWorkspace &&
          sectorFilter !== "DRIVER" &&
          sectorFilter !== "DOCTOR" &&
          vpRes.data.facilities[0] &&
          !hasAutoSelectedFacilityRef.current
        ) {
          hasAutoSelectedFacilityRef.current = true;
          setSelectedFacilityId((prev) => prev ?? vpRes.data.facilities[0]!.id);
        }
      });

      if (sessionToken && currentUser && !isPendingStaff) {
        const center = getViewportCenter(viewport);
        const scopedCountry =
          currentUser.role === "OPS_ADMIN"
            ? selectedCountry
            : currentUser.countryCode;

        void queryNearbyDrivers(apiBaseUrl, sessionToken, {
          countryCode: scopedCountry,
          lat: center.lat,
          lng: center.lng,
          radiusKm: 100,
        }).then((drvRes) => {
          if (!active || !drvRes.ok) return;
          setDrivers((prev) => {
            const freshIds = new Set(drvRes.data.drivers.map((d) => d.driverId));
            const preservedAssigned = prev.filter(
              (d) =>
                !freshIds.has(d.driverId) &&
                activeAssignedDriverIdsRef.current.has(d.driverId),
            );
            return [...drvRes.data.drivers, ...preservedAssigned];
          });
          setRedisQueryMs(drvRes.data.queryMs);
        });
      }
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
    // viewportKey quantizes viewport changes to prevent pan storms
  }, [
    apiOnline,
    apiBaseUrl,
    selectedCountry,
    viewportKey,
    sectorFilter,
    isDriverWorkspace,
    isPendingStaff,
    openNowOnly,
    sessionToken,
    sessionHydrated,
    isBlockedMapVisitor,
    workspaceMode,
    driverWorkspaceAuthorized,
    currentUser?.role,
    currentUser?.countryCode,
  ]);

  function clearBlockingDriverFiltersForOffers(
    offers: readonly DispatchRequestSummary[],
  ) {
    if (offers.length === 0) return;
    const currentFilter = driverQueueFilterRef.current;
    const currentSearch = mapSearchQueryRef.current.trim().toLowerCase();
    const hasVisibleMatch = offers.some(
      (item) =>
        doesDispatchMatchQueueFilter(item, currentFilter) &&
        doesDispatchMatchSearch(item, currentSearch),
    );
    if (hasVisibleMatch) return;

    let nextFilter = currentFilter;
    if (
      currentFilter !== "ALL" &&
      !offers.some((item) => doesDispatchMatchQueueFilter(item, currentFilter))
    ) {
      nextFilter = "ALL";
      driverQueueFilterRef.current = "ALL";
      setDriverQueueFilter("ALL");
    }
    if (
      currentSearch &&
      !offers.some(
        (item) =>
          doesDispatchMatchQueueFilter(item, nextFilter) &&
          doesDispatchMatchSearch(item, currentSearch),
      )
    ) {
      mapSearchQueryRef.current = "";
      setMapSearchQuery("");
    }
  }

  function applySyncedDispatchList(
    data: DispatchListResponse,
    opts: {
      driverMode: boolean;
      userId: string;
      userRole: string;
      fetchStartedAtMs: number;
      dutySeqAtFetch: number;
      revealMode: "none" | "new" | "all";
    },
  ) {
    const isVerifiedDriver = opts.driverMode && opts.userRole === "DRIVER";
    const activeFromServer = isVerifiedDriver
      ? (data.dispatches.find(
          (item) =>
            item.driverUserId === opts.userId &&
            (item.status === "ASSIGNED" ||
              item.status === "EN_ROUTE" ||
              item.status === "ARRIVED"),
        ) ?? null)
      : null;

    const inferredDutyStatus: DriverStatus | undefined = isVerifiedDriver
      ? (data.driverDutyStatus ??
        (activeFromServer
          ? activeFromServer.status === "ASSIGNED"
            ? "ASSIGNED"
            : "EN_ROUTE"
          : undefined))
      : undefined;

    if (
      isVerifiedDriver &&
      inferredDutyStatus &&
      dutyStatusMutationSeqRef.current === opts.dutySeqAtFetch
    ) {
      driverStatusRef.current = inferredDutyStatus;
      setDriverStatus(inferredDutyStatus);
    }
    if (isVerifiedDriver) {
      driverDutyHydratedRef.current = true;
      setDriverDutyHydrated(true);
    }

    const effectiveDutyStatus = driverStatusRef.current;
    const nowMs = Date.now();
    const visibleItems = data.dispatches.filter((item) => {
      if (
        isVerifiedDriver &&
        effectiveDutyStatus === "OFF_DUTY" &&
        item.status === "REQUESTED"
      ) {
        return false;
      }
      return (
        (item.driverUserId === opts.userId && item.status !== "REQUESTED") ||
        !declinedDispatchIdsRef.current.has(item.id)
      );
    });

    if (opts.driverMode) {
      for (const item of visibleItems) {
        syncOfferDeadline(item, nowMs, true);
      }
      setOfferClockNowMs(nowMs);
      if (
        effectiveDutyStatus !== "OFF_DUTY" &&
        !activeFromServer &&
        opts.revealMode !== "none"
      ) {
        const openOffers = visibleItems.filter(
          (item) => item.status === "REQUESTED",
        );
        const offersToReveal =
          opts.revealMode === "all"
            ? openOffers
            : openOffers.filter(
                (item) => !knownVisibleOfferIdsRef.current.has(item.id),
              );
        if (offersToReveal.length > 0) {
          clearBlockingDriverFiltersForOffers(offersToReveal);
        }
      }
    }

    setDispatches((prev) => {
      const merged = new Map<string, DispatchRequestSummary>();
      for (const item of visibleItems) {
        merged.set(item.id, item);
      }
      for (const existing of prev) {
        const sseAt = lastSseArrivalMsRef.current.get(existing.id) ?? 0;
        if (
          !merged.has(existing.id) &&
          sseAt >= opts.fetchStartedAtMs - 500 &&
          !declinedDispatchIdsRef.current.has(existing.id) &&
          !(
            effectiveDutyStatus === "OFF_DUTY" &&
            existing.status === "REQUESTED"
          )
        ) {
          merged.set(existing.id, existing);
        }
      }
      return Array.from(merged.values());
    });
  }

  const applySyncedDispatchListRef = useRef(applySyncedDispatchList);
  applySyncedDispatchListRef.current = applySyncedDispatchList;
  const clearBlockingDriverFiltersRef = useRef(
    clearBlockingDriverFiltersForOffers,
  );
  clearBlockingDriverFiltersRef.current = clearBlockingDriverFiltersForOffers;

  // 3. Initial session dispatch list (subsequent updates arrive over SSE)
  useEffect(() => {
    if (
      !apiOnline ||
      !sessionHydrated ||
      isBlockedMapVisitor ||
      !sessionToken ||
      !currentUser ||
      isPendingStaff ||
      (workspaceMode === "driver" && !driverWorkspaceAuthorized)
    ) {
      return;
    }
    let active = true;
    const scopedCountry =
      currentUser.role === "OPS_ADMIN"
        ? selectedCountry
        : currentUser.countryCode;

    const fetchStartedAtMs = Date.now();
    const dutySeqAtFetch = dutyStatusMutationSeqRef.current;
    void listDispatchRequests(apiBaseUrl, sessionToken, scopedCountry).then(
      (dispRes) => {
        if (!active) return;
        if (!dispRes.ok) {
          if (isDriverWorkspace && currentUser.role === "DRIVER") {
            driverDutyHydratedRef.current = true;
            setDriverDutyHydrated(true);
          }
          return;
        }
        applySyncedDispatchListRef.current(dispRes.data, {
          driverMode: isDriverWorkspace,
          userId: currentUser.id,
          userRole: currentUser.role,
          fetchStartedAtMs,
          dutySeqAtFetch,
          revealMode: "none",
        });
      },
    );

    return () => {
      active = false;
    };
  }, [
    apiOnline,
    apiBaseUrl,
    selectedCountry,
    sessionToken,
    sessionHydrated,
    isBlockedMapVisitor,
    isPendingStaff,
    isDriverWorkspace,
    workspaceMode,
    driverWorkspaceAuthorized,
    currentUser?.id,
    currentUser?.role,
    currentUser?.countryCode,
  ]);

  // Live Server-Sent Events Subscription (zero setInterval polling)
  useEffect(() => {
    if (
      !apiOnline ||
      !sessionHydrated ||
      isBlockedMapVisitor ||
      (workspaceMode === "driver" && !driverWorkspaceAuthorized) ||
      !sessionToken ||
      isPendingStaff ||
      typeof EventSource === "undefined"
    ) {
      setStreamConnected(false);
      return;
    }

    const scopedStreamCountry =
      currentUser?.role === "OPS_ADMIN" ? selectedCountry : undefined;
    const streamUrl = `${apiBaseUrl}/v1/dispatch/stream?token=${encodeURIComponent(
      sessionToken,
    )}${scopedStreamCountry ? `&countryCode=${encodeURIComponent(scopedStreamCountry)}` : ""}`;
    const es = new EventSource(streamUrl);
    let active = true;
    let hasConnectedOnce = false;

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

        if (
          isDriverWorkspace &&
          currentUser?.role === "DRIVER" &&
          incoming.driverId === currentUser.id &&
          !(incoming.status === "OFF_DUTY" && activeDriverTripRef.current)
        ) {
          const prevDuty = driverStatusRef.current;
          dutyStatusMutationSeqRef.current += 1;
          driverStatusRef.current = incoming.status;
          setDriverStatus(incoming.status);
          driverDutyHydratedRef.current = true;
          setDriverDutyHydrated(true);
          if (incoming.status === "OFF_DUTY") {
            setDispatches((prev) =>
              prev.filter((item) => item.status !== "REQUESTED"),
            );
            setSelectedDispatchId((prev) =>
              activeDriverTripRef.current &&
              prev === activeDriverTripRef.current.id
                ? prev
                : null,
            );
          } else if (prevDuty === "OFF_DUTY" && incoming.status === "AVAILABLE") {
            const resyncStartedAtMs = Date.now();
            const dutySeqAtFetch = dutyStatusMutationSeqRef.current;
            void listDispatchRequests(
              apiBaseUrl,
              sessionToken,
              currentUser.countryCode,
            ).then((dispRes) => {
              if (!active || !dispRes.ok) return;
              applySyncedDispatchListRef.current(dispRes.data, {
                driverMode: true,
                userId: currentUser.id,
                userRole: currentUser.role,
                fetchStartedAtMs: resyncStartedAtMs,
                dutySeqAtFetch,
                revealMode: "all",
              });
            });
          }
        }
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

        if (
          isDriverWorkspace &&
          incoming.status === "REQUESTED" &&
          driverStatusRef.current === "OFF_DUTY"
        ) {
          return;
        }

        const nowMs = Date.now();
        lastSseArrivalMsRef.current.set(incoming.id, nowMs);
        if (isDriverWorkspace) {
          syncOfferDeadline(incoming, nowMs, true);
        }

        const hiddenForDriver =
          isDriverWorkspace &&
          (declinedDispatchIdsRef.current.has(incoming.id) ||
            (incoming.status !== "REQUESTED" &&
              incoming.driverUserId !== currentUser?.id));
        const isNewLiveOfferForDriver =
          isDriverWorkspace &&
          !hiddenForDriver &&
          incoming.status === "REQUESTED" &&
          !activeDriverTripRef.current &&
          !knownVisibleOfferIdsRef.current.has(incoming.id);

        if (hiddenForDriver || incoming.status !== "REQUESTED") {
          knownVisibleOfferIdsRef.current.delete(incoming.id);
        } else if (isDriverWorkspace) {
          knownVisibleOfferIdsRef.current.add(incoming.id);
        }

        setDispatches((prev) => {
          if (hiddenForDriver) {
            offerDeadlinesRef.current.delete(incoming.id);
            return prev.filter((item) => item.id !== incoming.id);
          }
          const idx = prev.findIndex((item) => item.id === incoming.id);
          if (idx === -1) {
            return [incoming, ...prev];
          }
          return prev.map((item) => (item.id === incoming.id ? incoming : item));
        });

        if (
          isDriverWorkspace &&
          currentUser?.role === "DRIVER" &&
          incoming.driverUserId === currentUser.id
        ) {
          if (incoming.status === "ASSIGNED") {
            dutyStatusMutationSeqRef.current += 1;
            driverStatusRef.current = "ASSIGNED";
            setDriverStatus("ASSIGNED");
            driverDutyHydratedRef.current = true;
            setDriverDutyHydrated(true);
          } else if (
            incoming.status === "EN_ROUTE" ||
            incoming.status === "ARRIVED"
          ) {
            dutyStatusMutationSeqRef.current += 1;
            driverStatusRef.current = "EN_ROUTE";
            setDriverStatus("EN_ROUTE");
            driverDutyHydratedRef.current = true;
            setDriverDutyHydrated(true);
          } else if (
            incoming.status === "COMPLETED" ||
            incoming.status === "CANCELLED"
          ) {
            const wasActiveMission =
              activeDriverTripRef.current?.id === incoming.id ||
              driverStatusRef.current === "ASSIGNED" ||
              driverStatusRef.current === "EN_ROUTE";
            if (wasActiveMission) {
              activeDriverTripRef.current = null;
              dutyStatusMutationSeqRef.current += 1;
              driverStatusRef.current = "AVAILABLE";
              setDriverStatus("AVAILABLE");
              driverDutyHydratedRef.current = true;
              setDriverDutyHydrated(true);
              setSelectedDispatchId((prev) =>
                prev === incoming.id ? null : prev,
              );
              const resyncStartedAtMs = Date.now();
              const dutySeqAtFetch = dutyStatusMutationSeqRef.current;
              void listDispatchRequests(
                apiBaseUrl,
                sessionToken,
                currentUser.countryCode,
              ).then((dispRes) => {
                if (!active || !dispRes.ok) return;
                applySyncedDispatchListRef.current(dispRes.data, {
                  driverMode: true,
                  userId: currentUser.id,
                  userRole: currentUser.role,
                  fetchStartedAtMs: resyncStartedAtMs,
                  dutySeqAtFetch,
                  revealMode: "all",
                });
              });
            }
          }
        }

        if (isNewLiveOfferForDriver) {
          setOfferClockNowMs(nowMs);
          setSelectedDispatchId(incoming.id);
          setDriverSidebarTab("radar");
          setDetailCardOpen(false);
          clearBlockingDriverFiltersRef.current([incoming]);
          focusCoordinatesOnMap(incoming.pickupLat, incoming.pickupLng);
          setBanner({
            tone: "info",
            text: copyRef.current.liveDemandArrived,
          });
        }
      } catch {
        // Ignore malformed SSE payload
      }
    };

    const handleOfferExpired = (event: MessageEvent<string>) => {
      try {
        const parsed = DispatchStreamEventSchema.safeParse(
          JSON.parse(event.data),
        );
        if (!parsed.success || parsed.data.type !== "dispatch.offer_expired") {
          return;
        }
        const expiredId = parsed.data.dispatchId;
        const wasVisibleOffer = knownVisibleOfferIdsRef.current.has(expiredId);
        knownVisibleOfferIdsRef.current.delete(expiredId);
        declinedDispatchIdsRef.current.add(expiredId);
        offerDeadlinesRef.current.delete(expiredId);

        setDispatches((prev) =>
          prev.filter(
            (item) => !(item.id === expiredId && item.status === "REQUESTED"),
          ),
        );
        setSelectedDispatchId((prev) => (prev === expiredId ? null : prev));
        if (wasVisibleOffer) {
          setBanner({
            tone: "info",
            text: copyRef.current.offerExpiredAutoRefused,
          });
        }
      } catch {
        // Ignore malformed SSE payload
      }
    };

    const handleSnapshot = () => {
      setStreamConnected(true);
      if (hasConnectedOnce) {
        const scopedCountry =
          currentUser?.role === "OPS_ADMIN"
            ? selectedCountry
            : currentUser?.countryCode;
        if (scopedCountry && currentUser) {
          const resyncStartedAtMs = Date.now();
          const dutySeqAtFetch = dutyStatusMutationSeqRef.current;
          void listDispatchRequests(apiBaseUrl, sessionToken, scopedCountry).then(
            (dispRes) => {
              if (!active || !dispRes.ok) return;
              applySyncedDispatchListRef.current(dispRes.data, {
                driverMode: isDriverWorkspace,
                userId: currentUser.id,
                userRole: currentUser.role,
                fetchStartedAtMs: resyncStartedAtMs,
                dutySeqAtFetch,
                revealMode: "new",
              });
            },
          );
        }
      }
      hasConnectedOnce = true;
    };

    es.addEventListener("snapshot", handleSnapshot);
    es.addEventListener("driver.location", handleDriverLocation as EventListener);
    es.addEventListener(
      "dispatch.updated",
      handleDispatchUpdated as EventListener,
    );
    es.addEventListener(
      "dispatch.offer_expired",
      handleOfferExpired as EventListener,
    );
    es.onerror = () => setStreamConnected(false);

    return () => {
      active = false;
      es.close();
      setStreamConnected(false);
    };
  }, [
    apiBaseUrl,
    apiOnline,
    sessionToken,
    sessionHydrated,
    isBlockedMapVisitor,
    workspaceMode,
    driverWorkspaceAuthorized,
    isPendingStaff,
    isDriverWorkspace,
    currentUser?.id,
    currentUser?.role,
    currentUser?.countryCode,
    selectedCountry,
    setBanner,
  ]);

  async function handleQuickDriverStatus(nextStatus: DriverStatus) {
    if (!driverDutyHydratedRef.current && currentUser?.role === "DRIVER") {
      return;
    }
    if (nextStatus === "OFF_DUTY" && activeDriverTrip) {
      setBanner({
        tone: "info",
        text: copyRef.current.activeMissionDutyLockNotice,
      });
      return;
    }
    const previousStatus = driverStatusRef.current;
    dutyStatusMutationSeqRef.current += 1;
    driverStatusRef.current = nextStatus;
    setDriverStatus(nextStatus);
    driverDutyHydratedRef.current = true;
    setDriverDutyHydrated(true);
    if (!sessionToken || currentUser?.role !== "DRIVER") return;
    setBusy(true);
    const res = await sendDriverLocationPing(apiBaseUrl, sessionToken, {
      lat: effectiveDriverCoords.lat,
      lng: effectiveDriverCoords.lng,
      status: nextStatus,
    });
    setBusy(false);
    if (!res.ok) {
      dutyStatusMutationSeqRef.current += 1;
      driverStatusRef.current = previousStatus;
      setDriverStatus(previousStatus);
      if (res.status === 409 && /ACTIVE_MISSION_DUTY_LOCK/i.test(res.error)) {
        void resyncDriverLiveQueue();
        setBanner({
          tone: "info",
          text: copyRef.current.activeMissionDutyLockNotice,
        });
        return;
      }
      setBanner({
        tone: "error",
        text: `Status update failed (${res.error}).`,
      });
      return;
    }
    if (nextStatus === "OFF_DUTY") {
      setDispatches((prev) =>
        prev.filter((item) => item.status !== "REQUESTED"),
      );
      setSelectedDispatchId((prev) =>
        activeDriverTripRef.current && prev === activeDriverTripRef.current.id
          ? prev
          : null,
      );
    } else if (nextStatus === "AVAILABLE" && previousStatus === "OFF_DUTY") {
      void resyncDriverLiveQueue({ revealIncomingOffers: true });
    }
    setBanner({
      tone: "success",
      text:
        nextStatus === "OFF_DUTY"
          ? copyRef.current.driverOffDutyNotice
          : copyRef.current.driverOnlineNotice,
    });
  }

  async function refreshDriverPapers() {
    if (!sessionToken || currentUser?.role !== "DRIVER") return;
    const res = await listMyUserMedia(apiBaseUrl, sessionToken);
    if (res.ok) {
      setDriverUserMedia(res.data.documents);
    }
  }

  useEffect(() => {
    if (!apiOnline || !sessionToken || currentUser?.role !== "DRIVER") {
      setDriverUserMedia([]);
      return;
    }
    let cancelled = false;
    void listMyUserMedia(apiBaseUrl, sessionToken).then((res) => {
      if (!cancelled && res.ok) {
        setDriverUserMedia(res.data.documents);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, apiOnline, sessionToken, currentUser?.id, currentUser?.role]);

  function handleUseDriverBrowserGps() {
    if (
      !sessionToken ||
      currentUser?.role !== "DRIVER" ||
      !driverDutyHydratedRef.current ||
      driverStatusRef.current === "OFF_DUTY"
    ) {
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !("geolocation" in navigator) ||
      typeof navigator.geolocation.getCurrentPosition !== "function"
    ) {
      setBanner({
        tone: "info",
        text: copyRef.current.gpsUnavailableNotice,
      });
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const liveStatus = driverStatusRef.current;
        if (liveStatus === "OFF_DUTY") {
          setBusy(false);
          return;
        }
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        setDriverLat(nextLat.toFixed(5));
        setDriverLng(nextLng.toFixed(5));
        focusCoordinatesOnMap(nextLat, nextLng);
        void sendDriverLocationPing(apiBaseUrl, sessionToken, {
          lat: nextLat,
          lng: nextLng,
          status: liveStatus,
        }).then((res) => {
          setBusy(false);
          if (res.ok) {
            setBanner({
              tone: "success",
              text: `Live GPS locked (${res.data.driver.lat.toFixed(4)}, ${res.data.driver.lng.toFixed(4)}).`,
            });
          } else {
            setBanner({
              tone: "error",
              text: `GPS sync failed (${res.error}).`,
            });
          }
        });
      },
      () => {
        setBusy(false);
        setBanner({
          tone: "info",
          text: copyRef.current.gpsDeniedNotice,
        });
      },
      { enableHighAccuracy: true, timeout: 4500, maximumAge: 30_000 },
    );
  }

  // Continuous background GPS beacon streaming when toggled on by the driver
  useEffect(() => {
    if (
      !autoGpsActive ||
      !sessionToken ||
      currentUser?.role !== "DRIVER" ||
      !driverDutyHydrated ||
      driverStatus === "OFF_DUTY"
    ) {
      if (autoGpsActive && driverStatus === "OFF_DUTY") {
        setAutoGpsActive(false);
      }
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !("geolocation" in navigator) ||
      typeof navigator.geolocation.watchPosition !== "function"
    ) {
      setAutoGpsActive(false);
      setBanner({
        tone: "info",
        text: "Device geolocation unavailable for live GPS streaming.",
      });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const liveStatus = driverStatusRef.current;
        if (liveStatus === "OFF_DUTY") return;
        const now = Date.now();
        if (now - lastAutoPingMsRef.current < 15_000) return;
        lastAutoPingMsRef.current = now;
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        setDriverLat(nextLat.toFixed(5));
        setDriverLng(nextLng.toFixed(5));
        void sendDriverLocationPing(apiBaseUrl, sessionToken, {
          lat: nextLat,
          lng: nextLng,
          status: liveStatus,
        });
      },
      () => {
        setAutoGpsActive(false);
        setBanner({
          tone: "info",
          text: "Live Auto-GPS paused: browser location permission unavailable.",
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 10_000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [
    apiBaseUrl,
    autoGpsActive,
    currentUser?.role,
    driverDutyHydrated,
    driverStatus,
    sessionToken,
    setBanner,
  ]);

  async function resyncDriverLiveQueue(options?: {
    revealIncomingOffers?: boolean;
  }) {
    if (!sessionToken || !currentUser || isPendingStaff) return;
    const scopedCountry =
      currentUser.role === "OPS_ADMIN"
        ? selectedCountry
        : currentUser.countryCode;
    const center = getViewportCenter(viewport);
    const fetchStartedAtMs = Date.now();
    const dutySeqAtFetch = dutyStatusMutationSeqRef.current;
    const [syncedDispatches, syncedDrivers] = await Promise.all([
      listDispatchRequests(apiBaseUrl, sessionToken, scopedCountry),
      queryNearbyDrivers(apiBaseUrl, sessionToken, {
        countryCode: scopedCountry,
        lat: center.lat,
        lng: center.lng,
        radiusKm: 100,
      }),
    ]);
    if (syncedDispatches.ok) {
      applySyncedDispatchListRef.current(syncedDispatches.data, {
        driverMode: isDriverWorkspace,
        userId: currentUser.id,
        userRole: currentUser.role,
        fetchStartedAtMs,
        dutySeqAtFetch,
        revealMode: options?.revealIncomingOffers ? "all" : "none",
      });
    }
    if (syncedDrivers.ok) {
      setDrivers(syncedDrivers.data.drivers);
      setRedisQueryMs(syncedDrivers.data.queryMs);
    }
  }

  async function handleAutoRefuseExpired(dispatchId: string) {
    if (
      !sessionToken ||
      autoRefusingIdsRef.current.has(dispatchId) ||
      pendingTransitionRef.current.has(dispatchId)
    ) {
      return;
    }
    autoRefusingIdsRef.current.add(dispatchId);
    knownVisibleOfferIdsRef.current.delete(dispatchId);
    declinedDispatchIdsRef.current.add(dispatchId);
    offerDeadlinesRef.current.delete(dispatchId);

    setDispatches((prev) =>
      prev.filter(
        (item) => !(item.id === dispatchId && item.status === "REQUESTED"),
      ),
    );
    setSelectedDispatchId((prev) => (prev === dispatchId ? null : prev));
    setBanner({
      tone: "info",
      text: copyRef.current.offerExpiredAutoRefused,
    });

    try {
      await declineDispatchRequest(
        apiBaseUrl,
        sessionToken,
        dispatchId,
        "AUTO_TIMEOUT_60S",
      );
    } finally {
      autoRefusingIdsRef.current.delete(dispatchId);
    }
  }

  async function handleTransition(
    dispatchId: string,
    nextStatus: "ASSIGNED" | "EN_ROUTE" | "ARRIVED" | "COMPLETED" | "CANCELLED",
  ) {
    if (!sessionToken || pendingTransitionRef.current.has(dispatchId)) return;
    pendingTransitionRef.current.add(dispatchId);
    setPendingDispatchIds(Array.from(pendingTransitionRef.current));
    setBusy(true);
    try {
      const res = await updateDispatchStatus(
        apiBaseUrl,
        sessionToken,
        dispatchId,
        nextStatus,
      );

      if (!res.ok) {
        if (res.status === 409 && currentUser) {
          const isOfferExpired = /EXPIRED/i.test(res.error);
          if (isOfferExpired) {
            knownVisibleOfferIdsRef.current.delete(dispatchId);
            declinedDispatchIdsRef.current.add(dispatchId);
            offerDeadlinesRef.current.delete(dispatchId);
            setDispatches((prev) => prev.filter((d) => d.id !== dispatchId));
            setSelectedDispatchId((prev) => (prev === dispatchId ? null : prev));
          }
          await resyncDriverLiveQueue();
          setBanner({
            tone: "info",
            text: isOfferExpired
              ? copyRef.current.offerExpiredAutoRefused
              : "Another driver claimed this dispatch or an active trip is already underway — live queue synced.",
          });
          return;
        }
        setBanner({
          tone: "error",
          text: `Dispatch update failed (${res.error}).`,
        });
        return;
      }

      offerDeadlinesRef.current.delete(dispatchId);
      setDispatches((prev) =>
        prev.map((d) => (d.id === dispatchId ? res.data.dispatch : d)),
      );

      if (nextStatus === "ASSIGNED") {
        setSelectedDispatchId(res.data.dispatch.id);
        if (isDriverWorkspace) {
          dutyStatusMutationSeqRef.current += 1;
          driverStatusRef.current = "ASSIGNED";
          setDriverStatus("ASSIGNED");
        }
        setBanner({
          tone: "success",
          text: "Client pickup accepted. Follow the route pin to the client location.",
        });
      } else if (nextStatus === "EN_ROUTE" && isDriverWorkspace) {
        dutyStatusMutationSeqRef.current += 1;
        driverStatusRef.current = "EN_ROUTE";
        setDriverStatus("EN_ROUTE");
      } else if (nextStatus === "COMPLETED" && isDriverWorkspace) {
        activeDriverTripRef.current = null;
        setSelectedDispatchId((prev) => (prev === dispatchId ? null : prev));
        dutyStatusMutationSeqRef.current += 1;
        driverStatusRef.current = "AVAILABLE";
        setDriverStatus("AVAILABLE");
        void resyncDriverLiveQueue({ revealIncomingOffers: true });
      }
    } finally {
      pendingTransitionRef.current.delete(dispatchId);
      setPendingDispatchIds(Array.from(pendingTransitionRef.current));
      setBusy(false);
    }
  }

  async function handleDecline(dispatchId: string) {
    if (!sessionToken || pendingTransitionRef.current.has(dispatchId)) return;
    pendingTransitionRef.current.add(dispatchId);
    setPendingDispatchIds(Array.from(pendingTransitionRef.current));
    setBusy(true);
    try {
      const res = await declineDispatchRequest(
        apiBaseUrl,
        sessionToken,
        dispatchId,
      );
      if (!res.ok) {
        if (res.status === 409) {
          await resyncDriverLiveQueue();
          setBanner({
            tone: "info",
            text: "This request was already updated — live queue synced.",
          });
          return;
        }
        setBanner({
          tone: "error",
          text: `Unable to decline request (${res.error}).`,
        });
        return;
      }

      knownVisibleOfferIdsRef.current.delete(dispatchId);
      declinedDispatchIdsRef.current.add(dispatchId);
      offerDeadlinesRef.current.delete(dispatchId);
      setDispatches((prev) => prev.filter((d) => d.id !== dispatchId));
      setSelectedDispatchId((prev) => (prev === dispatchId ? null : prev));
      if (res.data.releasedToQueue && isDriverWorkspace) {
        activeDriverTripRef.current = null;
        dutyStatusMutationSeqRef.current += 1;
        driverStatusRef.current = "AVAILABLE";
        setDriverStatus("AVAILABLE");
        void resyncDriverLiveQueue({ revealIncomingOffers: true });
      }
      setBanner({
        tone: "info",
        text: res.data.releasedToQueue
          ? "Assigned ride released back to nearby available drivers."
          : "Client pickup declined. It remains open for other nearby drivers.",
      });
    } finally {
      pendingTransitionRef.current.delete(dispatchId);
      setPendingDispatchIds(Array.from(pendingTransitionRef.current));
      setBusy(false);
    }
  }

  function detectAutoPickupLocation(explicit = false) {
    const center = getViewportCenter(viewport);
    if (!pickupPin || explicit) {
      setPickupPin(center);
      setPickupSource("AREA");
      setPickupLabel(viewport.districtLabel);
    }

    if (
      typeof navigator === "undefined" ||
      !("geolocation" in navigator) ||
      typeof navigator.geolocation.getCurrentPosition !== "function"
    ) {
      if (explicit) {
        setBanner({
          tone: "info",
          text: `Using ${viewport.districtLabel} as pickup area. Tap anywhere on the map to move your pin.`,
        });
      }
      return;
    }

    setDetectingPickup(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDetectingPickup(false);
        const { latitude, longitude } = pos.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        const nearbyCity = MAP_CITY_PRESETS.find((preset) =>
          isCoordinateNearViewport(latitude, longitude, preset, 0.25, 0.3),
        );
        const distFromViewKm = calcDistanceKm(
          center.lat,
          center.lng,
          latitude,
          longitude,
        );

        // Keep Moroccan/regional map context cohesive unless explicitly re-detected
        if (distFromViewKm <= 800 || explicit) {
          setPickupPin({ lat: latitude, lng: longitude });
          setPickupSource("GPS");
          setPickupLabel(nearbyCity?.city ?? "Live GPS Location");
          focusLocationExact(latitude, longitude);
        }
      },
      () => {
        setDetectingPickup(false);
        if (explicit) {
          setBanner({
            tone: "info",
            text: `Location permission unavailable — using ${viewport.districtLabel}. Tap anywhere on the map to adjust your pickup pin.`,
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 4500,
        maximumAge: 60_000,
      },
    );
  }

  function openFastBookPanel(facilityIdOverride?: string) {
    if (facilityIdOverride !== undefined) {
      setFastBookFacilityId(facilityIdOverride);
    }
    setDetailCardOpen(false);
    setFastBookOpen(true);
    detectAutoPickupLocation(false);
  }

  async function handleFastBookSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const effectivePickup = pickupPin ?? getViewportCenter(viewport);
    const areaTitle =
      pickupSource === "GPS"
        ? "Live GPS"
        : pickupSource === "PIN"
          ? "Pinned Map"
          : pickupLabel || viewport.districtLabel;
    const autoPickupAddress = `${areaTitle} (${effectivePickup.lat.toFixed(4)}, ${effectivePickup.lng.toFixed(4)})`;
    const resolvedTargetId =
      fastBookFacilityId || autoClosestFacility?.facility.id || "";

    if (!sessionToken) {
      const code = `SOS-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      addGuestActivityPass({
        id: `guest-fb-${Date.now()}`,
        kind: "FAST_BOOK",
        countryCode: selectedCountry,
        title: "Medical Pickup Alert",
        landmarkOrFacility: autoPickupAddress,
        scheduledAtIso: new Date().toISOString(),
        trackingCode: code,
        statusLabel: "Broadcasted",
      });
      setFastBookOpen(false);
      setBanner({
        tone: "success",
        text: `1-Tap Fast Book (${code}) broadcasted to nearby ambulances around ${autoPickupAddress}.`,
      });
      return;
    }

    setBusy(true);
    const res = await createDispatchRequest(apiBaseUrl, sessionToken, {
      ...(currentUser?.role === "OPS_ADMIN"
        ? { countryCode: selectedCountry }
        : {}),
      pickupLat: effectivePickup.lat,
      pickupLng: effectivePickup.lng,
      pickupAddress: autoPickupAddress,
      urgency: "URGENT",
      ...(resolvedTargetId ? { targetFacilityId: resolvedTargetId } : {}),
    });
    setBusy(false);

    if (!res.ok) {
      setBanner({
        tone: "error",
        text: `Fast Book failed (${res.error}).`,
      });
      return;
    }

    setDispatches((prev) => [res.data.dispatch, ...prev]);
    setSelectedDispatchId(res.data.dispatch.id);
    setFastBookOpen(false);
    setBanner({
      tone: "success",
      text: `1-Tap Fast Book broadcasted (${res.data.dispatch.pickupAddress}).`,
    });
  }

  const visibleDrivers = useMemo(
    () =>
      openNowOnly ? drivers.filter((d) => d.status === "AVAILABLE") : drivers,
    [drivers, openNowOnly],
  );

  const searchableFacilities = useMemo<ViewportFacilityItem[]>(() => {
    const merged = new Map<string, ViewportFacilityItem>();
    for (const fac of facilities) {
      merged.set(fac.id, fac);
    }
    for (const fac of directoryFacilities) {
      if (merged.has(fac.id)) continue;
      merged.set(fac.id, {
        id: fac.id,
        name: fac.name,
        kind: fac.kind,
        countryCode: fac.countryCode,
        licenseNumber: fac.licenseNumber,
        verificationStatus: fac.verificationStatus,
        openStatus:
          fac.openStatus === "BUSY" || fac.openStatus === "CLOSED"
            ? fac.openStatus
            : "OPEN",
        address: fac.address,
        lat: fac.lat,
        lng: fac.lng,
        specialties: [],
        phone: null,
        is24_7: false,
        acceptsEmergency: fac.kind === "HOSPITAL",
        ownerUserId: "",
        distanceMeters: null,
        createdAtIso: "2026-01-01T00:00:00.000Z",
      });
    }
    return Array.from(merged.values());
  }, [facilities, directoryFacilities]);

  const transportUnits = useMemo(() => {
    const markerById = new Map(drivers.map((d) => [d.driverId, d]));
    const center = getViewportCenter(viewport);
    const facilityPool =
      searchableFacilities.length > 0 ? searchableFacilities : facilities;
    const mapped = directoryDrivers
      .map((drv, idx) => {
        const marker = markerById.get(drv.id);
        const status = marker?.status ?? drv.liveStatus ?? "AVAILABLE";
        const matchedFacility =
          (drv.facilityId
            ? facilityPool.find((f) => f.id === drv.facilityId)
            : undefined) ??
          (drv.facilityName
            ? facilityPool.find((f) => {
                const needle = drv.facilityName!.trim().toLowerCase();
                const target = f.name.trim().toLowerCase();
                return (
                  target.includes(needle) ||
                  needle.includes(target) ||
                  needle.split(" ")[0] === target.split(" ")[0]
                );
              })
            : undefined);
        const angle = idx * 2.1 + 0.65;
        const offsetLat = Math.sin(angle) * 0.0042;
        const offsetLng = Math.cos(angle) * 0.0052;
        const resolvedLat =
          marker?.lat ??
          (matchedFacility
            ? Number((matchedFacility.lat + offsetLat).toFixed(5))
            : Number((center.lat + offsetLat * 1.35).toFixed(5)));
        const resolvedLng =
          marker?.lng ??
          (matchedFacility
            ? Number((matchedFacility.lng + offsetLng).toFixed(5))
            : Number((center.lng + offsetLng * 1.35).toFixed(5)));
        const resolvedDistanceKm =
          marker?.distanceKm ??
          Number(
            calcDistanceKm(center.lat, center.lng, resolvedLat, resolvedLng).toFixed(1),
          );
        return {
          id: drv.id,
          fullName: drv.fullName,
          avatarUrl: drv.avatarUrl,
          vehicleType: drv.vehicleType,
          vehicleLabel: drv.vehicleLabel,
          serviceZone: drv.serviceZone,
          facilityName: drv.facilityName ?? drv.countryCode,
          countryCode: drv.countryCode,
          status,
          lat: resolvedLat,
          lng: resolvedLng,
          distanceKm: resolvedDistanceKm,
        };
      })
      .filter((unit) => (openNowOnly ? unit.status === "AVAILABLE" : true));

    const seen = new Set(mapped.map((unit) => unit.id));
    for (const marker of visibleDrivers) {
      if (!seen.has(marker.driverId)) {
        mapped.push({
          id: marker.driverId,
          fullName: `Unit ${marker.driverId.slice(0, 6).toUpperCase()}`,
          avatarUrl: null,
          vehicleType: "AMBULANCE",
          vehicleLabel: "Live GPS Transport Unit",
          serviceZone: "Active Viewport Zone",
          facilityName: selectedCountry,
          countryCode: marker.countryCode,
          status: marker.status,
          lat: marker.lat,
          lng: marker.lng,
          distanceKm: marker.distanceKm,
        });
      }
    }
    return mapped;
  }, [
    directoryDrivers,
    drivers,
    visibleDrivers,
    searchableFacilities,
    facilities,
    viewport,
    openNowOnly,
    selectedCountry,
  ]);

  const normalizedSearch = mapSearchQuery.trim().toLowerCase();

  const filteredTransportUnits = useMemo(() => {
    if (!normalizedSearch) return transportUnits;
    return transportUnits.filter((unit) =>
      matchesAccentInsensitiveQuery(normalizedSearch, [
        unit.fullName,
        unit.vehicleLabel,
        unit.serviceZone,
        unit.facilityName,
      ]),
    );
  }, [transportUnits, normalizedSearch]);

  const filteredDoctors = useMemo(() => {
    if (!normalizedSearch) return directoryDoctors;
    return directoryDoctors.filter((doc) =>
      matchesAccentInsensitiveQuery(normalizedSearch, [
        doc.fullName,
        doc.specialty,
        doc.facilityName,
        doc.facilityCity,
        expandMoroccanCityKeywords(doc.facilityCity),
      ]),
    );
  }, [directoryDoctors, normalizedSearch]);

  const filteredFacilities = useMemo(() => {
    if (!normalizedSearch) return facilities;
    return facilities.filter((fac) =>
      matchesAccentInsensitiveQuery(normalizedSearch, [
        fac.name,
        fac.address,
        fac.kind,
      ]),
    );
  }, [facilities, normalizedSearch]);

  const doctorPins = useMemo<LiveDoctorPin[]>(() => {
    const facMap = new Map(searchableFacilities.map((fac) => [fac.id, fac]));
    const center = getViewportCenter(viewport);
    return filteredDoctors.map((doc, idx) => {
      const matched = doc.facilityId ? facMap.get(doc.facilityId) : undefined;
      const spreadLat = (((idx % 3) - 1) * 0.0022);
      const spreadLng = ((Math.floor(idx / 3) % 3) - 1) * 0.0026;
      return {
        id: doc.id,
        name: doc.fullName,
        specialty: doc.specialty,
        facilityId: doc.facilityId ?? "",
        facilityName: doc.facilityName ?? selectedCountry,
        lat: matched ? matched.lat + spreadLat : center.lat + spreadLat * 2,
        lng: matched ? matched.lng + spreadLng : center.lng + spreadLng * 2,
      };
    });
  }, [filteredDoctors, searchableFacilities, selectedCountry, viewport]);

  const visibleDoctorPins = useMemo(
    () =>
      doctorPins.filter(
        (pin) =>
          pin.id === selectedDoctorId ||
          isCoordinateNearViewport(pin.lat, pin.lng, viewport),
      ),
    [doctorPins, selectedDoctorId, viewport],
  );

  const locationSearchResults = useMemo<MapSearchSuggestion[]>(() => {
    if (!normalizedSearch) return [];
    const results: MapSearchSuggestion[] = [];
    const facCityById = new Map(directoryFacilities.map((f) => [f.id, f.city]));
    const facMatches = searchableFacilities.filter((fac) => {
      if (openNowOnly && fac.openStatus !== "OPEN") return false;
      const city = facCityById.get(fac.id);
      return matchesAccentInsensitiveQuery(normalizedSearch, [
        fac.name,
        fac.address,
        city,
        expandMoroccanCityKeywords(city),
        fac.kind,
        formatFacilityKind(fac.kind, locale),
      ]);
    });
    for (const fac of facMatches.slice(0, 6)) {
      results.push({
        key: `fac-${fac.id}`,
        targetType: "FACILITY",
        id: fac.id,
        title: fac.name,
        subtitle: `${formatFacilityKind(fac.kind, locale)} · ${fac.address}`,
        badge: formatOpenStatus(fac.openStatus, locale),
        lat: fac.lat,
        lng: fac.lng,
        targetLayer: fac.kind,
      });
    }

    const pinMap = new Map(doctorPins.map((p) => [p.id, p]));
    const facLookup = new Map(searchableFacilities.map((f) => [f.id, f]));
    const center = getViewportCenter(viewport);
    const docMatches = directoryDoctors.filter((doc) =>
      matchesAccentInsensitiveQuery(normalizedSearch, [
        doc.fullName,
        doc.specialty,
        formatSpecialtyLabel(doc.specialty, locale),
        getSpecialtyKeywords(doc.specialty),
        doc.facilityName,
        doc.facilityCity,
        expandMoroccanCityKeywords(doc.facilityCity),
      ]),
    );
    const practitionerBadge =
      locale === "ar"
        ? "طبيب / ممرض"
        : locale === "fr"
          ? "Médecin / Infirmier"
          : "Doctor / Nurse";
    for (const doc of docMatches.slice(0, 4)) {
      const pin = pinMap.get(doc.id);
      const fac = doc.facilityId ? facLookup.get(doc.facilityId) : undefined;
      results.push({
        key: `doc-${doc.id}`,
        targetType: "DOCTOR",
        id: doc.id,
        title: doc.fullName,
        subtitle: `${formatSpecialtyLabel(doc.specialty, locale)} · ${doc.facilityName ?? doc.countryCode}`,
        badge: practitionerBadge,
        lat: pin?.lat ?? fac?.lat ?? center.lat,
        lng: pin?.lng ?? fac?.lng ?? center.lng,
        targetLayer: "DOCTOR",
      });
    }
    return results.slice(0, 8);
  }, [
    normalizedSearch,
    searchableFacilities,
    directoryFacilities,
    directoryDoctors,
    doctorPins,
    openNowOnly,
    viewport,
    locale,
  ]);

  const destinationHospitalAndClinicPool = useMemo(
    () =>
      searchableFacilities.filter(
        (fac) => fac.kind === "HOSPITAL" || fac.kind === "CLINIC",
      ),
    [searchableFacilities],
  );

  const driverDestinationFacilities = useMemo(() => {
    const merged = new Map<string, ViewportFacilityItem>();
    for (const fac of facilities) {
      if (fac.kind === "HOSPITAL" || fac.kind === "CLINIC") {
        merged.set(fac.id, fac);
      }
    }
    for (const fac of cachedViewportFacilities) {
      if (
        (fac.kind === "HOSPITAL" || fac.kind === "CLINIC") &&
        !merged.has(fac.id)
      ) {
        merged.set(fac.id, fac);
      }
    }
    const neededTargetIds = new Set(
      dispatches
        .filter((d) => d.status !== "COMPLETED" && d.status !== "CANCELLED")
        .map((d) => d.targetFacilityId)
        .filter((id): id is string => Boolean(id)),
    );
    const viewportEmpty = merged.size === 0;
    for (const fac of destinationHospitalAndClinicPool) {
      if (merged.has(fac.id)) continue;
      if (viewportEmpty || neededTargetIds.has(fac.id)) {
        merged.set(fac.id, fac);
      }
    }
    return Array.from(merged.values()).filter((fac) => {
      if (neededTargetIds.has(fac.id) || fac.id === selectedFacilityId) {
        return true;
      }
      if (openNowOnly && fac.openStatus !== "OPEN") {
        return false;
      }
      if (
        normalizedSearch &&
        !`${fac.name} ${fac.address} ${fac.kind}`
          .toLowerCase()
          .includes(normalizedSearch)
      ) {
        return false;
      }
      return true;
    });
  }, [
    facilities,
    cachedViewportFacilities,
    destinationHospitalAndClinicPool,
    dispatches,
    selectedFacilityId,
    openNowOnly,
    normalizedSearch,
  ]);

  const autoClosestFacility = useMemo(() => {
    if (destinationHospitalAndClinicPool.length === 0) return null;
    const refPoint = pickupPin ?? getViewportCenter(viewport);
    const sorted = [...destinationHospitalAndClinicPool].sort((a, b) => {
      const aOpen = a.openStatus === "OPEN" ? 0 : 1;
      const bOpen = b.openStatus === "OPEN" ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      return (
        calcDistanceKm(refPoint.lat, refPoint.lng, a.lat, a.lng) -
        calcDistanceKm(refPoint.lat, refPoint.lng, b.lat, b.lng)
      );
    });
    const best = sorted[0]!;
    return {
      facility: best,
      distanceKm: calcDistanceKm(refPoint.lat, refPoint.lng, best.lat, best.lng),
    };
  }, [destinationHospitalAndClinicPool, pickupPin, viewport]);

  const selectedFastBookFacility = useMemo(
    () =>
      fastBookFacilityId
        ? (destinationHospitalAndClinicPool.find(
            (f) => f.id === fastBookFacilityId,
          ) ?? null)
        : null,
    [fastBookFacilityId, destinationHospitalAndClinicPool],
  );

  const effectiveAutoPickup: AutoDetectedPickupState = useMemo(() => {
    const fallbackCenter = getViewportCenter(viewport);
    const coords = pickupPin ?? fallbackCenter;
    return {
      lat: coords.lat,
      lng: coords.lng,
      label: pickupLabel || viewport.districtLabel,
      source: pickupSource,
      detecting: detectingPickup,
    };
  }, [viewport, pickupPin, pickupLabel, pickupSource, detectingPickup]);

  const activeDriverTrip = useMemo(
    () =>
      dispatches.find(
        (d) =>
          d.driverUserId === currentUser?.id &&
          (d.status === "ASSIGNED" ||
            d.status === "EN_ROUTE" ||
            d.status === "ARRIVED"),
      ) ?? null,
    [dispatches, currentUser?.id],
  );
  useEffect(() => {
    activeDriverTripRef.current = activeDriverTrip;
  }, [activeDriverTrip]);

  const effectiveDriverCoords = useMemo(() => {
    const liveSelf = currentUser?.id
      ? drivers.find((d) => d.driverId === currentUser.id)
      : undefined;
    if (liveSelf) {
      return { lat: liveSelf.lat, lng: liveSelf.lng };
    }
    const parsedLat = Number.parseFloat(driverLat);
    const parsedLng = Number.parseFloat(driverLng);
    return {
      lat: Number.isFinite(parsedLat) ? parsedLat : initialCenter.lat,
      lng: Number.isFinite(parsedLng) ? parsedLng : initialCenter.lng,
    };
  }, [drivers, currentUser?.id, driverLat, driverLng, initialCenter.lat, initialCenter.lng]);

  const driverPendingOffersAll = useMemo(() => {
    if (driverStatus === "OFF_DUTY" || activeDriverTrip) {
      return [];
    }
    const urgencyRank: Record<DispatchUrgency, number> = {
      EMERGENCY: 0,
      URGENT: 1,
      ROUTINE: 2,
    };
    return dispatches
      .filter(
        (d) =>
          d.status === "REQUESTED" && !declinedDispatchIdsRef.current.has(d.id),
      )
      .sort((a, b) => {
        const uDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
        if (uDiff !== 0) return uDiff;
        return b.createdAtIso.localeCompare(a.createdAtIso);
      });
  }, [dispatches, driverStatus, activeDriverTrip]);

  useEffect(() => {
    knownVisibleOfferIdsRef.current = new Set(
      driverPendingOffersAll.map((item) => item.id),
    );
  }, [driverPendingOffersAll]);

  const driverPendingCounts = useMemo(() => {
    let ems = 0;
    let courier = 0;
    for (const item of driverPendingOffersAll) {
      if (isPharmacyCourierDispatch(item)) {
        courier += 1;
      } else {
        ems += 1;
      }
    }
    return { all: driverPendingOffersAll.length, ems, courier };
  }, [driverPendingOffersAll]);

  const driverPendingOffersFiltered = useMemo(() => {
    return driverPendingOffersAll.filter((d) => {
      if (driverQueueFilter === "COURIER" && !isPharmacyCourierDispatch(d)) {
        return false;
      }
      if (driverQueueFilter === "EMS" && isPharmacyCourierDispatch(d)) {
        return false;
      }
      if (!doesDispatchMatchSearch(d, normalizedSearch)) {
        return false;
      }
      return true;
    });
  }, [driverPendingOffersAll, driverQueueFilter, normalizedSearch]);

  const driverClientQueue = useMemo(
    () => (activeDriverTrip ? [activeDriverTrip] : driverPendingOffersFiltered),
    [activeDriverTrip, driverPendingOffersFiltered],
  );

  // Enforce the 60-second live accept/refuse window: smooth countdown + automatic refusal at 0s
  useEffect(() => {
    if (
      !isDriverWorkspace ||
      currentUser?.role !== "DRIVER" ||
      isPendingStaff ||
      driverStatus === "OFF_DUTY" ||
      activeDriverTrip ||
      driverPendingOffersAll.length === 0
    ) {
      return;
    }

    let expiryTimeout: number | null = null;

    const scheduleNextExpiry = (now: number) => {
      if (expiryTimeout !== null) {
        window.clearTimeout(expiryTimeout);
        expiryTimeout = null;
      }
      let earliestDeadline = Infinity;
      for (const item of driverPendingOffersAll) {
        syncOfferDeadline(item, now, false);
        const deadline = offerDeadlinesRef.current.get(item.id);
        if (
          deadline !== undefined &&
          deadline > now &&
          deadline < earliestDeadline
        ) {
          earliestDeadline = deadline;
        }
      }
      if (Number.isFinite(earliestDeadline)) {
        const delayMs = Math.max(25, earliestDeadline - now + 20);
        expiryTimeout = window.setTimeout(() => {
          evaluateExpiries();
        }, delayMs);
      }
    };

    const evaluateExpiries = () => {
      const now = Date.now();
      setOfferClockNowMs(now);
      for (const item of driverPendingOffersAll) {
        syncOfferDeadline(item, now, false);
        const deadline = offerDeadlinesRef.current.get(item.id);
        if (deadline !== undefined && now >= deadline) {
          void handleAutoRefuseExpired(item.id);
        }
      }
      scheduleNextExpiry(now);
    };

    evaluateExpiries();
    const interval = window.setInterval(evaluateExpiries, 1000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        evaluateExpiries();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      if (expiryTimeout !== null) {
        window.clearTimeout(expiryTimeout);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    isDriverWorkspace,
    currentUser?.role,
    isPendingStaff,
    driverStatus,
    activeDriverTrip,
    driverPendingOffersAll,
    sessionToken,
    apiBaseUrl,
  ]);

  const driverCompletedCount = useMemo(
    () =>
      dispatches.filter(
        (d) =>
          d.driverUserId === currentUser?.id &&
          (d.status === "COMPLETED" || d.status === "CANCELLED"),
      ).length,
    [dispatches, currentUser?.id],
  );

  const driverPendingPapersCount = useMemo(
    () =>
      driverUserMedia.filter(
        (d) => d.category !== "AVATAR" && d.reviewStatus === "PENDING_REVIEW",
      ).length,
    [driverUserMedia],
  );

  const currentDriverFleetInfo = useMemo(
    () =>
      currentUser
        ? (directoryDrivers.find((d) => d.id === currentUser.id) ?? null)
        : null,
    [currentUser, directoryDrivers],
  );

  const driverClientPins = useMemo<ClientDispatchPin[]>(
    () =>
      driverClientQueue.map((d) => ({
        id: d.id,
        pickupLat: d.pickupLat,
        pickupLng: d.pickupLng,
        pickupAddress: d.pickupAddress,
        urgency: d.urgency,
        status: d.status,
        targetFacilityId: d.targetFacilityId,
        driverUserId: d.driverUserId,
      })),
    [driverClientQueue],
  );

  const focusedDispatch = useMemo(
    () =>
      activeDriverTrip ??
      (selectedDispatchId
        ? driverPendingOffersFiltered.find((d) => d.id === selectedDispatchId)
        : null) ??
      driverPendingOffersFiltered[0] ??
      null,
    [selectedDispatchId, driverPendingOffersFiltered, activeDriverTrip],
  );

  const focusedDestinationFacility = useMemo(
    () =>
      resolveDispatchDestinationFromList(
        focusedDispatch,
        driverDestinationFacilities,
      ),
    [focusedDispatch, driverDestinationFacilities],
  );

  const patientTrackedDispatch = useMemo(() => {
    if (isDriverWorkspace || !currentUser) return null;
    const active = dispatches.filter(
      (d) => d.status !== "COMPLETED" && d.status !== "CANCELLED",
    );
    if (active.length === 0) return null;
    return (
      (selectedDispatchId
        ? active.find((d) => d.id === selectedDispatchId)
        : null) ??
      active.find((d) => d.driverUserId !== null) ??
      active[0] ??
      null
    );
  }, [isDriverWorkspace, currentUser, dispatches, selectedDispatchId]);

  const patientAssignedDriver = useMemo(() => {
    if (!patientTrackedDispatch?.driverUserId) return null;
    return (
      drivers.find((d) => d.driverId === patientTrackedDispatch.driverUserId) ??
      null
    );
  }, [drivers, patientTrackedDispatch]);

  const patientDestinationFacility = useMemo(
    () =>
      resolveDispatchDestinationFromList(
        patientTrackedDispatch,
        destinationHospitalAndClinicPool.length > 0
          ? destinationHospitalAndClinicPool
          : driverDestinationFacilities,
      ),
    [
      patientTrackedDispatch,
      destinationHospitalAndClinicPool,
      driverDestinationFacilities,
    ],
  );

  const patientClientPins = useMemo<ClientDispatchPin[]>(() => {
    if (isDriverWorkspace || !patientTrackedDispatch) return [];
    return [
      {
        id: patientTrackedDispatch.id,
        pickupLat: patientTrackedDispatch.pickupLat,
        pickupLng: patientTrackedDispatch.pickupLng,
        pickupAddress: patientTrackedDispatch.pickupAddress,
        urgency: patientTrackedDispatch.urgency,
        status: patientTrackedDispatch.status,
        targetFacilityId:
          patientTrackedDispatch.targetFacilityId ??
          patientDestinationFacility?.id ??
          null,
        driverUserId: patientTrackedDispatch.driverUserId,
      },
    ];
  }, [isDriverWorkspace, patientTrackedDispatch, patientDestinationFacility]);

  const mapFacilities = useMemo(() => {
    if (isDriverWorkspace) {
      return driverLayer === "CLIENTS" ? [] : driverDestinationFacilities;
    }
    if (sectorFilter !== "DRIVER" && sectorFilter !== "DOCTOR") {
      if (
        selectedFacilityId &&
        !filteredFacilities.some((f) => f.id === selectedFacilityId)
      ) {
        const extraSelected = searchableFacilities.find(
          (f) => f.id === selectedFacilityId && f.kind === sectorFilter,
        );
        if (extraSelected) {
          return [extraSelected, ...filteredFacilities];
        }
      }
      return filteredFacilities;
    }
    if (sectorFilter === "DRIVER") {
      if (fastBookOpen) {
        return destinationHospitalAndClinicPool;
      }
      return patientDestinationFacility ? [patientDestinationFacility] : [];
    }
    return [];
  }, [
    isDriverWorkspace,
    driverLayer,
    driverDestinationFacilities,
    destinationHospitalAndClinicPool,
    fastBookOpen,
    sectorFilter,
    filteredFacilities,
    selectedFacilityId,
    searchableFacilities,
    patientDestinationFacility,
  ]);

  const mapDrivers = useMemo(() => {
    if (isDriverWorkspace) {
      if (driverLayer === "DESTINATIONS") return [];
      const selfMarkers = visibleDrivers.filter(
        (d) => d.driverId === currentUser?.id,
      );
      if (selfMarkers.length > 0) return selfMarkers;
      const latNum = Number.parseFloat(driverLat);
      const lngNum = Number.parseFloat(driverLng);
      if (
        currentUser?.id &&
        Number.isFinite(latNum) &&
        Number.isFinite(lngNum)
      ) {
        return [
          {
            driverId: currentUser.id,
            countryCode: selectedCountry,
            lat: latNum,
            lng: lngNum,
            headingDeg: 0,
            status: driverStatus,
            distanceKm: 0,
            recordedAtIso: new Date().toISOString(),
          },
        ];
      }
      return [];
    }
    if (sectorFilter === "DRIVER") {
      const allowedIds = new Set(filteredTransportUnits.map((u) => u.id));
      const matchedLive = visibleDrivers.filter((d) =>
        normalizedSearch ? allowedIds.has(d.driverId) : true,
      );
      const liveIds = new Set(matchedLive.map((d) => d.driverId));
      const fallbackUnits: LiveDriverMarker[] = filteredTransportUnits
        .filter((u) => !liveIds.has(u.id))
        .map((u) => ({
          driverId: u.id,
          countryCode: u.countryCode,
          lat: u.lat,
          lng: u.lng,
          headingDeg: 45,
          status: u.status,
          distanceKm: u.distanceKm,
          recordedAtIso: "2026-01-01T00:00:00.000Z",
        }));
      const combined = [...matchedLive, ...fallbackUnits].filter(
        (d) =>
          d.driverId === patientAssignedDriver?.driverId ||
          d.driverId === selectedDriverId ||
          isCoordinateNearViewport(d.lat, d.lng, viewport),
      );
      if (
        patientAssignedDriver &&
        !combined.some((d) => d.driverId === patientAssignedDriver.driverId)
      ) {
        return [patientAssignedDriver, ...combined];
      }
      return combined;
    }
    return patientAssignedDriver ? [patientAssignedDriver] : [];
  }, [
    isDriverWorkspace,
    driverLayer,
    visibleDrivers,
    driverLat,
    driverLng,
    driverStatus,
    selectedCountry,
    filteredTransportUnits,
    normalizedSearch,
    currentUser?.id,
    sectorFilter,
    patientAssignedDriver,
    selectedDriverId,
    viewport,
  ]);

  const driverPinLabels = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        transportUnits.map((unit) => [unit.id, unit.fullName]),
      ),
    [transportUnits],
  );

  const selectedEntityData = useMemo<MapSelectedEntity | null>(() => {
    if (!detailCardOpen) return null;
    const center = getViewportCenter(viewport);

    const resolveEnrichedFacility = (
      id: string,
    ): MapEnrichedFacility | null => {
      const base =
        searchableFacilities.find((f) => f.id === id) ??
        facilities.find((f) => f.id === id);
      if (!base) return null;
      const dir = directoryFacilities.find((d) => d.id === id);
      return {
        ...base,
        ...(dir
          ? {
              acceptedInsurances: dir.acceptedInsurances,
              languagesSpoken: dir.languagesSpoken,
              telehealthEnabled: dir.telehealthEnabled,
              homeVisitEnabled: dir.homeVisitEnabled,
            }
          : {}),
      };
    };

    if (!isDriverWorkspace && selectedDriverId) {
      const unit = transportUnits.find((u) => u.id === selectedDriverId);
      const live = drivers.find((d) => d.driverId === selectedDriverId);
      const dir = directoryDrivers.find((d) => d.id === selectedDriverId);
      if (unit || live || dir) {
        const lat = unit?.lat ?? live?.lat ?? center.lat;
        const lng = unit?.lng ?? live?.lng ?? center.lng;
        const matchedFac =
          (dir?.facilityId ? resolveEnrichedFacility(dir.facilityId) : null) ??
          (unit?.facilityName
            ? searchableFacilities.find((f) => f.name === unit.facilityName) ??
              null
            : null);
        return {
          kind: "DRIVER",
          id: selectedDriverId,
          fullName:
            unit?.fullName ??
            dir?.fullName ??
            `Unit ${selectedDriverId.slice(0, 6).toUpperCase()}`,
          avatarUrl: unit?.avatarUrl ?? dir?.avatarUrl ?? null,
          vehicleType: unit?.vehicleType ?? dir?.vehicleType ?? "AMBULANCE",
          vehicleLabel:
            unit?.vehicleLabel ?? dir?.vehicleLabel ?? "Medical Transport Unit",
          serviceZone:
            unit?.serviceZone ?? dir?.serviceZone ?? viewport.districtLabel,
          facilityId: dir?.facilityId ?? matchedFac?.id ?? null,
          facilityName:
            unit?.facilityName ??
            dir?.facilityName ??
            matchedFac?.name ??
            selectedCountry,
          facilityAddress: matchedFac?.address ?? null,
          countryCode:
            unit?.countryCode ??
            live?.countryCode ??
            dir?.countryCode ??
            selectedCountry,
          status: unit?.status ?? live?.status ?? dir?.liveStatus ?? "AVAILABLE",
          lat,
          lng,
          distanceKm:
            unit?.distanceKm ??
            live?.distanceKm ??
            Number(calcDistanceKm(center.lat, center.lng, lat, lng).toFixed(1)),
          email: dir?.email ?? null,
          recordedAtIso: live?.recordedAtIso ?? null,
        };
      }
    }

    if (!isDriverWorkspace && selectedDoctorId) {
      const doc = directoryDoctors.find((d) => d.id === selectedDoctorId);
      if (doc) {
        const pin = doctorPins.find((p) => p.id === doc.id);
        const facility = doc.facilityId
          ? resolveEnrichedFacility(doc.facilityId)
          : null;
        const lat = pin?.lat ?? facility?.lat ?? center.lat;
        const lng = pin?.lng ?? facility?.lng ?? center.lng;
        const packCurrency =
          packs.find((p) => p.code === doc.countryCode)?.currencyCode ?? "MAD";
        return {
          kind: "DOCTOR",
          doctor: doc,
          facility,
          lat,
          lng,
          distanceKm: Number(
            calcDistanceKm(center.lat, center.lng, lat, lng).toFixed(1),
          ),
          currencyCode: packCurrency,
        };
      }
    }

    if (selectedFacilityId) {
      const fac = resolveEnrichedFacility(selectedFacilityId);
      if (fac) {
        const activePack =
          packs.find((p) => p.code === fac.countryCode) ?? packs[0];
        const staffDoctors = directoryDoctors.filter(
          (d) => d.facilityId === fac.id,
        );
        return {
          kind: "FACILITY",
          facility: fac,
          distanceKm:
            fac.distanceMeters !== null
              ? Number((fac.distanceMeters / 1000).toFixed(1))
              : Number(
                  calcDistanceKm(center.lat, center.lng, fac.lat, fac.lng).toFixed(
                    1,
                  ),
                ),
          emergencyHotline: activePack?.emergencyHotlines.ambulance ?? "",
          staffDoctors,
        };
      }
    }

    return null;
  }, [
    isDriverWorkspace,
    detailCardOpen,
    viewport,
    searchableFacilities,
    facilities,
    directoryFacilities,
    selectedDriverId,
    transportUnits,
    drivers,
    directoryDrivers,
    selectedCountry,
    selectedDoctorId,
    directoryDoctors,
    doctorPins,
    packs,
    selectedFacilityId,
  ]);

  const previewRoutePoints = useMemo(() => {
    if (isDriverWorkspace || patientTrackedDispatch) {
      return { origin: null, destination: null };
    }
    if (fastBookOpen) {
      const target = selectedFastBookFacility ?? autoClosestFacility?.facility ?? null;
      if (!target) return { origin: null, destination: null };
      return {
        origin: { lat: effectiveAutoPickup.lat, lng: effectiveAutoPickup.lng },
        destination: {
          lat: target.lat,
          lng: target.lng,
          label: target.name,
          legKind: "dropoff" as const,
        },
      };
    }
    if (detailCardOpen || routePreviewLocked) {
      if (!isDriverWorkspace && selectedDriverId) {
        const drvUnit = transportUnits.find((u) => u.id === selectedDriverId);
        const drvLive = drivers.find((d) => d.driverId === selectedDriverId);
        const lat = drvUnit?.lat ?? drvLive?.lat;
        const lng = drvUnit?.lng ?? drvLive?.lng;
        if (lat !== undefined && lng !== undefined) {
          return {
            origin: { lat, lng },
            destination: {
              lat: effectiveAutoPickup.lat,
              lng: effectiveAutoPickup.lng,
              label:
                drvUnit?.fullName ??
                `${copy.unitLabel} ${selectedDriverId.slice(0, 6).toUpperCase()}`,
              legKind: "pickup" as const,
            },
          };
        }
      }
      if (!isDriverWorkspace && selectedDoctorId) {
        const doc = directoryDoctors.find((d) => d.id === selectedDoctorId);
        const pin = doctorPins.find((p) => p.id === selectedDoctorId);
        const fac = doc?.facilityId
          ? searchableFacilities.find((f) => f.id === doc.facilityId)
          : undefined;
        const lat = pin?.lat ?? fac?.lat;
        const lng = pin?.lng ?? fac?.lng;
        if (doc && lat !== undefined && lng !== undefined) {
          return {
            origin: { lat: effectiveAutoPickup.lat, lng: effectiveAutoPickup.lng },
            destination: {
              lat,
              lng,
              label: doc.fullName,
              legKind: "dropoff" as const,
            },
          };
        }
      }
      if (selectedFacilityId) {
        const fac = searchableFacilities.find((f) => f.id === selectedFacilityId);
        if (fac) {
          return {
            origin: { lat: effectiveAutoPickup.lat, lng: effectiveAutoPickup.lng },
            destination: {
              lat: fac.lat,
              lng: fac.lng,
              label: fac.name,
              legKind: "dropoff" as const,
            },
          };
        }
      }
    }
    return { origin: null, destination: null };
  }, [
    isDriverWorkspace,
    patientTrackedDispatch,
    fastBookOpen,
    selectedFastBookFacility,
    autoClosestFacility,
    effectiveAutoPickup,
    detailCardOpen,
    routePreviewLocked,
    selectedDriverId,
    transportUnits,
    drivers,
    copy.unitLabel,
    selectedDoctorId,
    directoryDoctors,
    doctorPins,
    searchableFacilities,
    selectedFacilityId,
  ]);

  if (workspaceMode === "driver" && (!currentUser || !driverWorkspaceAuthorized)) {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="h-full overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-5">
          <section className="space-y-4 rounded-2xl border border-[#D7E4F2] bg-white p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D7E4F2] bg-[#F3F8FD] text-[#0066CC] ">
                <Ambulance className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono-tabular text-xs font-semibold uppercase tracking-wider text-[#0066CC]">
                  {copy.driverGateEyebrow}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
                  {copy.driverGateHeading}
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {copy.driverGateDesc}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/pro?tab=register&role=DRIVER"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#0066CC] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0052A3]"
              >
                {copy.driverGateRegisterCta}
              </Link>
              <Link
                href="/map"
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-2xs transition-colors hover:text-[#0066CC]"
              >
                {copy.driverGatePublicMapCta}
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (workspaceMode === "driver" && currentUser && isPendingStaff) {
    return (
      <div dir={isRtl ? "rtl" : "ltr"} className="h-full overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-2xl space-y-5">
          <SessionAccountBar
            session={session}
            prompt={copy.driverPendingPrompt}
            onSignOut={() => {
              clearStoredSession();
              setSession(null);
              setDrivers([]);
              setDispatches([]);
            }}
          />
          <VerificationGateNotice user={currentUser} />
          {sessionToken ? (
            <DriverCredentialsPanel
              apiBaseUrl={apiBaseUrl}
              token={sessionToken}
              user={currentUser}
              fleetInfo={currentDriverFleetInfo}
              documents={driverUserMedia}
              busy={busy}
              onBusyChange={setBusy}
              onDocumentsUpdated={refreshDriverPapers}
              onFeedback={(tone, text) => setBanner({ tone, text })}
            />
          ) : null}
        </div>
      </div>
    );
  }

  const defaultCityId = getDefaultCityIdForCountry(
    currentUser?.countryCode ?? defaultCode,
  );
  const activeCityPreset =
    getCityPresetById(selectedCityId) ?? MAP_CITY_PRESETS[0]!;
  const isCityFiltered = selectedCityId !== defaultCityId;
  const hasPopoverFilter = openNowOnly || isCityFiltered;
  const hasActiveFilter = Boolean(mapSearchQuery.trim() || hasPopoverFilter);

  function openEntityFacilityById(facilityId: string) {
    const fac = searchableFacilities.find((f) => f.id === facilityId);
    if (!fac) return;
    setSectorFilter(fac.kind);
    setSelectedDriverId(null);
    setSelectedDoctorId(null);
    setSelectedFacilityId(fac.id);
    setDetailCardOpen(true);
    focusLocationExact(fac.lat, fac.lng);
  }

  function openEntityDoctorById(doctorId: string) {
    const doc = directoryDoctors.find((d) => d.id === doctorId);
    if (!doc) return;
    const pin = doctorPins.find((p) => p.id === doc.id);
    const fac = doc.facilityId
      ? searchableFacilities.find((f) => f.id === doc.facilityId)
      : undefined;
    const center = getViewportCenter(viewport);
    setSectorFilter("DOCTOR");
    setSelectedDriverId(null);
    setSelectedFacilityId(null);
    setSelectedDoctorId(doc.id);
    setDetailCardOpen(true);
    focusLocationExact(
      pin?.lat ?? fac?.lat ?? center.lat,
      pin?.lng ?? fac?.lng ?? center.lng,
    );
  }

  function handleSelectSearchSuggestion(item: MapSearchSuggestion) {
    setSectorFilter(item.targetLayer);
    if (item.targetType === "FACILITY") {
      setSelectedDoctorId(null);
      setSelectedDriverId(null);
      setSelectedFacilityId(item.id);
    } else {
      setSelectedFacilityId(null);
      setSelectedDriverId(null);
      setSelectedDoctorId(item.id);
    }
    setSearchDropdownOpen(false);
    setDetailCardOpen(true);
    setRoutePreviewLocked(true);
    focusLocationExact(item.lat, item.lng);
  }

  if (isBlockedMapVisitor) {
    return (
      <div className="h-full overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          <ConsumerWorkspaceGuard
            user={currentUser}
            hydrated={sessionHydrated}
            surfaceTitle="Live Care Map & 1-Tap Fast Book"
            allowRoles={["HOSPITAL_ADMIN", "OPS_ADMIN"]}
            onSignOut={() => {
              setSession(null);
              setDrivers([]);
              setDispatches([]);
            }}
          >
            <div />
          </ConsumerWorkspaceGuard>
        </div>
      </div>
    );
  }

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="relative h-full w-full overflow-hidden">
      {/* Edge-to-Edge Full-Viewport Street Map Canvas */}
      <div className="absolute inset-0">
        <ViewportVectorMap
          countryCode={selectedCountry}
          viewport={viewport}
          activeLayer={sectorFilter}
          driverWorkspaceMode={isDriverWorkspace}
          facilities={mapFacilities}
          allFacilities={
            isDriverWorkspace ? driverDestinationFacilities : searchableFacilities
          }
          drivers={mapDrivers}
          driverLabels={driverPinLabels}
          doctorPins={
            !isDriverWorkspace && sectorFilter === "DOCTOR"
              ? visibleDoctorPins
              : []
          }
          clientPins={
            isDriverWorkspace &&
            !isPendingStaff &&
            driverLayer !== "DESTINATIONS"
              ? driverClientPins
              : patientClientPins
          }
          selectedFacilityId={selectedFacilityId}
          highlightedTargetFacilityId={
            isDriverWorkspace
              ? (focusedDispatch?.targetFacilityId ??
                  focusedDestinationFacility?.id ??
                  null)
              : fastBookOpen
                ? (fastBookFacilityId ||
                    autoClosestFacility?.facility.id ||
                    null)
                : (patientDestinationFacility?.id ?? null)
          }
          pickupPin={
            !isDriverWorkspace &&
            !patientTrackedDispatch &&
            (fastBookOpen || Boolean(previewRoutePoints.destination))
              ? effectiveAutoPickup
              : null
          }
          previewOrigin={previewRoutePoints.origin}
          previewDestination={previewRoutePoints.destination}
          onPickLocation={
            !isDriverWorkspace && fastBookOpen && !patientTrackedDispatch
              ? (lat, lng) => {
                  setPickupPin({ lat, lng });
                  setPickupSource("PIN");
                  setPickupLabel("Pinned Map Location");
                }
              : undefined
          }
          selectedDoctorId={selectedDoctorId}
          selectedDriverId={selectedDriverId}
          selectedDispatchId={
            isDriverWorkspace
              ? (focusedDispatch?.id ?? null)
              : (patientTrackedDispatch?.id ?? null)
          }
          postgisQueryMs={postgisQueryMs}
          redisQueryMs={redisQueryMs}
          busy={busy}
          edgeToEdge
          hudTopPaddingPx={hudTopPaddingPx}
          hudStartOffsetClass=""
          hasSideDrawerOpen={
            Boolean(selectedEntityData) ||
            (isDriverWorkspace && driverSidebarTab !== "radar")
          }
          onSelectFacility={(id) => {
            const fac = searchableFacilities.find((f) => f.id === id);
            if (
              !isDriverWorkspace &&
              fastBookOpen &&
              fac &&
              (fac.kind === "HOSPITAL" || fac.kind === "CLINIC")
            ) {
              setSelectedDriverId(null);
              setSelectedDoctorId(null);
              setSelectedFacilityId(id);
              setFastBookFacilityId(id);
              setDetailCardOpen(false);
              focusCoordinatesOnMap(fac.lat, fac.lng);
              setBanner({
                tone: "info",
                text: `Fast Book destination set to ${fac.name}.`,
              });
              return;
            }
            setSelectedDriverId(null);
            setSelectedDoctorId(null);
            setSelectedFacilityId(id);
            setRoutePreviewLocked(true);
            if (isDriverWorkspace) {
              setDriverSidebarTab("radar");
            }
            setDetailCardOpen(true);
            if (fac) {
              focusCoordinatesOnMap(fac.lat, fac.lng);
            }
          }}
          onSelectDoctor={(id) => {
            setSelectedDriverId(null);
            setSelectedFacilityId(null);
            setSelectedDoctorId(id);
            setRoutePreviewLocked(true);
            if (!isDriverWorkspace) {
              setDetailCardOpen(true);
            }
            const pin = doctorPins.find((p) => p.id === id);
            if (pin) {
              focusCoordinatesOnMap(pin.lat, pin.lng);
            }
          }}
          onSelectDriver={(id) => {
            setSelectedFacilityId(null);
            setSelectedDoctorId(null);
            setSelectedDriverId(id);
            setRoutePreviewLocked(true);
            if (!isDriverWorkspace) {
              setDetailCardOpen(true);
            }
            const drv = transportUnits.find((u) => u.id === id);
            if (drv) {
              focusCoordinatesOnMap(drv.lat, drv.lng);
            }
          }}
          onSelectDispatch={(id) => {
            setSelectedDispatchId(id);
            setSelectedFacilityId(null);
            setDetailCardOpen(false);
            if (isDriverWorkspace) {
              setDriverSidebarTab("radar");
            }
          }}
          onZoom={(factor) => setViewport((box) => zoomViewport(box, factor))}
          onPan={(dLat, dLng) =>
            setViewport((box) => panViewport(box, dLat, dLng))
          }
          onReset={() => setViewport(toViewportBox(activeCityPreset))}
          onViewportChange={setViewport}
        />
      </div>

      {/* Unified Clean Map-Native Floating Pill HUD (Patient & Driver share identical airy chrome) */}
      <section
        ref={topBarRef}
        className="pointer-events-none absolute inset-x-2.5 top-2.5 z-30 flex flex-col gap-1.5 sm:inset-x-3.5 sm:top-3 sm:gap-2"
      >
        {!isDriverWorkspace ? (
          <h1 className="sr-only">{t("map.heading")}</h1>
        ) : null}

        <div
          className={`flex items-center justify-start gap-1.5 sm:gap-2 ${
            isDriverWorkspace
              ? "flex-wrap lg:flex-nowrap"
              : "flex-nowrap"
          }`}
        >
          {/* Standalone Feature 1: Unified Rounded-Full Search + Filters Pill */}
          <div
            ref={searchContainerRef}
            className={`pointer-events-auto relative order-1 flex min-w-0 items-center gap-1.5 ${
              isDriverWorkspace
                ? "flex-1 sm:max-w-[230px] sm:flex-none lg:w-[178px] xl:w-[244px]"
                : "flex-1 sm:max-w-[340px] sm:flex-none xl:w-[340px]"
            }`}
          >
            <div className="flex h-9 w-full min-w-0 items-center gap-1 rounded-full border border-[#D7E4F2] bg-white/97 ps-3 pe-1 shadow-[0_12px_30px_-8px_rgba(15,36,62,0.14)] backdrop-blur-xl xl:h-10 xl:ps-3.5 xl:pe-1.5">
              <Search
                className="h-3.5 w-3.5 shrink-0 text-[#0066CC] xl:h-4 xl:w-4"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label={
                  isDriverWorkspace ? copy.driverSearchAria : copy.searchAria
                }
                value={mapSearchQuery}
                onFocus={() => {
                  if (!isDriverWorkspace) setSearchDropdownOpen(true);
                }}
                onChange={(e) => {
                  const nextQuery = e.target.value;
                  mapSearchQueryRef.current = nextQuery;
                  setMapSearchQuery(nextQuery);
                  if (!isDriverWorkspace) setSearchDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchDropdownOpen(false);
                  } else if (
                    !isDriverWorkspace &&
                    e.key === "Enter" &&
                    locationSearchResults.length > 0
                  ) {
                    e.preventDefault();
                    handleSelectSearchSuggestion(locationSearchResults[0]!);
                  }
                }}
                placeholder={
                  isDriverWorkspace
                    ? copy.driverSearchPlaceholder
                    : copy.searchPlaceholder
                }
                className="min-w-0 flex-1 bg-transparent px-1 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none sm:px-1.5"
              />
              {mapSearchQuery ? (
                <button
                  type="button"
                  aria-label={copy.clearSearchAria}
                  onClick={() => {
                    mapSearchQueryRef.current = "";
                    setMapSearchQuery("");
                    setSearchDropdownOpen(false);
                  }}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
              <span className="h-4 w-px shrink-0 bg-slate-200 xl:h-5" aria-hidden="true" />
              <button
                type="button"
                aria-expanded={filtersOpen}
                aria-label={copy.toggleFiltersAria}
                onClick={() => {
                  setSearchDropdownOpen(false);
                  setFiltersOpen((prev) => !prev);
                }}
                className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors xl:px-2.5 ${
                  filtersOpen || hasPopoverFilter
                    ? "bg-[#0066CC] text-white"
                    : "border border-[#D7E4F2] text-slate-700 hover:bg-[#F3F8FD]"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                <span className={isDriverWorkspace ? "hidden xl:inline" : "hidden sm:inline"}>
                  {isCityFiltered ? activeCityPreset.city : copy.filtersBtn}
                </span>
                {hasPopoverFilter && !filtersOpen ? (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                  />
                ) : null}
              </button>
            </div>

            {/* Live Facility & Doctor Location Search Results Dropdown */}
            {!isDriverWorkspace &&
            searchDropdownOpen &&
            normalizedSearch.length > 0 ? (
              <div
                role="listbox"
                aria-label={copy.matchingListAria}
                className="absolute top-full start-0 z-40 mt-2 max-h-[340px] w-[min(350px,calc(100vw-1.25rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white/98 p-1.5 shadow-2xl backdrop-blur-xl sm:w-[376px] [scrollbar-width:thin]"
              >
                {locationSearchResults.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-slate-500">
                    {copy.noSearchMatchesPrefix} &ldquo;{mapSearchQuery.trim()}&rdquo;.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {locationSearchResults.map((item) => {
                      const ResultIcon = SECTOR_FILTER_ICONS[item.targetLayer];
                      return (
                        <li key={item.key}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={
                              (item.targetType === "FACILITY" &&
                                selectedFacilityId === item.id) ||
                              (item.targetType === "DOCTOR" &&
                                selectedDoctorId === item.id)
                            }
                            onClick={() => handleSelectSearchSuggestion(item)}
                            className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-teal-50/70"
                          >
                            <span
                              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                item.targetType === "DOCTOR"
                                  ? "bg-emerald-50 text-[#0066CC]"
                                  : "bg-teal-50 text-teal-800"
                              }`}
                            >
                              <ResultIcon className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-xs font-bold text-slate-900">
                                  <bdi dir="auto">{item.title}</bdi>
                                </p>
                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  {item.badge}
                                </span>
                              </div>
                              <p className="truncate text-[11px] text-slate-500">
                                <bdi dir="auto">{item.subtitle}</bdi>
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}

            {/* Standalone Filter Popover */}
            {filtersOpen ? (
              <div
                role="dialog"
                aria-label={copy.mapFiltersDialogAria}
                className="absolute top-full start-0 z-40 mt-2 w-[300px] max-w-[calc(100vw-1.5rem)] space-y-3 rounded-2xl border border-slate-200 bg-white/98 p-3.5 shadow-2xl backdrop-blur-xl sm:w-[320px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {copy.mapFiltersTitle}
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

                <div className="space-y-1.5">
                  <span
                    id="map-city-filter"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {copy.cityLabel}
                  </span>
                  <div
                    role="radiogroup"
                    aria-label={copy.filterCityAria}
                    className="flex flex-wrap gap-1.5"
                  >
                    {MAP_CITY_PRESETS.filter(
                      (city) => city.group === "Morocco",
                    ).map((city) => {
                      const active = selectedCityId === city.id;
                      return (
                        <button
                          key={city.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => handleSelectCity(city.id)}
                          className={`inline-flex min-h-[30px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition active:scale-95 ${
                            active
                              ? "border-[#0066CC] bg-[#0066CC] text-white shadow-2xs"
                              : "border-[#D7E4F2] bg-[#F3F8FD] text-[#2F4661] hover:border-[#0066CC] hover:bg-white"
                          }`}
                        >
                          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                          <span>{city.city}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <UiSwitch
                    id="map-open-now"
                    checked={openNowOnly}
                    onChange={setOpenNowOnly}
                    label={
                      isDriverWorkspace
                        ? copy.openDropoffsOnly
                        : sectorFilter === "DRIVER"
                          ? copy.availableDriversOnly
                          : t("map.openNowOnly")
                    }
                  />
                  {hasActiveFilter ? (
                    <button
                      type="button"
                      onClick={() => {
                        mapSearchQueryRef.current = "";
                        setMapSearchQuery("");
                        setOpenNowOnly(false);
                        handleSelectCity(defaultCityId, { silent: true });
                      }}
                      className="text-xs font-semibold text-[#0066CC] hover:underline"
                    >
                      {copy.resetBtn}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Standalone Feature 2: Unified Rounded-Full Layer Selector Pill */}
          <div className="pointer-events-auto order-2 shrink-0 sm:w-auto">
            {isDriverWorkspace ? (
              <UiSelect
                aria-label={copy.driverFocusAria}
                selectSize="sm"
                wrapperClassName="w-[124px] min-[390px]:w-[138px] lg:w-[144px] xl:w-[186px]"
                startIcon={
                  <Ambulance
                    className="h-3.5 w-3.5 text-[#0066CC] xl:h-4 xl:w-4"
                    aria-hidden="true"
                  />
                }
                className="h-9 rounded-full border-[#D7E4F2] bg-white/97 px-2.5 text-xs font-bold text-[#0F243E] shadow-[0_12px_30px_-8px_rgba(15,36,62,0.14)] hover:ring-2 hover:ring-[#0066CC]/20 xl:h-10 xl:px-3.5"
                value={driverLayer}
                onChange={(e) =>
                  setDriverLayer(e.target.value as DriverLayerMode)
                }
              >
                {driverLayerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </UiSelect>
            ) : (
              <UiSelect
                aria-label={copy.serviceCategoryAria}
                selectSize="sm"
                wrapperClassName="w-[126px] min-[390px]:w-[138px] sm:w-[200px] xl:w-[216px]"
                startIcon={(() => {
                  const ActiveIcon = SECTOR_FILTER_ICONS[sectorFilter];
                  return (
                    <ActiveIcon
                      className="h-3.5 w-3.5 text-[#0066CC] xl:h-4 xl:w-4"
                      aria-hidden="true"
                    />
                  );
                })()}
                className="h-9 rounded-full border-[#D7E4F2] bg-white/97 px-2.5 text-xs font-bold text-[#0F243E] shadow-[0_12px_30px_-8px_rgba(15,36,62,0.14)] hover:ring-2 hover:ring-[#0066CC]/20 xl:h-10 xl:px-3.5"
                value={sectorFilter}
                onChange={(e) => {
                  setSectorFilter(e.target.value as MapSectorFilter);
                  setDetailCardOpen(false);
                  setRoutePreviewLocked(false);
                  setSelectedDriverId(null);
                  setSelectedDoctorId(null);
                  setSelectedFacilityId(null);
                }}
              >
                {sectorFilterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </UiSelect>
            )}
          </div>

          {/* Driver Single-Instance Compact Tabs & Duty Pill (inline on lg+, crisp 2nd pill row below lg) */}
          {isDriverWorkspace && currentUser?.role === "DRIVER" ? (
            <div className="order-4 flex w-full items-center justify-between gap-1.5 lg:order-3 lg:w-auto lg:justify-start">
              <div className="pointer-events-auto">
                <DriverTabBar
                  compact
                  activeTab={driverSidebarTab}
                  completedCount={driverCompletedCount}
                  pendingPaperCount={driverPendingPapersCount}
                  onSelectTab={(tab) => {
                    setDriverSidebarTab(tab);
                    if (tab !== "radar") {
                      setDetailCardOpen(false);
                    }
                  }}
                />
              </div>
              <div className="pointer-events-auto inline-flex h-9 shrink-0 items-center gap-0.5 rounded-full border border-[#D7E4F2] bg-white/97 p-1 shadow-[0_12px_30px_-8px_rgba(15,36,62,0.14)] backdrop-blur-xl xl:h-10 xl:gap-1">
                <button
                  type="button"
                  disabled={
                    busy || !driverDutyHydrated || Boolean(activeDriverTrip)
                  }
                  title={
                    activeDriverTrip
                      ? copy.activeMissionDutyLockNotice
                      : undefined
                  }
                  onClick={() =>
                    void handleQuickDriverStatus(
                      driverStatus === "OFF_DUTY" ? "AVAILABLE" : "OFF_DUTY",
                    )
                  }
                  className={`inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] font-bold transition disabled:cursor-not-allowed disabled:opacity-70 xl:h-8 xl:gap-1.5 xl:px-3 ${
                    !driverDutyHydrated
                      ? "bg-slate-100 text-slate-500"
                      : driverStatus === "OFF_DUTY"
                        ? "bg-slate-100 text-slate-600 hover:bg-[#EBF4FF] hover:text-[#0066CC]"
                        : activeDriverTrip || driverStatus === "EN_ROUTE"
                          ? "bg-amber-50 text-amber-900"
                          : "bg-[#E6F7F4] text-[#0B6B5C]"
                  }`}
                >
                  <Power className="h-3 w-3 shrink-0 xl:hidden" aria-hidden="true" />
                  <span
                    aria-hidden="true"
                    className={`hidden h-2 w-2 shrink-0 rounded-full xl:inline-block ${
                      !driverDutyHydrated
                        ? "bg-slate-400 animate-pulse"
                        : driverStatus === "OFF_DUTY"
                          ? "bg-slate-400"
                          : activeDriverTrip || driverStatus === "EN_ROUTE"
                            ? "bg-amber-500 animate-pulse"
                            : "bg-[#0F9D88] animate-pulse"
                    }`}
                  />
                  <span>
                    {!driverDutyHydrated
                      ? copy.syncingDutyStatus
                      : driverStatus === "OFF_DUTY"
                        ? copy.offDutyBtn
                        : activeDriverTrip || driverStatus === "EN_ROUTE"
                          ? copy.enRouteBtn
                          : copy.onlineShortBadge}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={
                    busy || !driverDutyHydrated || driverStatus === "OFF_DUTY"
                  }
                  onClick={handleUseDriverBrowserGps}
                  aria-label={copy.syncGpsAria}
                  title={copy.syncGpsAria}
                  className="hidden h-7 w-7 items-center justify-center rounded-full text-[#0066CC] transition hover:bg-[#EBF4FF] disabled:opacity-40 sm:inline-flex xl:h-8 xl:w-8"
                >
                  <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={
                    busy || !driverDutyHydrated || driverStatus === "OFF_DUTY"
                  }
                  aria-pressed={autoGpsActive}
                  aria-label={copy.autoGpsAria}
                  title={copy.autoGpsAria}
                  onClick={() => setAutoGpsActive((prev) => !prev)}
                  className={`hidden h-7 w-7 items-center justify-center rounded-full transition disabled:opacity-40 sm:inline-flex xl:h-8 xl:w-8 ${
                    autoGpsActive
                      ? "bg-[#E6F7F4] text-[#0F9D88]"
                      : "text-[#556E89] hover:bg-[#F3F8FD] hover:text-[#0066CC]"
                  }`}
                >
                  <Radio
                    className={`h-3.5 w-3.5 ${autoGpsActive ? "animate-pulse" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          ) : null}

          {/* Standalone Feature 3: Compact Rounded-Full User / Sign-In Pill */}
          <div className="pointer-events-auto order-3 ms-auto flex shrink-0 items-center gap-1.5 lg:order-4">
            {currentUser ? (
              <div className="inline-flex h-9 max-w-[190px] items-center gap-1.5 rounded-full border border-[#D7E4F2] bg-white/97 ps-2.5 pe-1 text-xs shadow-[0_12px_30px_-8px_rgba(15,36,62,0.14)] backdrop-blur-xl xl:h-10 xl:ps-3 xl:pe-1.5">
                {isDriverWorkspace ? (
                  <span
                    aria-label={
                      streamConnected
                        ? copy.liveClientFeedBadge
                        : copy.feedSyncedBadge
                    }
                    title={
                      streamConnected
                        ? copy.liveClientFeedBadge
                        : copy.feedSyncedBadge
                    }
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      streamConnected
                        ? "bg-[#0F9D88] animate-pulse"
                        : "bg-slate-400"
                    }`}
                  />
                ) : (
                  <UserCheck
                    className="h-3.5 w-3.5 shrink-0 text-[#0066CC]"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`hidden max-w-[116px] truncate font-semibold text-[#0F243E] ${
                    isDriverWorkspace ? "2xl:inline" : "sm:inline"
                  }`}
                >
                  <bdi dir="auto">{currentUser.fullName}</bdi>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    revokeClientSession(apiBaseUrl);
                    setSession(null);
                    setDrivers([]);
                    setDispatches([]);
                    driverStatusRef.current = "AVAILABLE";
                    setDriverStatus("AVAILABLE");
                    driverDutyHydratedRef.current = false;
                    setDriverDutyHydrated(false);
                    mapSearchQueryRef.current = "";
                    setMapSearchQuery("");
                  }}
                  aria-label={copy.signOutAria}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <div className="inline-flex h-11 items-center gap-1 rounded-full border border-[#D7E4F2] bg-white/97 p-1.5 text-xs shadow-[0_12px_30px_-8px_rgba(15,36,62,0.14)] backdrop-blur-xl">
                <span className="hidden rounded-full bg-[#EBF4FF] px-3 py-1 text-[11px] font-semibold text-[#0052A3] sm:inline">
                  {copy.guestUrgentBadge}
                </span>
                <Link
                  href="/portal"
                  className="inline-flex h-8 items-center rounded-full bg-[#0066CC] px-3.5 text-xs font-semibold text-white transition hover:bg-[#0052A3] sm:px-4"
                >
                  {copy.signInCta}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {selectedEntityData ? (
        <MapEntityDetailsCard
          entity={selectedEntityData}
          hudTopPaddingPx={hudTopPaddingPx}
          cardRef={entityDetailCardRef}
          driverMode={isDriverWorkspace}
          onClose={() => {
            setDetailCardOpen(false);
            setRoutePreviewLocked(false);
            setSelectedDriverId(null);
            setSelectedDoctorId(null);
            setSelectedFacilityId(null);
          }}
          onSelectFacilityById={openEntityFacilityById}
          onSelectDoctorById={openEntityDoctorById}
          {...(isDriverWorkspace
            ? {}
            : {
                onFastBookDestination: (facilityId: string) =>
                  openFastBookPanel(facilityId),
              })}
        />
      ) : null}

      {!isDriverWorkspace ? (
        <PatientDispatchHud
          trackedDispatch={patientTrackedDispatch}
          assignedDriverMarker={patientAssignedDriver}
          assignedDriverDir={
            patientTrackedDispatch?.driverUserId
              ? (directoryDrivers.find(
                  (d) => d.id === patientTrackedDispatch.driverUserId,
                ) ?? null)
              : null
          }
          destinationFacility={patientDestinationFacility}
          autoPickup={effectiveAutoPickup}
          selectedFastBookFacility={selectedFastBookFacility}
          autoClosestFacility={autoClosestFacility}
          fastBookOpen={fastBookOpen}
          busy={busy}
          detailsDrawerOpen={Boolean(selectedEntityData)}
          onOpenFastBook={() => openFastBookPanel()}
          onCloseFastBook={() => setFastBookOpen(false)}
          onRedetectPickup={() => detectAutoPickupLocation(true)}
          onClearSelectedFacility={() => setFastBookFacilityId("")}
          onSubmitFastBook={(e) => void handleFastBookSubmit(e)}
          onCancelDispatch={(dispatchId) =>
            void handleTransition(dispatchId, "CANCELLED")
          }
        />
      ) : (
        <>
          {/* On-Demand Floating Glass Drawer for Trips / Papers (identical footprint to MapEntityDetailsCard) */}
          {driverSidebarTab !== "radar" && currentUser ? (
            <div
              role="dialog"
              aria-modal="false"
              aria-label={
                driverSidebarTab === "trips"
                  ? "Driver Trips History"
                  : "Driver Compliance Papers"
              }
              data-map-hud="true"
              style={
                { ["--hud-top" as string]: `${hudTopPaddingPx}px` } as CSSProperties
              }
              className="pointer-events-auto absolute z-35 overflow-y-auto rounded-2xl max-sm:inset-x-2.5 max-sm:bottom-2.5 max-sm:max-h-[62dvh] sm:top-[var(--hud-top)] sm:start-3.5 sm:w-[376px] sm:max-h-[calc(100%-var(--hud-top)-54px)] [scrollbar-width:thin]"
            >
              {driverSidebarTab === "trips" ? (
                <DriverTripsStatsPanel
                  driverId={currentUser.id}
                  driverStatus={driverStatus}
                  dispatches={dispatches}
                  onClose={() => setDriverSidebarTab("radar")}
                />
              ) : sessionToken ? (
                <DriverCredentialsPanel
                  apiBaseUrl={apiBaseUrl}
                  token={sessionToken}
                  user={currentUser}
                  fleetInfo={currentDriverFleetInfo}
                  documents={driverUserMedia}
                  busy={busy}
                  onBusyChange={setBusy}
                  onDocumentsUpdated={refreshDriverPapers}
                  onFeedback={(tone, text) => setBanner({ tone, text })}
                  onClose={() => setDriverSidebarTab("radar")}
                />
              ) : null}
            </div>
          ) : null}

          {/* Compact Bottom-Start Driver Live Dispatch HUD (Mirrors PatientDispatchHud + 60s Live Offer Timer) */}
          {!isPendingStaff ? (
            <DriverDispatchHud
              driverStatus={driverStatus}
              dutyHydrated={driverDutyHydrated}
              streamConnected={streamConnected}
              autoGpsActive={autoGpsActive}
              driverLat={effectiveDriverCoords.lat}
              driverLng={effectiveDriverCoords.lng}
              activeTrip={activeDriverTrip}
              pendingOffers={driverPendingOffersFiltered}
              totalPendingCount={driverPendingOffersAll.length}
              pendingCounts={driverPendingCounts}
              focusedOffer={activeDriverTrip ? null : focusedDispatch}
              destinationFacility={focusedDestinationFacility}
              resolveDestination={(item) =>
                resolveDispatchDestinationFromList(
                  item,
                  driverDestinationFacilities,
                )
              }
              getRemainingOfferMs={getRemainingOfferMs}
              queueFilter={driverQueueFilter}
              hasActiveSearchFilter={Boolean(normalizedSearch)}
              busy={busy}
              pendingDispatchIds={pendingDispatchIds}
              detailsDrawerOpen={
                Boolean(selectedEntityData) || driverSidebarTab !== "radar"
              }
              hudTopPaddingPx={hudTopPaddingPx}
              onFocusLiveOffer={() => {
                setDriverSidebarTab("radar");
                setDetailCardOpen(false);
              }}
              onQueueFilterChange={(next) => {
                setDriverQueueFilter(next);
                if (
                  next === "ALL" &&
                  mapSearchQueryRef.current.trim() &&
                  driverPendingOffersFiltered.length === 0
                ) {
                  mapSearchQueryRef.current = "";
                  setMapSearchQuery("");
                }
              }}
              onClearSearchFilter={() => {
                mapSearchQueryRef.current = "";
                setMapSearchQuery("");
                if (
                  driverQueueFilterRef.current !== "ALL" &&
                  driverPendingOffersAll.length > 0 &&
                  !driverPendingOffersAll.some((item) =>
                    doesDispatchMatchQueueFilter(
                      item,
                      driverQueueFilterRef.current,
                    ),
                  )
                ) {
                  driverQueueFilterRef.current = "ALL";
                  setDriverQueueFilter("ALL");
                }
              }}
              onSelectOffer={(dispatchId) => {
                setSelectedDispatchId(dispatchId);
                const found = driverPendingOffersFiltered.find(
                  (d) => d.id === dispatchId,
                );
                if (found) {
                  focusCoordinatesOnMap(found.pickupLat, found.pickupLng);
                }
              }}
              onAcceptOffer={(dispatchId) =>
                void handleTransition(dispatchId, "ASSIGNED")
              }
              onRefuseOffer={(dispatchId) => void handleDecline(dispatchId)}
              onAdvanceTrip={(dispatchId, nextStatus) =>
                void handleTransition(dispatchId, nextStatus)
              }
              onReleaseTrip={(dispatchId) => void handleDecline(dispatchId)}
              onToggleStatus={(nextStatus) =>
                void handleQuickDriverStatus(nextStatus)
              }
              onSyncGps={handleUseDriverBrowserGps}
              onToggleAutoGps={() => setAutoGpsActive((prev) => !prev)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
