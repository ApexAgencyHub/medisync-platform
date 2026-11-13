export interface ViewportBox {
  districtLabel: string;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

const COUNTRY_VIEWPORT_PRESETS: Record<string, ViewportBox> = {
  INTL: {
    districtLabel: "Geneva Medical District",
    minLng: 6.08,
    minLat: 46.16,
    maxLng: 6.22,
    maxLat: 46.25,
  },
  MA: {
    districtLabel: "Casablanca Central Metro",
    minLng: -7.70,
    minLat: 33.48,
    maxLng: -7.48,
    maxLat: 33.66,
  },
  FR: {
    districtLabel: "Paris AP-HP Core",
    minLng: 2.24,
    minLat: 48.81,
    maxLng: 2.42,
    maxLat: 48.90,
  },
  US: {
    districtLabel: "Manhattan Clinical Corridor",
    minLng: -74.03,
    minLat: 40.70,
    maxLng: -73.92,
    maxLat: 40.82,
  },
};

export function getPresetForCountry(code: string): ViewportBox {
  return (
    COUNTRY_VIEWPORT_PRESETS[code.trim().toUpperCase()] ??
    COUNTRY_VIEWPORT_PRESETS.INTL!
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
  const halfLng = Math.min(Math.max(((box.maxLng - box.minLng) / 2) * factor, 0.015), 2.5);
  const halfLat = Math.min(Math.max(((box.maxLat - box.minLat) / 2) * factor, 0.015), 2.5);
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
  return Math.max(9, Math.min(17, Math.round(rawZoom)));
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

