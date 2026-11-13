import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLagosDateString, getLagosNow, timeToMinutes } from "@/lib/dates";
import type {
  Course,
  StudySessionWithCourse,
  LectureSessionWithCourse,
} from "@/types";

/**
 * Gets today's calendar date in Africa/Lagos.
 */
async function getLagosToday(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_lagos_date");
  if (!error && typeof data === "string") return data;
  return getLagosDateString();
}

/**
 * Fetch study sessions for a student across a calendar date range [startDate, endDate].
 */
export async function getStudySessionsForDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<StudySessionWithCourse[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*, courses ( course_code, course_title )")
    .eq("user_id", userId)
    .gte("study_date", startDate)
    .lte("study_date", endDate)
    .order("study_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as StudySessionWithCourse[];
}

/**
 * Fetch study sessions for a specific day.
 */
export async function getStudySessionsForDate(
  userId: string,
  date: string
): Promise<StudySessionWithCourse[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*, courses ( course_code, course_title )")
    .eq("user_id", userId)
    .eq("study_date", date)
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as StudySessionWithCourse[];
}

/**
 * Fetch today's study sessions for a student.
 */
export async function getTodayStudySessions(
  userId: string
): Promise<StudySessionWithCourse[]> {
  const today = await getLagosToday();
  return getStudySessionsForDate(userId, today);
}

/**
 * Get the next upcoming incomplete study session from the current Lagos time onwards.
 */
export async function getNextUpcomingStudySession(
  userId: string
): Promise<StudySessionWithCourse | null> {
  const { date: today, time: nowTime } = getLagosNow();
  const supabase = await createServerSupabaseClient();

  // 1. Look for uncompleted sessions today that start after the current time
  const { data: todayUpcoming } = await supabase
    .from("study_sessions")
    .select("*, courses ( course_code, course_title )")
    .eq("user_id", userId)
    .eq("study_date", today)
    .eq("completed", false)
    .gte("start_time", nowTime)
    .order("start_time", { ascending: true })
    .limit(1);

  if (todayUpcoming && todayUpcoming.length > 0) {
    return todayUpcoming[0] as StudySessionWithCourse;
  }

  // 2. Otherwise look for uncompleted sessions on future dates
  const { data: futureUpcoming } = await supabase
    .from("study_sessions")
    .select("*, courses ( course_code, course_title )")
    .eq("user_id", userId)
    .gt("study_date", today)
    .eq("completed", false)
    .order("study_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(1);

  if (futureUpcoming && futureUpcoming.length > 0) {
    return futureUpcoming[0] as StudySessionWithCourse;
  }

  return null;
}

export type WeeklyStudySummary = {
  totalSessions: number;
  completedSessions: number;
  pendingSessions: number;
  overdueSessions: number;
  completionRate: number; // percentage 0 - 100
};

/**
 * Get weekly study completion summary for a student.
 */
export async function getWeeklyStudySummary(
  userId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeeklyStudySummary> {
  const today = await getLagosToday();
  const sessions = await getStudySessionsForDateRange(userId, weekStart, weekEnd);

  const totalSessions = sessions.length;
  let completedSessions = 0;
  let overdueSessions = 0;

  for (const session of sessions) {
    if (session.completed) {
      completedSessions++;
    } else if (session.study_date < today) {
      overdueSessions++;
    }
  }

  const pendingSessions = totalSessions - completedSessions;
  const completionRate =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  return {
    totalSessions,
    completedSessions,
    pendingSessions,
    overdueSessions,
    completionRate,
  };
}

/**
 * Get recently completed study sessions.
 */
export async function getRecentlyCompletedStudySessions(
  userId: string,
  limit = 5
): Promise<StudySessionWithCourse[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*, courses ( course_code, course_title )")
    .eq("user_id", userId)
    .eq("completed", true)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("study_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as StudySessionWithCourse[];
}

/**
 * Fetch official lectures for a date range so students can see them alongside their study sessions.
 */
export async function getOfficialLecturesForDateRange(
  startDate: string,
  endDate: string
): Promise<LectureSessionWithCourse[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lecture_sessions")
    .select("*, courses ( course_code, course_title )")
    .gte("lecture_date", startDate)
    .lte("lecture_date", endDate)
    .order("lecture_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as LectureSessionWithCourse[];
}

/**
 * Central course catalogue fetcher.
 */
export async function getCourses(): Promise<Course[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("course_code", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Course[];
}

