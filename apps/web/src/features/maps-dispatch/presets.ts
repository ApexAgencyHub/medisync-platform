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
