import {
  MOROCCAN_CITIES_CATALOG,
  type MoroccanLocationMatch,
} from "@medisync/country-packs";

export interface ViewportBox {
  districtLabel: string;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface MapCityPreset extends ViewportBox {
  id: string;
  city: string;
  countryCode: string;
  region?: string;
  group: "Morocco" | "International Hubs";
}

const MOROCCO_MAP_PRESETS: readonly MapCityPreset[] =
  MOROCCAN_CITIES_CATALOG.map((city) => ({
    id: city.id,
    city: city.name,
    countryCode: "MA",
    region: city.region,
    group: "Morocco" as const,
    districtLabel: city.districtLabel,
    minLng: city.bbox.minLng,
    minLat: city.bbox.minLat,
    maxLng: city.bbox.maxLng,
    maxLat: city.bbox.maxLat,
  }));

export const MAP_CITY_PRESETS: readonly MapCityPreset[] = [
  ...MOROCCO_MAP_PRESETS,
  {
    id: "paris",
    city: "Paris",
    countryCode: "FR",
    group: "International Hubs",
    districtLabel: "Paris AP-HP Core",
    minLng: 2.310,
    minLat: 48.828,
    maxLng: 2.382,
    maxLat: 48.872,
  },
  {
    id: "geneva",
    city: "Geneva",
    countryCode: "INTL",
    group: "International Hubs",
    districtLabel: "Geneva Medical District",
    minLng: 6.115,
    minLat: 46.180,
    maxLng: 6.178,
    maxLat: 46.220,
  },
  {
    id: "new-york",
    city: "New York",
    countryCode: "US",
    group: "International Hubs",
    districtLabel: "Manhattan Clinical Corridor",
    minLng: -74.022,
    minLat: 40.712,
    maxLng: -73.938,
    maxLat: 40.776,
  },
];

export function locationMatchToViewportBox(
  match: MoroccanLocationMatch,
): ViewportBox {
  return {
    districtLabel: match.districtLabel,
    minLng: match.bbox.minLng,
    minLat: match.bbox.minLat,
    maxLng: match.bbox.maxLng,
    maxLat: match.bbox.maxLat,
  };
}

const CITY_PRESET_BY_ID = new Map(
  MAP_CITY_PRESETS.map((preset) => [preset.id, preset]),
);

const DEFAULT_CITY_BY_COUNTRY: Record<string, string> = {
  MA: "casablanca",
  FR: "paris",
  US: "new-york",
  INTL: "geneva",
};

export function getDefaultCityIdForCountry(code: string): string {
  return DEFAULT_CITY_BY_COUNTRY[code.trim().toUpperCase()] ?? "casablanca";
}

export function getCityPresetById(cityId: string): MapCityPreset | undefined {
  return CITY_PRESET_BY_ID.get(cityId);
}

export function toViewportBox(preset: ViewportBox): ViewportBox {
  return {
    districtLabel: preset.districtLabel,
    minLng: preset.minLng,
    minLat: preset.minLat,
    maxLng: preset.maxLng,
    maxLat: preset.maxLat,
  };
}

export function getPresetForCountry(code: string): ViewportBox {
  const defaultId = getDefaultCityIdForCountry(code);
  const preset =
    CITY_PRESET_BY_ID.get(defaultId) ?? CITY_PRESET_BY_ID.get("casablanca")!;
  return toViewportBox(preset);
}

export function isCoordinateNearViewport(
  lat: number,
  lng: number,
  box: ViewportBox,
  marginDegLat = 0.12,
  marginDegLng = 0.15,
): boolean {
  return (
    lat >= box.minLat - marginDegLat &&
    lat <= box.maxLat + marginDegLat &&
    lng >= box.minLng - marginDegLng &&
    lng <= box.maxLng + marginDegLng
  );
}

export function getViewportCenter(box: ViewportBox): { lat: number; lng: number } {
  return {
    lat: Number(((box.minLat + box.maxLat) / 2).toFixed(4)),
    lng: Number(((box.minLng + box.maxLng) / 2).toFixed(4)),
  };
}

export function zoomViewport(box: ViewportBox, factor: number): ViewportBox {
  const center = getViewportCenter(box);
  const halfLng = Math.min(Math.max(((box.maxLng - box.minLng) / 2) * factor, 0.005), 8.0);
  const halfLat = Math.min(Math.max(((box.maxLat - box.minLat) / 2) * factor, 0.005), 6.0);
  return {
    districtLabel: box.districtLabel,
    minLng: Number((center.lng - halfLng).toFixed(4)),
    maxLng: Number((center.lng + halfLng).toFixed(4)),
    minLat: Number(Math.max(-89, center.lat - halfLat).toFixed(4)),
    maxLat: Number(Math.min(89, center.lat + halfLat).toFixed(4)),
  };
}

export function panViewport(
  box: ViewportBox,
  dLatFactor: number,
  dLngFactor: number,
): ViewportBox {
  const dLat = (box.maxLat - box.minLat) * dLatFactor;
  const dLng = (box.maxLng - box.minLng) * dLngFactor;
  return {
    districtLabel: box.districtLabel,
    minLng: Number(Math.max(-179, box.minLng + dLng).toFixed(4)),
    maxLng: Number(Math.min(179, box.maxLng + dLng).toFixed(4)),
    minLat: Number(Math.max(-89, box.minLat + dLat).toFixed(4)),
    maxLat: Number(Math.min(89, box.maxLat + dLat).toFixed(4)),
  };
}

export function projectPoint(
  lat: number,
  lng: number,
  box: ViewportBox,
): { xPct: number; yPct: number; visible: boolean } {
  const spanLng = Math.max(0.0001, box.maxLng - box.minLng);
  const spanLat = Math.max(0.0001, box.maxLat - box.minLat);
  const xPct = ((lng - box.minLng) / spanLng) * 100;
  const yPct = ((box.maxLat - lat) / spanLat) * 100;
  const visible = xPct >= 0 && xPct <= 100 && yPct >= 0 && yPct <= 100;
  return {
    xPct: Math.min(96, Math.max(4, xPct)),
    yPct: Math.min(94, Math.max(6, yPct)),
    visible,
  };
}

export const MAP_TILE_SIZE = 256;

export function lngToWorldPx(lng: number, zoom: number): number {
  const worldSize = MAP_TILE_SIZE * Math.pow(2, zoom);
  return ((lng + 180) / 360) * worldSize;
}

export function latToWorldPx(lat: number, zoom: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  const yNorm = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  const worldSize = MAP_TILE_SIZE * Math.pow(2, zoom);
  return yNorm * worldSize;
}

export function worldPxToLng(px: number, zoom: number): number {
  const worldSize = MAP_TILE_SIZE * Math.pow(2, zoom);
  return (px / worldSize) * 360 - 180;
}

export function worldPxToLat(py: number, zoom: number): number {
  const worldSize = MAP_TILE_SIZE * Math.pow(2, zoom);
  const n = Math.PI - (2 * Math.PI * py) / worldSize;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function estimateZoomForViewport(
  box: ViewportBox,
  containerWidthPx: number,
): number {
  const width = Math.max(256, containerWidthPx);
  const spanLng = Math.max(0.004, box.maxLng - box.minLng);
  const rawZoom = Math.log2((width / MAP_TILE_SIZE) * (360 / spanLng));
  return Math.max(5, Math.min(18, Math.round(rawZoom)));
}

export function panViewportByPixels(
  box: ViewportBox,
  dragDeltaX: number,
  dragDeltaY: number,
  zoom: number,
  containerWidthPx: number,
  containerHeightPx: number,
): ViewportBox {
  const center = getViewportCenter(box);
  const nextCenterX = lngToWorldPx(center.lng, zoom) - dragDeltaX;
  const nextCenterY = latToWorldPx(center.lat, zoom) - dragDeltaY;

  const halfW = Math.max(128, containerWidthPx) / 2;
  const halfH = Math.max(128, containerHeightPx) / 2;

  const minLng = worldPxToLng(nextCenterX - halfW, zoom);
  const maxLng = worldPxToLng(nextCenterX + halfW, zoom);
  const maxLat = worldPxToLat(nextCenterY - halfH, zoom);
  const minLat = worldPxToLat(nextCenterY + halfH, zoom);

  return {
    districtLabel: box.districtLabel,
    minLng: Number(Math.max(-179, minLng).toFixed(4)),
    maxLng: Number(Math.min(179, maxLng).toFixed(4)),
    minLat: Number(Math.max(-85, minLat).toFixed(4)),
    maxLat: Number(Math.min(85, maxLat).toFixed(4)),
  };
}

