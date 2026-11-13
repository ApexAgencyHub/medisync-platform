export interface ScheduleWindow {
  id: string;
  dayOfWeek: number;
  startTimeUtc: string;
  endTimeUtc: string;
  slotDurationMinutes: number;
}

export interface GeneratedSlot {
  slotStartIso: string;
  slotEndIso: string;
  startMs: number;
  endMs: number;
}

export interface ParsedUtcDate {
  dateStr: string;
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
  dayStartMs: number;
  dayEndMs: number;
}

export function parseHhMmMinutes(value: string): number {
  const [hoursStr, minutesStr] = value.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid HH:MM time string: ${value}`);
  }
  return hours * 60 + minutes;
}

export function parseUtcDate(dateStr: string): ParsedUtcDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const check = new Date(ms);

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    dateStr,
    year,
    month,
    day,
    dayOfWeek: check.getUTCDay(),
    dayStartMs: ms,
    dayEndMs: ms + 24 * 60 * 60 * 1000,
  };
}

export function generateScheduleSlotsForDate(
  schedule: ScheduleWindow,
  parsedDate: ParsedUtcDate,
): GeneratedSlot[] {
  if (schedule.dayOfWeek !== parsedDate.dayOfWeek) {
    return [];
  }

  const startMinutes = parseHhMmMinutes(schedule.startTimeUtc);
  const endMinutes = parseHhMmMinutes(schedule.endTimeUtc);
  const durationMs = schedule.slotDurationMinutes * 60 * 1000;

  if (durationMs <= 0 || endMinutes - startMinutes < schedule.slotDurationMinutes) {
    return [];
  }

  const slots: GeneratedSlot[] = [];
  for (
    let cursorMin = startMinutes;
    cursorMin + schedule.slotDurationMinutes <= endMinutes;
    cursorMin += schedule.slotDurationMinutes
  ) {
    const startMs = parsedDate.dayStartMs + cursorMin * 60 * 1000;
    const endMs = startMs + durationMs;
    slots.push({
      slotStartIso: new Date(startMs).toISOString(),
      slotEndIso: new Date(endMs).toISOString(),
      startMs,
      endMs,
    });
  }

  return slots;
}

export function hasTimeOverlap(
  aStartMs: number,
  aEndMs: number,
  bStartMs: number,
  bEndMs: number,
): boolean {
  return aStartMs < bEndMs && aEndMs > bStartMs;
}
