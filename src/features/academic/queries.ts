import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildVerificationSearchFilter } from "@/lib/postgrest";

export type Semester = {
  id: string;
  session_id: string;
  number: number;
  label: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
};

export type AcademicSession = {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
  semesters: Semester[];
};

export async function getAcademicSessions(): Promise<AcademicSession[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("academic_sessions")
    .select("id, label, starts_on, ends_on, is_current, semesters ( id, session_id, number, label, starts_on, ends_on, is_current )")
    .order("starts_on", { ascending: false });
  if (error) throw new Error("Could not load academic sessions.");
  return ((data ?? []) as AcademicSession[]).map((session) => ({
    ...session,
    semesters: [...(session.semesters ?? [])].sort((a, b) => a.number - b.number),
  }));
}

export function currentLabels(sessions: AcademicSession[]): { session: string | null; semester: string | null } {
  const session = sessions.find((s) => s.is_current) ?? null;
  const semester = session?.semesters.find((s) => s.is_current) ?? null;
  return { session: session?.label ?? null, semester: semester?.label ?? null };
}

export type OfferingRow = {
  id: string;
  level_code: string;
  status: string;
  semester_id: string;
  courses: { course_code: string; course_title: string; credit_units: number } | null;
};

export async function getOfferings(filter: { semesterId: string; levelCode?: string | null }): Promise<OfferingRow[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("course_offerings")
    .select("id, level_code, status, semester_id, courses ( course_code, course_title, credit_units )")
    .eq("semester_id", filter.semesterId)
    .order("level_code");
  if (filter.levelCode) query = query.eq("level_code", filter.levelCode);
  const { data, error } = await query;
  if (error) throw new Error("Could not load course offerings.");
  return ((data ?? []) as unknown as OfferingRow[]).sort((a, b) =>
    a.level_code === b.level_code
      ? (a.courses?.course_code ?? "").localeCompare(b.courses?.course_code ?? "")
      : a.level_code.localeCompare(b.level_code)
  );
}

export type PlacementQueueRow = {
  id: string;
  level_code: string;
  status: string;
  created_at: string;
  profiles: { full_name: string; matric_number: string | null; verification_status: string } | null;
};

export async function getPlacementQueue(filter: { status: string; levelCode?: string | null }): Promise<PlacementQueueRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data: session } = await supabase.from("academic_sessions").select("id").eq("is_current", true).maybeSingle();
  if (!session) return [];
  let query = supabase
    .from("student_placements")
    .select("id, level_code, status, created_at, profiles ( full_name, matric_number, verification_status )")
    .eq("session_id", session.id)
    .eq("status", filter.status)
    .order("level_code")
    .order("created_at");
  if (filter.levelCode) query = query.eq("level_code", filter.levelCode);
  const { data, error } = await query;
  if (error) throw new Error("Could not load placements.");
  return (data ?? []) as unknown as PlacementQueueRow[];
}

export type EnrollmentRow = {
  id: string;
  student_id: string;
  enrolment_type: string;
  status: string;
  source: string;
  profiles: { full_name: string; matric_number: string | null } | null;
};

export async function getOfferingEnrollments(offeringId: string): Promise<EnrollmentRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("course_enrollments")
    .select("id, student_id, enrolment_type, status, source, profiles!course_enrollments_student_id_fkey ( full_name, matric_number )")
    .eq("offering_id", offeringId)
    .eq("status", "active")
    .order("created_at");
  if (error) throw new Error("Could not load enrolments.");
  return ((data ?? []) as unknown as EnrollmentRow[]).sort((a, b) =>
    (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? "")
  );
}

export type StudentSearchRow = { id: string; full_name: string; matric_number: string | null; level: string | null };

export async function searchStudents(query: string): Promise<StudentSearchRow[]> {
  const filter = buildVerificationSearchFilter(query);
  if (!filter) return [];
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, matric_number, level")
    .eq("verification_status", "verified")
    .or(filter)
    .order("full_name")
    .limit(10);
  if (error) throw new Error("Could not search students.");
  return (data ?? []) as StudentSearchRow[];
}
