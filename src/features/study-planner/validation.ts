import { z } from "zod";
/**
 * Pure validation, recurrence scheduling, and conflict detection rules for Study Planner.
 */

import {
  isValidDateString,
  timeToMinutes,
  addDays,
  getDayOfWeek,
  parseDateString,
} from "@/lib/dates";
import type {
  ReminderPreference,
  RecurrencePattern,
  StudySession,
  LectureSession,
} from "@/types";

export type CreateStudySessionInput = {
  course_id?: string | null;
  title: string;
  study_date: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
  location?: string | null;
  reminder_preference?: ReminderPreference;
  recurrence_pattern?: RecurrencePattern | null;
  recurrence_end_date?: string | null;
  selected_weekdays?: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
};

export const VALID_REMINDERS: ReminderPreference[] = [
  "none",
  "15_min",
  "30_min",
  "1_hour",
  "1_day",
];

export const VALID_PATTERNS: RecurrencePattern[] = [
  "daily",
  "weekly",
  "selected_weekdays",
];

/**
 * Validates a start/end time pair for a study session.
 */
export function validateStudyTimeRange(startTime: string, endTime: string): string | null {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (startMinutes === null) return "Start time is invalid.";
  if (endMinutes === null) return "End time is invalid.";
  if (endMinutes <= startMinutes) return "End time must be after start time.";

  const duration = endMinutes - startMinutes;
  if (duration < 15) return "Study sessions must be at least 15 minutes long.";
  if (duration > 720) return "A single study session cannot exceed 12 hours.";

  return null;
}

/**
 * Validates a calendar date string.
 */
export function validateStudyDate(dateStr: string): string | null {
  if (!dateStr) return "Study date is required.";
  if (!isValidDateString(dateStr)) {
    return "Study date must be a valid calendar date (YYYY-MM-DD).";
  }
  return null;
}

/**
 * Checks whether two time intervals on the same day overlap.
 * [startA, endA) and [startB, endB) overlap if max(startA, startB) < min(endA, endB).
 */
export function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);

  if (sA === null || eA === null || sB === null || eB === null) return false;
  return Math.max(sA, sB) < Math.min(eA, eB);
}

/**
 * Generates an array of unique "YYYY-MM-DD" calendar dates for recurring study sessions.
 * Capped at 90 days and at most 60 occurrences to prevent unbounded generation.
 */
export function generateRecurringDates(
  startDate: string,
  endDate: string,
  pattern: RecurrencePattern,
  selectedWeekdays: number[] = []
): string[] {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) return [startDate];

  const startParts = parseDateString(startDate);
  const endParts = parseDateString(endDate);
  if (!startParts || !endParts) return [startDate];

  const startUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
  if (endUtc < startUtc) return [startDate];

  const MAX_DAYS = 90;
  const MAX_SESSIONS = 60;
  const result: string[] = [];

  let currentDate = startDate;
  let dayOffset = 0;

  // Normalise weekdays if empty for selected_weekdays: default to the start date's day of week
  const targetDays =
    pattern === "selected_weekdays"
      ? selectedWeekdays.length > 0
        ? selectedWeekdays
        : [getDayOfWeek(startDate)]
      : [];

  while (dayOffset <= MAX_DAYS && result.length < MAX_SESSIONS) {
    const isPastEnd = currentDate > endDate;
    if (isPastEnd) break;

    const dow = getDayOfWeek(currentDate);

    if (pattern === "daily") {
      result.push(currentDate);
      currentDate = addDays(currentDate, 1);
      dayOffset += 1;
    } else if (pattern === "weekly") {
      result.push(currentDate);
      currentDate = addDays(currentDate, 7);
      dayOffset += 7;
    } else if (pattern === "selected_weekdays") {
      if (targetDays.includes(dow)) {
        result.push(currentDate);
      }
      currentDate = addDays(currentDate, 1);
      dayOffset += 1;
    } else {
      result.push(startDate);
      break;
    }
  }

  // Ensure start date is in the result if matching
  if (!result.includes(startDate) && result.length < MAX_SESSIONS) {
    result.unshift(startDate);
  }

  return Array.from(new Set(result)).sort();
}

/**
 * Conflict detection between a proposed session and existing events on that date.
 */
export type DetectedConflicts = {
  studyConflicts: StudySession[];
  lectureConflicts: LectureSession[];
};

export function detectConflicts(
  targetDate: string,
  startTime: string,
  endTime: string,
  existingStudySessions: StudySession[],
  lectureSessions: LectureSession[],
  ignoreSessionId?: string
): DetectedConflicts {
  const studyConflicts = existingStudySessions.filter((s) => {
    if (ignoreSessionId && s.id === ignoreSessionId) return false;
    if (s.study_date !== targetDate) return false;
    return timesOverlap(startTime, endTime, s.start_time, s.end_time);
  });

  const lectureConflicts = lectureSessions.filter((l) => {
    if (l.is_cancelled) return false;
    if (l.lecture_date !== targetDate) return false;
    return timesOverlap(startTime, endTime, l.start_time, l.end_time);
  });

  return { studyConflicts, lectureConflicts };
}


/** Shared field rules for creating, editing and rescheduling study sessions (BP-049). */
export const studySessionFields = z.object({
  title: z.string().trim().min(1, "Study goal/title is required.").max(150, "Study title cannot exceed 150 characters."),
  study_date: z.string().refine((value) => validateStudyDate(value) === null, "Choose a valid study date."),
  start_time: z.string(),
  end_time: z.string(),
  notes: z.string().trim().max(1000, "Notes cannot exceed 1000 characters.").optional().nullable(),
  location: z.string().trim().max(120, "Location cannot exceed 120 characters.").optional().nullable(),
  course_id: z
    .union([z.literal(""), z.literal("none"), z.string().uuid("Choose a valid course.")])
    .optional()
    .nullable(),
});

function checkTimes(value: { start_time: string; end_time: string }, ctx: z.RefinementCtx) {
  const timeError = validateStudyTimeRange(value.start_time, value.end_time);
  if (timeError) ctx.addIssue({ code: "custom", message: timeError, path: ["end_time"] });
}

export const studySessionSchema = studySessionFields.superRefine(checkTimes);

/** Editing keeps each session's own date. */
export const studySessionUpdateSchema = studySessionFields.omit({ study_date: true }).superRefine(checkTimes);

export function firstSchemaIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? "Check the study session details.";
}
