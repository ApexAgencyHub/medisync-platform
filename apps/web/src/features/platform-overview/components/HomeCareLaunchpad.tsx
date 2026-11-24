"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CountryPack,
  DirectoryDoctorSummary,
  DirectoryDriverSummary,
  FacilityKind,
  LiveDriverMarker,
  ViewportFacilityItem,
} from "@medisync/contracts";
import {
  Ambulance,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Compass,
  FlaskConical,
  Hospital,
  MapPin,
  Navigation,
  Pill,
  Search,
  Stethoscope,
  X,
} from "lucide-react";
import {
  DynamicViewportVectorMap as ViewportVectorMap,
  getCityPresetById,
  getPresetForCountry,
  getViewportCenter,
  locationMatchToViewportBox,
  panViewport,
  queryViewportFacilities,
  toViewportBox,
  zoomViewport,
  type LiveDoctorPin,
  type ViewportBox,
} from "@/features/maps-dispatch";
import {
  checkBackendOnline,
  fetchDirectoryDoctors,
  fetchDirectoryDrivers,
} from "@/shared/api/directory-client";
import {
  ACTIVE_COUNTRY_CODE,
  resolveActivePack,
} from "@/shared/config/deployment";
import {
  searchMoroccanLocations,
  type MoroccanLocationMatch,
} from "@/shared/config/morocco-standards";
import {
  formatDriverStatus,
  formatFacilityKind,
  formatOpenStatus,
  formatRoleLabel,
} from "@/shared/i18n/human-labels";
import { useLocale } from "@/shared/i18n/locale-store";
import { formatSpecialtyLabel } from "@/shared/i18n/specialties";
import {
  resolveDefaultAvatar,
  resolveFacilityPicture,
  resolveVehiclePicture,
} from "@/shared/ui/EntityAvatar";
import { MoroccanPlacePicker } from "@/shared/ui/MoroccanPlacePicker";
import {
  UiBadge,
  UiButton,
  UiLinkButton,
} from "@/shared/ui/primitives";

interface HomeCareLaunchpadProps {
  packs: readonly CountryPack[];
  apiBaseUrl?: string;
}

type HomeMapLayer = "ALL" | FacilityKind | "DOCTOR" | "DRIVER";

type SelectedPreviewEntity =
  | { kind: "FACILITY"; facility: ViewportFacilityItem }
  | { kind: "DOCTOR"; doctor: DirectoryDoctorSummary; lat: number; lng: number }
  | {
      kind: "DRIVER";
      driverId: string;
      fullName: string;
      vehicleLabel: string;
      vehicleType: "AMBULANCE" | "MEDICAL_SHUTTLE";
      serviceZone: string;
      status: LiveDriverMarker["status"];
      lat: number;
      lng: number;
    };

const FALLBACK_CASABLANCA_FACILITIES: readonly ViewportFacilityItem[] = [
  {
    id: "05ec546f-2ded-4f98-a812-5cc6b5694049",
    name: "CHU Ibn Rochd Emergency Hub",
    kind: "HOSPITAL",
    countryCode: "MA",
    licenseNumber: "MA-HOSP-CAS-001",
    verificationStatus: "VERIFIED",
    lat: 33.5835,
    lng: -7.6212,
    address: "1 Rue des Hôpitaux, Casablanca",
    ownerUserId: "00000000-0000-0000-0000-000000000001",
    createdAtIso: "2026-01-01T00:00:00.000Z",
    openStatus: "OPEN",
    is24_7: true,
    acceptsEmergency: true,
    specialties: ["Emergency", "Trauma", "Cardiology"],
    phone: "+212 522 48 20 20",
    distanceMeters: 640,
  },
  {
    id: "d023c641-b740-4725-8af3-535bd87df176",
    name: "Clinique Anfa Cardiology & Care",
    kind: "CLINIC",
    countryCode: "MA",
    licenseNumber: "MA-CLIN-CAS-002",
    verificationStatus: "VERIFIED",
    lat: 33.5912,
    lng: -7.641,
    address: "240 Boulevard d'Anfa, Casablanca",
    ownerUserId: "00000000-0000-0000-0000-000000000002",
    createdAtIso: "2026-01-01T00:00:00.000Z",
    openStatus: "OPEN",
    is24_7: false,
    acceptsEmergency: true,
    specialties: ["Cardiology", "Internal Medicine", "Telehealth"],
    phone: "+212 522 36 80 10",
    distanceMeters: 920,
  },
  {
    id: "c3219022-b90c-49cd-b1b6-f0df1d43c888",
    name: "Pharmacie Maarif 24/7",
    kind: "PHARMACY",
    countryCode: "MA",
    licenseNumber: "MA-PHARM-CAS-003",
    verificationStatus: "VERIFIED",
    lat: 33.5818,
    lng: -7.6348,
    address: "45 Boulevard Bir Anzarane, Casablanca",
    ownerUserId: "00000000-0000-0000-0000-000000000003",
    createdAtIso: "2026-01-01T00:00:00.000Z",
    openStatus: "OPEN",
    is24_7: true,
    acceptsEmergency: false,
    specialties: ["24/7 Duty Pharmacy", "QR Rx Fulfillment"],
    phone: "+212 522 98 44 12",
    distanceMeters: 780,
  },
  {
    id: "1368f0ab-e7b0-4e21-8a20-726ec2d42822",
    name: "Labo BioCasablanca Imagerie",
    kind: "DIAGNOSTIC_LAB",
    countryCode: "MA",
    licenseNumber: "MA-LAB-CAS-004",
    verificationStatus: "VERIFIED",
    lat: 33.575,
    lng: -7.612,
    address: "18 Boulevard Abdelmoumen, Casablanca",
    ownerUserId: "00000000-0000-0000-0000-000000000004",
    createdAtIso: "2026-01-01T00:00:00.000Z",
    openStatus: "OPEN",
    is24_7: false,
    acceptsEmergency: false,
    specialties: ["Blood Panel", "MRI & Radiology"],
    phone: "+212 522 25 60 90",
    distanceMeters: 1120,
  },
];

const FALLBACK_CASABLANCA_DOCTORS: readonly DirectoryDoctorSummary[] = [
  {
    id: "70a3d70c-4385-4fac-b60c-226c86d64ee5",
    fullName: "Dr. Salma Benali",
    email: "doctor@medisync.ma",
    role: "DOCTOR",
    countryCode: "MA",
    specialty: "Cardiology",
    facilityId: "d023c641-b740-4725-8af3-535bd87df176",
    facilityName: "Clinique Anfa Cardiology & Care",
    consultationFeeMinor: 40000,
    languagesSpoken: ["ar", "fr", "en"],
    acceptedInsurances: ["AMO", "CNOPS", "CNSS"],
    telehealthEnabled: true,
    homeVisitEnabled: false,
    credentialVerified: true,
    avatarUrl: null,
  },
  {
    id: "b247b180-c18f-45d8-be7a-1d313c45cc99",
    fullName: "Rachid Amrani",
    email: "nurse@medisync.ma",
    role: "NURSE",
    countryCode: "MA",
    specialty: "Home Nursing & Infirmiers",
    facilityId: "05ec546f-2ded-4f98-a812-5cc6b5694049",
    facilityName: "CHU Ibn Rochd Emergency Hub",
    consultationFeeMinor: 25000,
    languagesSpoken: ["ar", "fr"],
    acceptedInsurances: ["AMO", "CNSS"],
    telehealthEnabled: false,
    homeVisitEnabled: true,
    credentialVerified: true,
    avatarUrl: null,
  },
];

const FALLBACK_CASABLANCA_DRIVERS: readonly DirectoryDriverSummary[] = [
  {
    id: "c3e34ae3-e04d-4426-96d8-5ced269aa208",
    fullName: "Hassan Chraibi",
    email: "driver@medisync.ma",
    countryCode: "MA",
    facilityId: "05ec546f-2ded-4f98-a812-5cc6b5694049",
    facilityName: "CHU Ibn Rochd Emergency Hub",
    vehicleType: "AMBULANCE",
    vehicleLabel: "EMS Ambulance 141 · ICU Kit",
    serviceZone: "Casablanca Emergency District",
    liveStatus: "AVAILABLE",
    avatarUrl: null,
  },
  {
    id: "ea425368-2412-493d-a0c3-d438e90142e2",
    fullName: "Karim Tazi",
    email: "shuttle@medisync.ma",
    countryCode: "MA",
    facilityId: "d023c641-b740-4725-8af3-535bd87df176",
    facilityName: "Clinique Anfa Cardiology & Care",
    vehicleType: "MEDICAL_SHUTTLE",
    vehicleLabel: "Medical Transport Shuttle",
    serviceZone: "Anfa & Maarif Patient Transfers",
    liveStatus: "AVAILABLE",
    avatarUrl: null,
  },
];

const HERO_COPY = {
  en: {
    searchPlaceholder: "City, district, hospital, doctor, or pharmacy...",
    layers: [
      { id: "ALL" as const, label: "All" },
      { id: "HOSPITAL" as const, label: "Hospitals" },
      { id: "CLINIC" as const, label: "Clinics" },
      { id: "PHARMACY" as const, label: "Pharmacy" },
      { id: "DIAGNOSTIC_LAB" as const, label: "Labs" },
      { id: "DOCTOR" as const, label: "Doctors" },
      { id: "DRIVER" as const, label: "EMS 141" },
    ],
    searchCta: "Search",
    pharmacyCta: "24/7 Pharmacy",
    fastBookCta: "Emergency Dispatch · 141",
    liveFeedLabel: "Live",
    readyFeedLabel: "Active",
    hubsWord: "centers",
    unitsWord: "units",
    cityAria: "Jump live map to Moroccan city or district",
    layerBarAria: "Filter care layers on live map",
    openFullMap: "Open Full Map",
    bookVisit: "Book Appointment",
    openPharmacy: "Open Pharmacy",
    viewLab: "View Diagnostic Lab",
    fastBookHere: "1-Tap Dispatch Here",
    closePreviewAria: "Close map pin preview",
    tapPinHint: "Select any medical center on the map for details & booking",
    placeBadge: "Morocco Place",
  },
  fr: {
    searchPlaceholder: "Ville, quartier, hôpital, médecin ou pharmacie...",
    layers: [
      { id: "ALL" as const, label: "Tout" },
      { id: "HOSPITAL" as const, label: "Hôpitaux" },
      { id: "CLINIC" as const, label: "Cliniques" },
      { id: "PHARMACY" as const, label: "Pharmacie" },
      { id: "DIAGNOSTIC_LAB" as const, label: "Labos" },
      { id: "DOCTOR" as const, label: "Médecins" },
      { id: "DRIVER" as const, label: "SAMU 141" },
    ],
    searchCta: "Rechercher",
    pharmacyCta: "Pharmacie 24/7",
    fastBookCta: "Urgence 1-Clic · 141",
    liveFeedLabel: "En direct",
    readyFeedLabel: "Actif",
    hubsWord: "centres",
    unitsWord: "unités",
    cityAria: "Centrer la carte sur une ville ou un quartier",
    layerBarAria: "Filtrer les services médicaux sur la carte",
    openFullMap: "Ouvrir la Carte",
    bookVisit: "Prendre RDV",
    openPharmacy: "Ouvrir Pharmacie",
    viewLab: "Voir Laboratoire",
    fastBookHere: "Trajet 1-Clic ici",
    closePreviewAria: "Fermer l'aperçu",
    tapPinHint: "Cliquez sur un établissement sur la carte pour réserver",
    placeBadge: "Lieu Maroc",
  },
  ar: {
    searchPlaceholder: "مدينة، حي، مستشفى، طبيب أو صيدلية...",
    layers: [
      { id: "ALL" as const, label: "الكل" },
      { id: "HOSPITAL" as const, label: "مستشفيات" },
      { id: "CLINIC" as const, label: "عيادات" },
      { id: "PHARMACY" as const, label: "صيدليات" },
      { id: "DIAGNOSTIC_LAB" as const, label: "مختبرات" },
      { id: "DOCTOR" as const, label: "أطباء" },
      { id: "DRIVER" as const, label: "إسعاف 141" },
    ],
    searchCta: "بحث",
    pharmacyCta: "صيدلية 24/7",
    fastBookCta: "طلب إسعاف فوري · 141",
    liveFeedLabel: "مباشر",
    readyFeedLabel: "نشط",
    hubsWord: "مراكز",
    unitsWord: "وحدات",
    cityAria: "الانتقال إلى مدينة أو حي على الخريطة",
    layerBarAria: "تصفية الخدمات الطبية على الخريطة",
    openFullMap: "فتح الخريطة الكاملة",
    bookVisit: "حجز موعد",
    openPharmacy: "فتح الصيدلية",
    viewLab: "عرض المختبر",
    fastBookHere: "طلب نقل إلى هنا",
    closePreviewAria: "إغلاق المعاينة",
    tapPinHint: "انقر على أي مركز طبي على الخريطة لعرض التفاصيل والحجز",
    placeBadge: "موقع بالمغرب",
  },
} as const;

const LAYER_ICONS: Record<HomeMapLayer, typeof Compass> = {
  ALL: Compass,
  HOSPITAL: Hospital,
  CLINIC: Stethoscope,
  PHARMACY: Pill,
  DIAGNOSTIC_LAB: FlaskConical,
  DOCTOR: Stethoscope,
  DRIVER: Ambulance,
};

const MOBILE_CASABLANCA_VIEWPORT: ViewportBox = {
  districtLabel: "Casablanca Central Metro",
  minLng: -7.65,
  minLat: 33.571,
  maxLng: -7.606,
  maxLat: 33.595,
};

export function HomeCareLaunchpad({
  packs,
  apiBaseUrl,
}: HomeCareLaunchpadProps) {
  const router = useRouter();
  const { locale, t, isRtl } = useLocale();
  const copy = HERO_COPY[locale] ?? HERO_COPY.en;
  const activePack = resolveActivePack(packs);
  const countryCode = activePack?.code ?? ACTIVE_COUNTRY_CODE;
  const resolvedApiBase =
    apiBaseUrl ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4000";

  const [viewport, setViewport] = useState<ViewportBox>(() =>
    getPresetForCountry(countryCode),
  );
  const [selectedCityId, setSelectedCityId] = useState("casablanca");
  const [selectedPlaceLabel, setSelectedPlaceLabel] = useState<string>("");
  const [activeLayer, setActiveLayer] = useState<HomeMapLayer>("ALL");
  const [apiOnline, setApiOnline] = useState(false);

  const [facilities, setFacilities] = useState<readonly ViewportFacilityItem[]>(
    FALLBACK_CASABLANCA_FACILITIES,
  );
  const [doctors, setDoctors] = useState<readonly DirectoryDoctorSummary[]>(
    FALLBACK_CASABLANCA_DOCTORS,
  );
  const [directoryDrivers, setDirectoryDrivers] = useState<
    readonly DirectoryDriverSummary[]
  >(FALLBACK_CASABLANCA_DRIVERS);

  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(
    null,
  );
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && countryCode === "MA") {
      const mq = window.matchMedia("(max-width: 1023px)");
      const syncInitialBox = () => {
        setViewport(
          mq.matches ? MOBILE_CASABLANCA_VIEWPORT : getPresetForCountry("MA"),
        );
      };
      if (mq.matches) {
        setViewport(MOBILE_CASABLANCA_VIEWPORT);
      }
      mq.addEventListener("change", syncInitialBox);
      return () => {
        mq.removeEventListener("change", syncInitialBox);
      };
    }
    return undefined;
  }, [countryCode]);

  useEffect(() => {
    let cancelled = false;
    void checkBackendOnline().then((online) => {
      if (!cancelled) {
        setApiOnline(online);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!apiOnline) return;
    let cancelled = false;

    void Promise.all([
      fetchDirectoryDoctors(resolvedApiBase, { countryCode, limit: 80 }),
      fetchDirectoryDrivers(resolvedApiBase, { countryCode, limit: 60 }),
    ]).then(([docsRes, drvRes]) => {
      if (cancelled) return;
      if (docsRes.ok && docsRes.doctors.length > 0) {
        setDoctors(docsRes.doctors);
      }
      if (drvRes.ok && drvRes.drivers.length > 0) {
        setDirectoryDrivers(drvRes.drivers);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [apiOnline, countryCode, resolvedApiBase]);

  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const viewportQueryKey = `${viewport.minLat.toFixed(3)},${viewport.minLng.toFixed(3)},${viewport.maxLat.toFixed(3)},${viewport.maxLng.toFixed(3)}`;

  useEffect(() => {
    if (!apiOnline) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void queryViewportFacilities(
        resolvedApiBase,
        countryCode,
        viewportRef.current,
        {},
      ).then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setFacilities(res.data.facilities);
        }
      });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiOnline, countryCode, resolvedApiBase, viewportQueryKey]);

  useEffect(() => {
    function handleOutside(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target && !searchBoxRef.current?.contains(target)) {
        setSearchDropdownOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleOutside, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutside, true);
    };
  }, []);

  const doctorPins = useMemo<LiveDoctorPin[]>(() => {
    const facMap = new Map(facilities.map((f) => [f.id, f]));
    const center = getViewportCenter(viewport);
    return doctors.map((doc, idx) => {
      const matched = doc.facilityId ? facMap.get(doc.facilityId) : undefined;
      const spreadLat = ((idx % 3) - 1) * 0.0024 + 0.0018;
      const spreadLng = (Math.floor(idx / 3) - 0.5) * 0.0032;
      return {
        id: doc.id,
        name: doc.fullName,
        specialty: doc.specialty,
        facilityId: doc.facilityId ?? "",
        facilityName: doc.facilityName ?? countryCode,
        lat: matched ? matched.lat + spreadLat : center.lat + spreadLat,
        lng: matched ? matched.lng + spreadLng : center.lng + spreadLng,
      };
    });
  }, [doctors, facilities, countryCode, viewport]);

  const liveDrivers = useMemo<LiveDriverMarker[]>(() => {
    const facMap = new Map(facilities.map((f) => [f.id, f]));
    const center = getViewportCenter(viewport);
    return directoryDrivers.map((drv, idx) => {
      const matched = drv.facilityId ? facMap.get(drv.facilityId) : undefined;
      const offsetLat = idx % 2 === 0 ? -0.0038 : 0.0044;
      const offsetLng = idx % 2 === 0 ? 0.0056 : -0.0048;
      return {
        driverId: drv.id,
        countryCode: drv.countryCode,
        lat: Number(((matched?.lat ?? center.lat) + offsetLat).toFixed(5)),
        lng: Number(((matched?.lng ?? center.lng) + offsetLng).toFixed(5)),
        headingDeg: idx % 2 === 0 ? 45 : 210,
        status: drv.liveStatus ?? "AVAILABLE",
        distanceKm: idx === 0 ? 1.2 : 1.9,
        recordedAtIso: "2026-01-01T00:00:00.000Z",
      };
    });
  }, [directoryDrivers, facilities, viewport]);

  const driverLabels = useMemo<Record<string, string>>(() => {
    const labels: Record<string, string> = {};
    for (const drv of directoryDrivers) {
      labels[drv.id] = drv.fullName;
    }
    return labels;
  }, [directoryDrivers]);

  const mapFacilities = useMemo(() => {
    if (activeLayer === "ALL") return facilities;
    if (activeLayer === "DOCTOR" || activeLayer === "DRIVER") return [];
    return facilities.filter((f) => f.kind === activeLayer);
  }, [activeLayer, facilities]);

  const mapDrivers = useMemo(() => {
    if (activeLayer === "DRIVER") return liveDrivers;
    return [];
  }, [activeLayer, liveDrivers]);

  const mapDoctorPins = useMemo(() => {
    if (activeLayer === "DOCTOR") return doctorPins;
    return [];
  }, [activeLayer, doctorPins]);

  const selectedEntity = useMemo<SelectedPreviewEntity | null>(() => {
    if (selectedFacilityId) {
      const fac = facilities.find((f) => f.id === selectedFacilityId);
      if (fac) return { kind: "FACILITY", facility: fac };
    }
    if (selectedDoctorId) {
      const doc = doctors.find((d) => d.id === selectedDoctorId);
      const pin = doctorPins.find((p) => p.id === selectedDoctorId);
      if (doc && pin) {
        return { kind: "DOCTOR", doctor: doc, lat: pin.lat, lng: pin.lng };
      }
    }
    if (selectedDriverId) {
      const drv = directoryDrivers.find((d) => d.id === selectedDriverId);
      const marker = liveDrivers.find((m) => m.driverId === selectedDriverId);
      if (drv && marker) {
        return {
          kind: "DRIVER",
          driverId: drv.id,
          fullName: drv.fullName,
          vehicleLabel: drv.vehicleLabel,
          vehicleType: drv.vehicleType,
          serviceZone: drv.serviceZone,
          status: marker.status,
          lat: marker.lat,
          lng: marker.lng,
        };
      }
    }
    return null;
  }, [
    selectedFacilityId,
    selectedDoctorId,
    selectedDriverId,
    facilities,
    doctors,
    doctorPins,
    directoryDrivers,
    liveDrivers,
  ]);

  const previewRoute = useMemo(() => {
    if (!selectedEntity) return { origin: null, destination: null };
    const anchor = getViewportCenter(viewport);
    if (selectedEntity.kind === "FACILITY") {
      return {
        origin: anchor,
        destination: {
          lat: selectedEntity.facility.lat,
          lng: selectedEntity.facility.lng,
          label: selectedEntity.facility.name,
          legKind: "dropoff" as const,
        },
      };
    }
    if (selectedEntity.kind === "DOCTOR") {
      return {
        origin: anchor,
        destination: {
          lat: selectedEntity.lat,
          lng: selectedEntity.lng,
          label: selectedEntity.doctor.fullName,
          legKind: "dropoff" as const,
        },
      };
    }
    return {
      origin: { lat: selectedEntity.lat, lng: selectedEntity.lng },
      destination: {
        lat: anchor.lat,
        lng: anchor.lng,
        label: selectedEntity.fullName,
        legKind: "pickup" as const,
      },
    };
  }, [selectedEntity]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const quickSuggestions = useMemo(() => {
    if (!normalizedSearch) return [];
    const results: Array<
      | {
          key: string;
          type: "LOCATION";
          match: MoroccanLocationMatch;
          title: string;
          subtitle: string;
          badge: string;
          layer: HomeMapLayer;
          lat: number;
          lng: number;
        }
      | {
          key: string;
          type: "FACILITY";
          id: string;
          title: string;
          subtitle: string;
          badge: string;
          layer: HomeMapLayer;
          lat: number;
          lng: number;
        }
      | {
          key: string;
          type: "DOCTOR";
          id: string;
          title: string;
          subtitle: string;
          badge: string;
          layer: HomeMapLayer;
          lat: number;
          lng: number;
        }
    > = [];

    const locationMatches = searchMoroccanLocations(searchTerm, 4);
    for (const loc of locationMatches) {
      results.push({
        key: `loc-${loc.kind}-${loc.id}`,
        type: "LOCATION",
        match: loc,
        title: loc.labels[locale],
        subtitle:
          loc.kind === "PLACE"
            ? `${loc.cityLabels[locale]} · ${loc.region}`
            : loc.region,
        badge: copy.placeBadge,
        layer: "ALL",
        lat: loc.lat,
        lng: loc.lng,
      });
    }

    for (const fac of facilities) {
      const hay =
        `${fac.name} ${fac.address} ${fac.kind} ${formatFacilityKind(fac.kind, locale)}`.toLowerCase();
      if (hay.includes(normalizedSearch)) {
        results.push({
          key: `f-${fac.id}`,
          type: "FACILITY",
          id: fac.id,
          title: fac.name,
          subtitle: fac.address,
          badge: formatFacilityKind(fac.kind, locale),
          layer: fac.kind,
          lat: fac.lat,
          lng: fac.lng,
        });
      }
    }

    for (const doc of doctors) {
      const pin = doctorPins.find((p) => p.id === doc.id);
      const hay =
        `${doc.fullName} ${doc.specialty} ${formatSpecialtyLabel(doc.specialty, locale)} ${doc.facilityName ?? ""}`.toLowerCase();
      if (hay.includes(normalizedSearch) && pin) {
        results.push({
          key: `d-${doc.id}`,
          type: "DOCTOR",
          id: doc.id,
          title: doc.fullName,
          subtitle: `${formatSpecialtyLabel(doc.specialty, locale)} · ${doc.facilityName ?? countryCode}`,
          badge: formatRoleLabel(doc.role, locale),
          layer: "DOCTOR",
          lat: pin.lat,
          lng: pin.lng,
        });
      }
    }

    return results.slice(0, 7);
  }, [normalizedSearch, searchTerm, facilities, doctors, doctorPins, locale, countryCode, copy.placeBadge]);

  function withCountry(href: string) {
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}country=${encodeURIComponent(countryCode)}`;
  }

  function handleLocationJump(match: MoroccanLocationMatch | null) {
    if (!match) return;
    setSelectedCityId(match.cityId);
    setSelectedPlaceLabel(
      match.kind === "PLACE" ? match.labels[locale] : "",
    );
    setViewport(locationMatchToViewportBox(match));
    setSelectedFacilityId(null);
    setSelectedDoctorId(null);
    setSelectedDriverId(null);
  }

  function clearSelection() {
    setSelectedFacilityId(null);
    setSelectedDoctorId(null);
    setSelectedDriverId(null);
  }

  function focusPinOnHomeMap(lat: number, lng: number) {
    setViewport((prev) => {
      const halfLng = Math.min(0.048, (prev.maxLng - prev.minLng) / 2);
      const halfLat = Math.min(0.024, (prev.maxLat - prev.minLat) / 2);
      const offsetLng = isRtl ? halfLng * 0.25 : -halfLng * 0.28;
      return {
        districtLabel: prev.districtLabel,
        minLng: Number((lng + offsetLng - halfLng).toFixed(4)),
        maxLng: Number((lng + offsetLng + halfLng).toFixed(4)),
        minLat: Number((lat - halfLat).toFixed(4)),
        maxLat: Number((lat + halfLat).toFixed(4)),
      };
    });
  }

  function handleQuickLaunch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleaned = searchTerm.trim();
    if (quickSuggestions.length > 0) {
      const top = quickSuggestions[0]!;
      if (top.type === "LOCATION") {
        handleLocationJump(top.match);
        setSearchDropdownOpen(false);
        return;
      }
      setActiveLayer(top.layer);
      if (top.type === "FACILITY") {
        setSelectedDoctorId(null);
        setSelectedDriverId(null);
        setSelectedFacilityId(top.id);
      } else {
        setSelectedFacilityId(null);
        setSelectedDriverId(null);
        setSelectedDoctorId(top.id);
      }
      focusPinOnHomeMap(top.lat, top.lng);
      setSearchDropdownOpen(false);
      return;
    }

    const specialty = cleaned
      ? `&specialty=${encodeURIComponent(cleaned)}`
      : "";
    router.push(
      `/booking?country=${encodeURIComponent(countryCode)}${specialty}`,
    );
  }

  const commandCardBody = (
    <div className="flex flex-col gap-2.5 xl:gap-3.5">
      {/* Compact Live Telemetry Strip (avoids duplicating AppHeader's network & 141 pill) */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B2E5DC] bg-[#E6F7F4] px-2.5 py-0.5 text-[10.5px] font-semibold text-[#0B6B5C] xl:py-1 xl:text-[11px]">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-[#0F9D88]"
          />
          {apiOnline ? copy.liveFeedLabel : copy.readyFeedLabel}
        </span>
        <div
          dir="ltr"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#D7E4F2] bg-[#F3F8FD] px-2.5 py-0.5 font-mono-tabular text-[11px] font-semibold text-[#4A627D] xl:py-1"
        >
          <span className="text-[#0066CC]">{facilities.length}</span>
          <span>{copy.hubsWord}</span>
          <span className="text-[#B7CDE4]">·</span>
          <span className="text-[#0F243E]">{liveDrivers.length}</span>
          <span>{copy.unitsWord}</span>
        </div>
      </div>

      {/* Crisp Clinical Sans Headline */}
      <div>
        <h1 className="font-editorial text-xl font-bold leading-[1.12] tracking-[-0.025em] text-[#0F243E] sm:text-2xl lg:text-[26px] xl:text-[34px]">
          {locale === "en" ? (
            <>
              Global medical{" "}
              <span className="text-[#0066CC]">coordination.</span>
            </>
          ) : (
            t("home.title")
          )}
        </h1>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-[#4A627D] xl:mt-1.5 xl:text-[13.5px] xl:leading-relaxed">
          {t("home.subtitle")}
        </p>
      </div>

      {/* Medical Search Box with Live Care Suggestions */}
      <div ref={searchBoxRef} className="relative">
        <form
          onSubmit={handleQuickLaunch}
          className="flex items-center gap-1.5 rounded-xl border border-[#CBDDF0] bg-[#F3F8FD]/90 p-1.5 transition-colors focus-within:border-[#0066CC] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0066CC]/15"
        >
          <div className="relative flex min-w-0 flex-1 items-center">
            <label htmlFor="home-map-search" className="sr-only">
              {copy.searchPlaceholder}
            </label>
            <Search
              className="pointer-events-none absolute start-2.5 h-4 w-4 text-[#0066CC]"
              aria-hidden="true"
            />
            <input
              id="home-map-search"
              type="text"
              value={searchTerm}
              onFocus={() => setSearchDropdownOpen(true)}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSearchDropdownOpen(true);
              }}
              placeholder={copy.searchPlaceholder}
              className="min-h-[38px] w-full bg-transparent ps-9 pe-7 text-xs font-medium text-[#0F243E] placeholder:text-[#7D96B2] focus:outline-none sm:text-[13.5px]"
            />
            {searchTerm ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchTerm("");
                  setSearchDropdownOpen(false);
                }}
                className="absolute end-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[#6B829D] hover:bg-[#E8F1FA] hover:text-[#0F243E]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <UiButton
            type="submit"
            variant="primary"
            size="sm"
            className="h-9 shrink-0 rounded-lg px-3.5"
          >
            <span>{copy.searchCta}</span>
            <ArrowRight
              className="h-3.5 w-3.5 rtl:rotate-180"
              aria-hidden="true"
            />
          </UiButton>
        </form>

        {/* Instant Map Pin Suggestions Dropdown */}
        {searchDropdownOpen && quickSuggestions.length > 0 ? (
          <div
            role="listbox"
            aria-label="Live map matches"
            className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-[240px] overflow-y-auto rounded-2xl border border-[#D7E4F2] bg-white/98 p-1.5 shadow-[0_18px_40px_rgba(15,36,62,0.16)] backdrop-blur-xl"
          >
            {quickSuggestions.map((item) => {
              const Icon =
                item.type === "LOCATION" ? MapPin : LAYER_ICONS[item.layer];
              return (
                <button
                  key={item.key}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    if (item.type === "LOCATION") {
                      handleLocationJump(item.match);
                      setSearchDropdownOpen(false);
                      return;
                    }
                    setActiveLayer(item.layer);
                    if (item.type === "FACILITY") {
                      setSelectedDoctorId(null);
                      setSelectedDriverId(null);
                      setSelectedFacilityId(item.id);
                    } else {
                      setSelectedFacilityId(null);
                      setSelectedDriverId(null);
                      setSelectedDoctorId(item.id);
                    }
                    focusPinOnHomeMap(item.lat, item.lng);
                    setSearchDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-[#EBF4FF]/80"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EBF4FF] text-[#0066CC]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-[#0F243E]">
                      {item.title}
                    </span>
                    <span className="block truncate text-[11px] text-[#556E89]">
                      {item.subtitle}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full border border-[#D7E4F2] bg-[#F3F8FD] px-2 py-0.5 text-[10.5px] font-semibold text-[#4A627D]">
                    {item.badge}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Primary Care Action Row */}
      <div className="space-y-2">
        <UiLinkButton
          href={withCountry("/map")}
          variant="primary"
          size="md"
          className="w-full justify-center"
        >
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("home.ctaFindCare")}</span>
        </UiLinkButton>

        <div className="grid grid-cols-2 gap-2">
          <UiLinkButton
            href={withCountry("/booking")}
            variant="outline"
            size="md"
            className="w-full justify-center px-2.5"
          >
            <CalendarClock
              className="h-4 w-4 shrink-0 text-[#0066CC]"
              aria-hidden="true"
            />
            <span className="truncate">{t("home.ctaBookDoctor")}</span>
          </UiLinkButton>

          <UiLinkButton
            href={withCountry("/pharmacy")}
            variant="outline"
            size="md"
            className="w-full justify-center px-2.5"
          >
            <Pill
              className="h-4 w-4 shrink-0 text-[#0F9D88]"
              aria-hidden="true"
            />
            <span className="truncate">{copy.pharmacyCta}</span>
          </UiLinkButton>
        </div>
      </div>

      {/* Emergency Dispatch Strip — full-width single CTA, zero split gap */}
      <div className="border-t border-[#E8F1FA] pt-2.5">
        <Link
          href={withCountry("/map?fastBook=1")}
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[#DC2626] px-3.5 text-xs font-bold text-white shadow-[0_8px_20px_-6px_rgba(220,38,38,0.45)] transition hover:bg-[#B91C1C] active:scale-[0.98]"
        >
          <Ambulance className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{copy.fastBookCta}</span>
        </Link>
      </div>
    </div>
  );

  const mapLayerControls = (
    <div
      role="group"
      aria-label={copy.layerBarAria}
      className="flex flex-wrap items-center gap-1"
    >
      {copy.layers.map((layer) => {
        const Icon = LAYER_ICONS[layer.id];
        const active = activeLayer === layer.id;
        return (
          <button
            key={layer.id}
            type="button"
            aria-pressed={active}
            onClick={() => {
              setActiveLayer(layer.id);
              clearSelection();
            }}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold transition-colors active:scale-[0.98] ${
              active
                ? "bg-[#0066CC] text-white shadow-xs"
                : "text-[#3B5570] hover:bg-[#EBF4FF] hover:text-[#0052A3]"
            }`}
          >
            <Icon
              className={`h-3.5 w-3.5 shrink-0 ${active ? "text-white" : "text-[#0066CC]"}`}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap">{layer.label}</span>
          </button>
        );
      })}
    </div>
  );

  const citySelector = (
    <MoroccanPlacePicker
      value={selectedCityId}
      displayLabel={selectedPlaceLabel || undefined}
      allowAll={false}
      includePlaces
      variant="pill"
      align="end"
      ariaLabel={copy.cityAria}
      onSelect={handleLocationJump}
    />
  );

  return (
    <section
      dir={isRtl ? "rtl" : "ltr"}
      data-home-map-hero="true"
      className="relative isolate border-b border-[#D7E4F2] bg-white text-[#0F243E] lg:h-[calc(100dvh-3.5rem)] xl:h-[calc(100dvh-4rem)] lg:min-h-[520px] lg:max-h-[760px] lg:overflow-hidden lg:bg-[#edf1ee]"
    >
      {/* Single Command Card: Stacked cleanly on mobile (< lg), floating white medical card on desktop (lg+) */}
      <aside className="relative z-30 border-b border-[#D7E4F2] bg-white px-4 py-4 sm:px-5 lg:pointer-events-auto lg:absolute lg:top-3.5 lg:start-3.5 lg:w-[368px] lg:rounded-2xl lg:border lg:bg-white/96 lg:p-4 lg:shadow-[0_22px_54px_-14px_rgba(0,102,204,0.18)] lg:backdrop-blur-xl xl:top-5 xl:start-5 xl:w-[412px] xl:p-5">
        {commandCardBody}
      </aside>

      {/* Single Map Layer & All-Morocco City/Place Pill Bar (compact wrap — zero clipped labels, zero dead voids) */}
      <div className="relative z-30 flex flex-wrap items-center gap-1.5 border-b border-[#D7E4F2] bg-[#F3F8FD] px-3 py-2 lg:pointer-events-auto lg:absolute lg:top-3.5 lg:end-3.5 lg:max-w-[calc(100%-25.25rem)] lg:rounded-2xl lg:border lg:bg-white/96 lg:px-2 lg:py-1.5 lg:shadow-[0_12px_32px_-8px_rgba(15,36,62,0.14)] lg:backdrop-blur-xl xl:top-5 xl:end-5 xl:max-w-[calc(100%-28rem)]">
        {mapLayerControls}
        <span
          aria-hidden="true"
          className="hidden h-5 w-px shrink-0 bg-[#D7E4F2] xl:block"
        />
        {citySelector}
      </div>

      {/* Full-Bleed Live Interactive Medical Street Map Stage */}
      <div className="relative h-[380px] w-full scroll-mt-20 overflow-hidden sm:h-[450px] lg:absolute lg:inset-0 lg:h-full">
        <div className="absolute inset-0">
          <ViewportVectorMap
            countryCode={countryCode}
            viewport={viewport}
            activeLayer={activeLayer}
            facilities={mapFacilities}
            allFacilities={facilities}
            drivers={mapDrivers}
            driverLabels={driverLabels}
            doctorPins={mapDoctorPins}
            selectedFacilityId={selectedFacilityId}
            selectedDoctorId={selectedDoctorId}
            selectedDriverId={selectedDriverId}
            previewOrigin={previewRoute.origin}
            previewDestination={previewRoute.destination}
            postgisQueryMs={null}
            redisQueryMs={null}
            busy={false}
            edgeToEdge
            disableWheelZoom
            hudTopPaddingPx={12}
            hudStartOffsetClass={isRtl ? "" : "lg:pl-[25rem] xl:pl-[28.5rem]"}
            onSelectFacility={(id) => {
              setSelectedDoctorId(null);
              setSelectedDriverId(null);
              setSelectedFacilityId(id);
              const fac = facilities.find((f) => f.id === id);
              if (fac) focusPinOnHomeMap(fac.lat, fac.lng);
            }}
            onSelectDoctor={(id) => {
              setSelectedFacilityId(null);
              setSelectedDriverId(null);
              setSelectedDoctorId(id);
              const pin = doctorPins.find((p) => p.id === id);
              if (pin) focusPinOnHomeMap(pin.lat, pin.lng);
            }}
            onSelectDriver={(id) => {
              setSelectedFacilityId(null);
              setSelectedDoctorId(null);
              setSelectedDriverId(id);
              const drv = liveDrivers.find((d) => d.driverId === id);
              if (drv) focusPinOnHomeMap(drv.lat, drv.lng);
            }}
            onZoom={(factor) => setViewport((box) => zoomViewport(box, factor))}
            onPan={(dLat, dLng) =>
              setViewport((box) => panViewport(box, dLat, dLng))
            }
            onReset={() => {
              if (
                typeof window !== "undefined" &&
                window.innerWidth < 1024 &&
                selectedCityId === "casablanca"
              ) {
                setViewport(MOBILE_CASABLANCA_VIEWPORT);
              } else {
                const preset = getCityPresetById(selectedCityId);
                setViewport(
                  preset ? toViewportBox(preset) : getPresetForCountry(countryCode),
                );
              }
              clearSelection();
            }}
            onViewportChange={setViewport}
          />
        </div>

        {/* Interactive Floating Medical Pin Preview Card */}
        {selectedEntity ? (
          <div
            data-home-pin-preview="true"
            role="region"
            aria-label="Selected care location preview"
            className={`pointer-events-auto absolute z-30 w-[min(356px,calc(100%-1.5rem))] rounded-2xl border border-[#D7E4F2] bg-white/97 p-4 shadow-[0_22px_48px_-12px_rgba(15,36,62,0.2)] backdrop-blur-xl ${
              isRtl
                ? "bottom-3 start-3 sm:bottom-5 sm:start-16"
                : "bottom-3 end-3 sm:bottom-5 sm:end-16"
            }`}
          >
            {selectedEntity.kind === "FACILITY" ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <img
                    src={resolveFacilityPicture(selectedEntity.facility.kind)}
                    alt={selectedEntity.facility.name}
                    className="h-14 w-16 shrink-0 rounded-xl border border-[#D7E4F2] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <UiBadge tone="emerald">
                        {formatOpenStatus(
                          selectedEntity.facility.openStatus,
                          locale,
                        )}
                      </UiBadge>
                      <button
                        type="button"
                        aria-label={copy.closePreviewAria}
                        onClick={clearSelection}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6B829D] hover:bg-[#F3F8FD] hover:text-[#0F243E]"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="mt-1 truncate text-sm font-bold text-[#0F243E]">
                      {selectedEntity.facility.name}
                    </p>
                    <p className="truncate text-xs text-[#556E89]">
                      {formatFacilityKind(
                        selectedEntity.facility.kind,
                        locale,
                      )}{" "}
                      · {selectedEntity.facility.address}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={withCountry(
                      selectedEntity.facility.kind === "PHARMACY"
                        ? "/pharmacy"
                        : selectedEntity.facility.kind === "DIAGNOSTIC_LAB"
                          ? "/profiles?category=DIAGNOSTIC_LAB"
                          : "/booking",
                    )}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-xl bg-[#0066CC] px-3.5 text-xs font-semibold text-white hover:bg-[#0052A3]"
                  >
                    <span>
                      {selectedEntity.facility.kind === "PHARMACY"
                        ? copy.openPharmacy
                        : selectedEntity.facility.kind === "DIAGNOSTIC_LAB"
                          ? copy.viewLab
                          : copy.bookVisit}
                    </span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href={withCountry(
                      `/map?facilityId=${encodeURIComponent(selectedEntity.facility.id)}&layer=${encodeURIComponent(selectedEntity.facility.kind)}`,
                    )}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#CBDDF0] bg-white px-3 text-xs font-semibold text-[#0F243E] hover:border-[#0066CC] hover:text-[#0066CC]"
                  >
                    <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{copy.openFullMap}</span>
                  </Link>
                </div>
              </div>
            ) : selectedEntity.kind === "DOCTOR" ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <img
                    src={resolveDefaultAvatar(selectedEntity.doctor.role)}
                    alt={selectedEntity.doctor.fullName}
                    className="h-14 w-14 shrink-0 rounded-xl border border-[#D7E4F2] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <UiBadge tone="teal">
                        {formatSpecialtyLabel(
                          selectedEntity.doctor.specialty,
                          locale,
                        )}
                      </UiBadge>
                      <button
                        type="button"
                        aria-label={copy.closePreviewAria}
                        onClick={clearSelection}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6B829D] hover:bg-[#F3F8FD] hover:text-[#0F243E]"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="mt-1 truncate text-sm font-bold text-[#0F243E]">
                      {selectedEntity.doctor.fullName}
                    </p>
                    <p className="truncate text-xs text-[#556E89]">
                      {selectedEntity.doctor.facilityName ?? countryCode}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={withCountry(
                      `/booking?specialty=${encodeURIComponent(selectedEntity.doctor.specialty)}`,
                    )}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-xl bg-[#0066CC] px-3.5 text-xs font-semibold text-white hover:bg-[#0052A3]"
                  >
                    <span>{copy.bookVisit}</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <Link
                    href={withCountry("/map?layer=DOCTOR")}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#CBDDF0] bg-white px-3 text-xs font-semibold text-[#0F243E] hover:border-[#0066CC] hover:text-[#0066CC]"
                  >
                    <span>{copy.openFullMap}</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <img
                    src={resolveVehiclePicture(selectedEntity.vehicleType)}
                    alt={selectedEntity.vehicleLabel}
                    className="h-14 w-16 shrink-0 rounded-xl border border-[#D7E4F2] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <UiBadge tone="emerald">
                        {formatDriverStatus(selectedEntity.status, locale)}
                      </UiBadge>
                      <button
                        type="button"
                        aria-label={copy.closePreviewAria}
                        onClick={clearSelection}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6B829D] hover:bg-[#F3F8FD] hover:text-[#0F243E]"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="mt-1 truncate text-sm font-bold text-[#0F243E]">
                      {selectedEntity.fullName}
                    </p>
                    <p className="truncate text-xs text-[#556E89]">
                      {selectedEntity.vehicleLabel} · {selectedEntity.serviceZone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={withCountry("/map?fastBook=1")}
                    className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#DC2626] px-3.5 text-xs font-bold text-white hover:bg-[#B91C1C]"
                  >
                    <Ambulance className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{copy.fastBookHere}</span>
                  </Link>
                  <Link
                    href={withCountry("/map?layer=DRIVER")}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#CBDDF0] bg-white px-3 text-xs font-semibold text-[#0F243E] hover:border-[#0066CC] hover:text-[#0066CC]"
                  >
                    <span>{copy.openFullMap}</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`pointer-events-none hidden sm:flex absolute bottom-5 z-20 ${
              isRtl ? "start-16" : "end-16"
            }`}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D7E4F2] bg-white/95 px-3.5 py-2 text-xs font-medium text-[#4A627D] shadow-[0_8px_22px_rgba(15,36,62,0.1)] backdrop-blur-md">
              <MapPin className="h-3.5 w-3.5 text-[#0066CC]" aria-hidden="true" />
              <span>{copy.tapPinHint}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
