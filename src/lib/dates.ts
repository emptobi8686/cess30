/**
 * Date/time utilities for BLUEPRINT.
 *
 * All academic dates use Africa/Lagos (WAT, UTC+1) as the canonical timezone.
 *
 * Two different kinds of value are handled here and must never be mixed:
 *
 * 1. Calendar dates (PostgreSQL `date` columns, "YYYY-MM-DD").
 *    These have no timezone. We treat them as pure calendar values: parse the
 *    components, do arithmetic with UTC-based calendar helpers, and format them
 *    explicitly in Africa/Lagos. Never use `new Date("YYYY-MM-DD")` (UTC
 *    midnight) or `toISOString().slice(0, 10)` for these values.
 *
 * 2. Instants (PostgreSQL `timestamptz` columns, ISO-8601 strings).
 *    These are absolute points in time. Format them with an explicit
 *    `timeZone: "Africa/Lagos"` so the server and browser always agree.
 *
 * Server-side code runs in an unknown timezone (usually UTC), so no function in
 * this module relies on the host's local timezone.
 */

export const LAGOS_TZ = "Africa/Lagos";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

type CalendarParts = {
  year: number;
  month: number;
  day: number;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatParts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LAGOS_TZ,
    ...options,
  }).formatToParts(date);

  const result: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar dates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a strict "YYYY-MM-DD" string into calendar components.
 * Returns null for malformed values or impossible dates (e.g. 2025-02-30).
 */
export function parseDateString(value: string): CalendarParts | null {
  const match = DATE_RE.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Round-trip through UTC to reject impossible dates without using local time.
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function isValidDateString(value: string): boolean {
  return parseDateString(value) !== null;
}

/**
 * Formats a UTC calendar date object as "YYYY-MM-DD" using UTC components.
 * This is deliberately not `toISOString().slice(0, 10)` so the intent is clear
 * and the value is never confused with a local calendar date.
 */
function formatCalendarDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Adds days to a calendar date string, using UTC-only arithmetic so host
 * timezone and DST rules cannot shift the result.
 */
export function addDays(dateStr: string, days: number): string {
  const parts = parseDateString(dateStr);
  if (!parts) {
    throw new Error(`Invalid calendar date: ${dateStr}`);
  }

  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + Math.trunc(days));
  return formatCalendarDate(date);
}

/**
 * Day of week for a calendar date: 0 = Sunday … 6 = Saturday.
 */
export function getDayOfWeek(dateStr: string): number {
  const parts = parseDateString(dateStr);
  if (!parts) return 1;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

/**
 * Day-of-month number for a calendar date, independent of host timezone.
 */
export function getDayOfMonth(dateStr: string): number {
  return parseDateString(dateStr)?.day ?? 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Current time in Africa/Lagos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns today's calendar date in Africa/Lagos as "YYYY-MM-DD".
 * Correct on a UTC server because it uses Intl formatting with an explicit zone.
 */
export function getLagosDateString(date: Date = new Date()): string {
  const parts = formatParts(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Returns the current wall-clock time in Africa/Lagos as "HH:MM" (24-hour).
 */
export function getLagosTimeString(date: Date = new Date()): string {
  const parts = formatParts(date, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  // Some ICU builds emit "24" for midnight; normalise it.
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${hour}:${parts.minute}`;
}

export type LagosNow = {
  /** Today's calendar date in Africa/Lagos, "YYYY-MM-DD". */
  date: string;
  /** Current wall-clock time in Africa/Lagos, "HH:MM". */
  time: string;
  /** Minutes since midnight in Africa/Lagos. */
  minutes: number;
};

/**
 * Returns the current date and time in Africa/Lagos in one call.
 */
export function getLagosNow(date: Date = new Date()): LagosNow {
  const dateStr = getLagosDateString(date);
  const timeStr = getLagosTimeString(date);
  return {
    date: dateStr,
    time: timeStr,
    minutes: timeToMinutes(timeStr) ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Week boundaries
// ─────────────────────────────────────────────────────────────────────────────

export type WeekDates = {
  weekStart: string;
  weekEnd: string;
  /** Seven calendar dates, Monday through Sunday. */
  dates: string[];
};

/**
 * Returns the Monday–Sunday week containing a calendar date, shifted by
 * `offsetWeeks`. Uses pure calendar arithmetic (no host timezone).
 */
export function getWeekDatesForDate(referenceDate: string, offsetWeeks = 0): WeekDates {
  const dayOfWeek = getDayOfWeek(referenceDate);
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = addDays(referenceDate, mondayOffset + Math.trunc(offsetWeeks) * 7);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  return { weekStart, weekEnd: dates[6], dates };
}

/**
 * Returns the Monday–Sunday week containing `reference` in Africa/Lagos,
 * shifted by `offsetWeeks`.
 *
 * The reference day is determined in Africa/Lagos, so a request at 23:30 UTC
 * (00:30 Lagos the next day) is treated as the Lagos calendar day.
 */
export function getWeekDates(reference: Date = new Date(), offsetWeeks = 0): WeekDates {
  return getWeekDatesForDate(getLagosDateString(reference), offsetWeeks);
}

// ─────────────────────────────────────────────────────────────────────────────
// Time-of-day values (PostgreSQL `time`, wall-clock in Africa/Lagos)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses "HH:MM" or "HH:MM:SS" into minutes since midnight.
 * Returns null for invalid or out-of-range values.
 */
export function timeToMinutes(value: string): number | null {
  const match = TIME_RE.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);

  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  return hours * 60 + minutes + seconds / 60;
}

export function isValidTimeString(value: string): boolean {
  return timeToMinutes(value) !== null;
}

/**
 * Normalises "HH:MM:SS" / "HH:MM" to "HH:MM".
 */
export function normalizeTime(value: string): string {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value;
  const hours = Math.floor(minutes / 60) % 24;
  return `${pad(hours)}:${pad(Math.floor(minutes % 60))}`;
}

/**
 * Formats a "HH:MM:SS" or "HH:MM" wall-clock time as "9:00 AM" / "2:30 PM".
 * Times are already Lagos wall-clock values; no timezone conversion is applied.
 */
export function formatTime(timeStr: string): string {
  const minutes = timeToMinutes(timeStr);
  if (minutes === null) return timeStr;

  const total = Math.floor(minutes);
  const hours24 = Math.floor(total / 60) % 24;
  const minutesPart = total % 60;
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const hour = hours24 % 12 || 12;

  return `${hour}:${pad(minutesPart)} ${ampm}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Display formatting (explicit Africa/Lagos timezone)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a calendar date to a UTC noon instant. Formatting that instant in
 * Africa/Lagos (UTC+1) always yields the same calendar date, regardless of the
 * host timezone.
 */
function calendarDateToLagosNoon(dateStr: string): Date {
  const parts = parseDateString(dateStr);
  if (!parts) return new Date(Number.NaN);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
}

/**
 * Formats a "YYYY-MM-DD" calendar date for display in the en-NG locale,
 * explicitly in Africa/Lagos.
 */
export function formatDisplayDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  }
): string {
  const date = calendarDateToLagosNoon(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;

  return date.toLocaleDateString("en-NG", {
    ...options,
    timeZone: LAGOS_TZ,
  });
}

/**
 * Formats a calendar date as a short weekday label (e.g. "Mon").
 */
export function formatShortDay(dateStr: string): string {
  return formatDisplayDate(dateStr, { weekday: "short" });
}

/**
 * Formats a week range as "6 Oct – 12 Oct 2025".
 */
export function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const start = formatDisplayDate(weekStart, {
    day: "numeric",
    month: "short",
  });
  const end = formatDisplayDate(weekEnd, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${start} – ${end}`;
}

/**
 * Formats an ISO timestamp (an instant, e.g. announcement `published_at`) for
 * display in Africa/Lagos. The explicit timezone prevents a publication at
 * 23:30 UTC from appearing on the previous day.
 */
export function formatTimestamp(
  isoStr: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
): string {
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-NG", {
    ...options,
    timeZone: LAGOS_TZ,
  });
}
