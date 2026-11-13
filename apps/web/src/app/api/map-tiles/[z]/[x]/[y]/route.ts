import { NextResponse } from "next/server";

const TILE_SIZE = 256;
const TILE_TIMEOUT_MS = 2500;

function parseIntCoord(raw: string): number | null {
  const cleaned = raw.trim().replace(/\.png$/i, "");
  if (!/^-?\d+$/.test(cleaned)) {
    return null;
  }
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildFallbackStreetTileSvg(z: number, x: number, y: number): string {
  const seed = Math.abs((z * 73856093) ^ (x * 19349663) ^ (y * 83492791));
  const variant = seed % 5;
  const parkX = 24 + ((seed >> 3) % 120);
  const parkY = 24 + ((seed >> 7) % 120);
  const parkW = 48 + ((seed >> 11) % 52);
  const parkH = 38 + ((seed >> 13) % 44);
  const diagonalShift = ((seed >> 5) % 90) - 45;
  const hasCanal = variant === 2 || variant === 4;
  const hasRoundabout = variant === 1 || variant === 3;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${TILE_SIZE}" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}">
  <rect width="${TILE_SIZE}" height="${TILE_SIZE}" fill="#f2f4ef"/>
  <rect x="${parkX}" y="${parkY}" width="${parkW}" height="${parkH}" rx="8" fill="#dcece3"/>
  ${
    hasCanal
      ? `<path d="M -20 ${190 + diagonalShift * 0.4} Q 128 ${150 - diagonalShift * 0.3} 276 ${200 + diagonalShift * 0.2}" fill="none" stroke="#cde4f0" stroke-width="26" stroke-linecap="round"/>`
      : ""
  }
  <g stroke="#e4e8e3" stroke-width="6" fill="none">
    <line x1="64" y1="0" x2="64" y2="256"/>
    <line x1="128" y1="0" x2="128" y2="256"/>
    <line x1="192" y1="0" x2="192" y2="256"/>
    <line x1="0" y1="64" x2="256" y2="64"/>
    <line x1="0" y1="128" x2="256" y2="128"/>
    <line x1="0" y1="192" x2="256" y2="192"/>
  </g>
  <g stroke="#d5dde2" stroke-width="11" fill="none" stroke-linecap="round">
    <line x1="0" y1="${88 + diagonalShift * 0.3}" x2="256" y2="${96 - diagonalShift * 0.2}"/>
    <line x1="${108 - diagonalShift * 0.25}" y1="0" x2="${122 + diagonalShift * 0.25}" y2="256"/>
  </g>
  <g stroke="#ffffff" stroke-width="8" fill="none" stroke-linecap="round">
    <line x1="0" y1="${88 + diagonalShift * 0.3}" x2="256" y2="${96 - diagonalShift * 0.2}"/>
    <line x1="${108 - diagonalShift * 0.25}" y1="0" x2="${122 + diagonalShift * 0.25}" y2="256"/>
  </g>
  <g stroke="#e9dec4" stroke-width="5" fill="none">
    <line x1="0" y1="224" x2="256" y2="224"/>
  </g>
  ${
    hasRoundabout
      ? `<circle cx="115" cy="92" r="14" fill="#dcece3" stroke="#d5dde2" stroke-width="5"/>`
      : ""
  }
</svg>`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> },
): Promise<Response> {
  const { z: rawZ, x: rawX, y: rawY } = await context.params;
  const parsedZ = parseIntCoord(rawZ);
  const parsedX = parseIntCoord(rawX);
  const parsedY = parseIntCoord(rawY);

  const safeZ = parsedZ === null ? 12 : Math.max(1, Math.min(19, parsedZ));
  const worldTiles = Math.pow(2, safeZ);
  const safeX =
    parsedX === null
      ? 0
      : ((parsedX % worldTiles) + worldTiles) % worldTiles;
  const safeY =
    parsedY === null
      ? 0
      : Math.max(0, Math.min(worldTiles - 1, parsedY));

  const tileSources: Array<{ origin: string; url: string }> = [
    {
      origin: "openstreetmap",
      url: `https://tile.openstreetmap.org/${safeZ}/${safeX}/${safeY}.png`,
    },
    {
      origin: "esri-world-street",
      url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${safeZ}/${safeY}/${safeX}`,
    },
  ];

  for (const source of tileSources) {
    try {
      const upstream = await fetch(source.url, {
        signal: AbortSignal.timeout(TILE_TIMEOUT_MS),
        headers: {
          "User-Agent":
            "MediSyncGlobal/1.0 (+https://github.com/ApexAgencyHub/medisync-platform)",
          Referer: "https://github.com/ApexAgencyHub/medisync-platform",
          Accept: "image/png,image/jpeg,image/webp,image/*;q=0.8",
        },
        next: { revalidate: 86400 },
      });

      const contentType = upstream.headers.get("content-type") ?? "";
      if (upstream.ok && contentType.startsWith("image/")) {
        const buffer = await upstream.arrayBuffer();
        if (buffer.byteLength > 0) {
          return new Response(buffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control":
                "public, max-age=86400, stale-while-revalidate=604800",
              "X-Tile-Origin": source.origin,
            },
          });
        }
      }
    } catch {
      // Offline or blocked upstream falls through to next source / vector fallback.
    }
  }

  const svgTile = buildFallbackStreetTileSvg(safeZ, safeX, safeY);
  return new NextResponse(svgTile, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Tile-Origin": "clinical-vector-fallback",
    },
  });
}
