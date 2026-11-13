import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Course } from "@/types";

/**
 * Fetch the full 200-level Civil Engineering course catalogue.
 * Used in dropdowns throughout the app (timetable form, announcement form).
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
