import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLagosDateString, getLagosNow } from "@/lib/dates";
import type { LectureSessionWithCourse } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gets today's date string in Africa/Lagos.
 * Tries the database's get_lagos_date() function first (most accurate since
 * the DB runs in UTC and the function does the tz conversion in PG).
 * Falls back to the app-level getLagosDateString() using Intl if the RPC fails.
 */
async function getLagosToday(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_lagos_date");
  if (!error && typeof data === "string") return data;
  // Fallback: use Intl-based conversion in Node
  return getLagosDateString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all lecture sessions for a given week range (inclusive).
 * `weekStart` and `weekEnd` are PostgreSQL DATE values, never timestamps.
 */
export async function getSessionsForWeek(
  weekStart: string,
  weekEnd: string
): Promise<LectureSessionWithCourse[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lecture_sessions")
    .select(`*, courses ( course_code, course_title )`)
    .gte("lecture_date", weekStart)
    .lte("lecture_date", weekEnd)
    .order("lecture_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as LectureSessionWithCourse[];
}

/**
 * Fetch sessions for today in Africa/Lagos. Cancelled sessions are included so
 * the UI can display them explicitly as cancelled.
 */
export async function getTodaySessions(): Promise<LectureSessionWithCourse[]> {
  const today = await getLagosToday();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lecture_sessions")
    .select(`*, courses ( course_code, course_title )`)
    .eq("lecture_date", today)
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as LectureSessionWithCourse[];
}

/**
 * Fetch the next non-cancelled session that has not already ended.
 *
 * A session on today's Lagos date is only "upcoming" while its end time is in
 * the future. Sessions that finished earlier today are skipped, and the next
 * future date is used instead.
 */
export async function getNextUpcomingSession(): Promise<LectureSessionWithCourse | null> {
  const today = await getLagosToday();
  const now = getLagosNow();
  const supabase = await createServerSupabaseClient();

  // 1. A session later today that is still in progress or yet to start.
  const { data: todayData, error: todayError } = await supabase
    .from("lecture_sessions")
    .select(`*, courses ( course_code, course_title )`)
    .eq("is_cancelled", false)
    .eq("lecture_date", today)
    .gt("end_time", now.time)
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (todayError) throw new Error(todayError.message);
  if (todayData) return todayData as LectureSessionWithCourse;

  // 2. Otherwise, the first session on a later Lagos calendar date.
  const { data: futureData, error: futureError } = await supabase
    .from("lecture_sessions")
    .select(`*, courses ( course_code, course_title )`)
    .eq("is_cancelled", false)
    .gt("lecture_date", today)
    .order("lecture_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (futureError) throw new Error(futureError.message);
  return (futureData as LectureSessionWithCourse | null) ?? null;
}

/**
 * Fetch all sessions ordered by date + time (admin view).
 */
export async function getAllSessions(): Promise<LectureSessionWithCourse[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lecture_sessions")
    .select(`*, courses ( course_code, course_title )`)
    .order("lecture_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as LectureSessionWithCourse[];
}

/**
 * Fetch a single session by ID.
 */
export async function getSessionById(id: string): Promise<LectureSessionWithCourse | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lecture_sessions")
    .select(`*, courses ( course_code, course_title )`)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as LectureSessionWithCourse | null;
}
