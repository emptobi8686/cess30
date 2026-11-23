import { createServerSupabaseClient } from "@/lib/supabase/server";

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
