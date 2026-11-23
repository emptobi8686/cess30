import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Course } from "@/types";

export type CourseWithArchive = Course & { archived_at: string | null };

export async function getCourses(options?: { includeArchived?: boolean }): Promise<CourseWithArchive[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase.from("courses").select("*").order("course_code", { ascending: true });
  if (!options?.includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query;
  if (error) throw new Error("Could not load the course catalogue.");
  return (data ?? []) as CourseWithArchive[];
}
