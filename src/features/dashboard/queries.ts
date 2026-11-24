import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Course } from "@/types";

/**
 * Fetch the Civil Engineering course catalogue (all levels).
 * Used in dropdowns throughout the app (timetable form, announcement form).
 */
export async function getCourses(): Promise<Course[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .is("archived_at", null)
    .order("course_code", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Course[];
}
