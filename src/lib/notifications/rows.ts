import { firstRelation } from "@/lib/supabase/relations";

export type CourseAudience = { course_code: string; department: string; level: string };

export type LectureRow = {
  id: string;
  lecture_date: string;
  start_time: string;
  is_cancelled: boolean;
  courses: CourseAudience | CourseAudience[] | null;
};

export type TargetingProfile = {
  id: string;
  department: string;
  level: string;
  verification_status: string;
};

/** The lecture's course, whichever shape PostgREST used for the embed (BP-012). */
export function lectureCourse(row: LectureRow): CourseAudience | null {
  return firstRelation(row.courses);
}

/**
 * Notification recipients: verified students only. Administrators are excluded
 * unless they also hold the student role (e.g. a course representative).
 */
export function eligibleNotificationProfiles<P extends TargetingProfile>(
  profiles: P[],
  roleRows: Array<{ user_id: string; role: string }>
): P[] {
  const admins = new Set(roleRows.filter((r) => r.role === "admin").map((r) => r.user_id));
  const students = new Set(roleRows.filter((r) => r.role === "student").map((r) => r.user_id));
  return profiles.filter(
    (profile) =>
      profile.verification_status === "verified" &&
      (!admins.has(profile.id) || students.has(profile.id))
  );
}
