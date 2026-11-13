/**
 * Pure timetable validation helpers.
 *
 * These functions contain the scheduling rules that were previously duplicated
 * (and partially missing) inside server actions. Keeping them pure makes the
 * rules testable without a database.
 */

import { isValidDateString, normalizeTime, timeToMinutes } from "@/lib/dates";

export type SessionSlot = {
  id?: string;
  course_id: string;
  lecture_date: string;
  start_time: string;
  end_time: string;
  venue: string;
  is_cancelled?: boolean;
};

export type SessionConflict = SessionSlot & {
  course_code?: string | null;
};

export type SessionConflicts = {
  /** Same course, date and start time (hard error). */
  duplicates: SessionConflict[];
  /** Same course, date and overlapping time (hard error). */
  courseOverlaps: SessionConflict[];
  /** Same venue, date and overlapping time (soft warning, bypassable with force). */
  venueOverlaps: SessionConflict[];
};

/**
 * Validates a start/end pair as Lagos wall-clock times.
 * Returns a human-readable error, or null when valid.
 */
export function validateTimeRange(startTime: string, endTime: string): string | null {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (startMinutes === null) return "Start time is invalid.";
  if (endMinutes === null) return "End time is invalid.";
  if (endMinutes <= startMinutes) return "End time must be after start time.";

  return null;
}

/**
 * Validates a PostgreSQL `date` value supplied by a form.
 */
export function validateLectureDate(dateStr: string): string | null {
  if (!dateStr) return "Date is required.";
  if (!isValidDateString(dateStr)) return "Date must be a valid calendar date (YYYY-MM-DD).";
  return null;
}

/**
 * Validates all required fields for a lecture session.
 */
export function validateSessionInput(input: {
  course_id: string;
  lecture_date: string;
  start_time: string;
  end_time: string;
  venue: string;
}): string | null {
  if (!input.course_id) return "Course is required.";

  const dateError = validateLectureDate(input.lecture_date);
  if (dateError) return dateError;

  if (!input.start_time) return "Start time is required.";
  if (!input.end_time) return "End time is required.";
  if (!input.venue.trim()) return "Venue is required.";

  return validateTimeRange(input.start_time, input.end_time);
}

/**
 * True when two half-open time ranges [start, end) overlap.
 * Back-to-back sessions (10:00–11:00 and 11:00–12:00) do not overlap.
 */
export function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const aStartMinutes = timeToMinutes(aStart);
  const aEndMinutes = timeToMinutes(aEnd);
  const bStartMinutes = timeToMinutes(bStart);
  const bEndMinutes = timeToMinutes(bEnd);

  if (
    aStartMinutes === null ||
    aEndMinutes === null ||
    bStartMinutes === null ||
    bEndMinutes === null
  ) {
    return false;
  }

  return aStartMinutes < bEndMinutes && bStartMinutes < aEndMinutes;
}

function sameVenue(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Finds duplicate, course-overlap and venue-overlap conflicts for a candidate
 * session against existing sessions. Cancelled sessions and the candidate's own
 * row (when editing) are ignored.
 */
export function findSessionConflicts(
  candidate: SessionSlot,
  existing: SessionConflict[]
): SessionConflicts {
  const conflicts: SessionConflicts = {
    duplicates: [],
    courseOverlaps: [],
    venueOverlaps: [],
  };

  const candidateStart = normalizeTime(candidate.start_time);

  for (const session of existing) {
    if (session.is_cancelled) continue;
    if (candidate.id && session.id === candidate.id) continue;
    if (session.lecture_date !== candidate.lecture_date) continue;

    const sameCourse = session.course_id === candidate.course_id;
    const sameStart = normalizeTime(session.start_time) === candidateStart;

    if (sameCourse && sameStart) {
      conflicts.duplicates.push(session);
      continue;
    }

    if (!timesOverlap(candidate.start_time, candidate.end_time, session.start_time, session.end_time)) {
      continue;
    }

    if (sameCourse) conflicts.courseOverlaps.push(session);
    if (sameVenue(session.venue, candidate.venue)) conflicts.venueOverlaps.push(session);
  }

  return conflicts;
}

/**
 * True when a non-cancelled session is still upcoming or in progress at the
 * supplied Lagos date/time. A session on a later date is always upcoming.
 */
export function isSessionUpcoming(
  session: Pick<SessionSlot, "lecture_date" | "end_time" | "is_cancelled">,
  nowDate: string,
  nowTime: string
): boolean {
  if (session.is_cancelled) return false;
  if (session.lecture_date > nowDate) return true;
  if (session.lecture_date < nowDate) return false;

  const endMinutes = timeToMinutes(session.end_time);
  const nowMinutes = timeToMinutes(nowTime);

  if (endMinutes === null || nowMinutes === null) return true;
  return endMinutes > nowMinutes;
}

/**
 * Picks the next upcoming or in-progress session from a list ordered by date
 * and start time.
 */
export function pickNextUpcomingSession<T extends SessionSlot>(
  sessions: T[],
  nowDate: string,
  nowTime: string
): T | null {
  for (const session of sessions) {
    if (isSessionUpcoming(session, nowDate, nowTime)) return session;
  }
  return null;
}

/**
 * Formats conflict rows for a user-facing error message.
 */
export function describeConflicts(conflicts: SessionConflict[]): string {
  return conflicts
    .map((session) => {
      const code = session.course_code ?? "Unknown course";
      return `${code} (${normalizeTime(session.start_time)}–${normalizeTime(session.end_time)})`;
    })
    .join(", ");
}
