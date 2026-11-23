export interface TimeIntervalItem<T> {
  id: string;
  startMin: number;
  endMin: number;
  item: T;
}

export interface PackedTimeInterval<T> {
  id: string;
  startMin: number;
  endMin: number;
  colIndex: number;
  colCount: number;
  item: T;
}

export function parseHhMmToMinutes(hhmm: string): number {
  const parts = hhmm.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(24 * 60, h * 60 + m));
}

export function formatMinutesToHhMm(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 55, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function snapMinutes(minutes: number, stepMinutes = 30): number {
  return Math.round(minutes / stepMinutes) * stepMinutes;
}

export function estimateSlotCount(
  startHhMm: string,
  endHhMm: string,
  slotDurationMinutes: number,
): number {
  const start = parseHhMmToMinutes(startHhMm);
  const end = parseHhMmToMinutes(endHhMm);
  if (end <= start || slotDurationMinutes <= 0) return 0;
  return Math.floor((end - start) / slotDurationMinutes);
}

export function toIsoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addUtcDays(isoDate: string, delta: number): string {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return toIsoDateOnly(new Date());
  }
  parsed.setUTCDate(parsed.getUTCDate() + delta);
  return toIsoDateOnly(parsed);
}

/**
 * Returns the ISO date (YYYY-MM-DD) of Monday for the week containing `isoDate`.
 */
export function getWeekStartMondayIso(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return toIsoDateOnly(new Date());
  }
  const dow = parsed.getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = (dow + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - mondayOffset);
  return toIsoDateOnly(parsed);
}

export interface MonthGridCell {
  iso: string;
  dayNumber: number;
  dayOfWeek: number;
  inCurrentMonth: boolean;
}

export function getMonthGridCells(year: number, monthIndex: number): MonthGridCell[] {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const startDow = firstOfMonth.getUTCDay();
  const mondayOffset = (startDow + 6) % 7;
  const gridStart = new Date(Date.UTC(year, monthIndex, 1 - mondayOffset));
  return Array.from({ length: 42 }, (_, idx) => {
    const cell = new Date(gridStart.getTime());
    cell.setUTCDate(gridStart.getUTCDate() + idx);
    return {
      iso: toIsoDateOnly(cell),
      dayNumber: cell.getUTCDate(),
      dayOfWeek: cell.getUTCDay(),
      inCurrentMonth: cell.getUTCMonth() === monthIndex,
    };
  });
}

const FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getCachedFormatter(
  localeTag: string,
  key: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const cacheKey = `${localeTag}:${key}`;
  const existing = FORMATTER_CACHE.get(cacheKey);
  if (existing) return existing;
  const created = new Intl.DateTimeFormat(localeTag, options);
  FORMATTER_CACHE.set(cacheKey, created);
  return created;
}

export function formatMonthHeading(isoDate: string, locale: string): string {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate.slice(0, 7);
  const tag = locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US";
  try {
    return getCachedFormatter(tag, "monthYear", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed);
  } catch {
    return isoDate.slice(0, 7);
  }
}

export function formatWeekRangeHeading(mondayIso: string, locale: string): string {
  const start = new Date(`${mondayIso}T00:00:00.000Z`);
  const endIso = addUtcDays(mondayIso, 6);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${mondayIso} – ${endIso}`;
  }
  const tag = locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US";
  try {
    const sameMonth =
      start.getUTCMonth() === end.getUTCMonth() &&
      start.getUTCFullYear() === end.getUTCFullYear();
    const startStr = getCachedFormatter(tag, "shortMonthDay", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(start);
    if (sameMonth) {
      return `${startStr} – ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
    }
    const endStr = getCachedFormatter(tag, "shortMonthDayYear", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(end);
    return `${startStr} – ${endStr}`;
  } catch {
    return `${mondayIso} – ${endIso}`;
  }
}

export function formatDayHeading(isoDate: string, locale: string): string {
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  const tag = locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-US";
  try {
    return getCachedFormatter(tag, "fullDay", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed);
  } catch {
    return isoDate;
  }
}

/**
 * Google Calendar–style overlapping event column packer.
 * Groups overlapping intervals into connected clusters and assigns each item
 * a non-colliding `colIndex` and shared `colCount` so dense calendars never overlap.
 */
export function packTimeIntervals<T>(
  rawItems: ReadonlyArray<TimeIntervalItem<T>>,
): Array<PackedTimeInterval<T>> {
  if (rawItems.length === 0) return [];

  const sorted = [...rawItems]
    .map((entry) => ({
      ...entry,
      endMin: Math.max(entry.startMin + 15, entry.endMin),
    }))
    .sort((a, b) => {
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      return b.endMin - a.endMin;
    });

  const clusters: Array<Array<TimeIntervalItem<T>>> = [];
  let currentCluster: Array<TimeIntervalItem<T>> = [];
  let clusterEnd = -1;

  for (const item of sorted) {
    if (currentCluster.length === 0 || item.startMin < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.endMin;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const packed: Array<PackedTimeInterval<T>> = [];
  for (const cluster of clusters) {
    const columnEndTimes: number[] = [];
    const assigned: Array<{ entry: TimeIntervalItem<T>; colIndex: number }> = [];

    for (const entry of cluster) {
      let colIndex = columnEndTimes.findIndex((endTime) => endTime <= entry.startMin);
      if (colIndex === -1) {
        colIndex = columnEndTimes.length;
        columnEndTimes.push(entry.endMin);
      } else {
        columnEndTimes[colIndex] = entry.endMin;
      }
      assigned.push({ entry, colIndex });
    }

    const colCount = Math.max(1, columnEndTimes.length);
    for (const { entry, colIndex } of assigned) {
      packed.push({
        id: entry.id,
        startMin: entry.startMin,
        endMin: entry.endMin,
        colIndex,
        colCount,
        item: entry.item,
      });
    }
  }

  return packed;
}
