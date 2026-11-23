"use server";

import { revalidatePath } from "next/cache";
import { courseSchema } from "@/features/courses/validation";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { accessErrorMessage, requireAdmin } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function revalidateCourses() {
  revalidatePath("/admin/courses");
  revalidatePath("/admin/timetable");
  revalidatePath("/study-planner");
  revalidatePath("/admin");
}

function readCourseId(formData: FormData): string | null {
  const id = String(formData.get("courseId") ?? "").trim();
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

function readCourse(formData: FormData) {
  return courseSchema.safeParse({
    course_code: String(formData.get("course_code") ?? ""),
    course_title: String(formData.get("course_title") ?? ""),
    credit_units: String(formData.get("credit_units") ?? ""),
    level: String(formData.get("level") ?? ""),
  });
}

export async function createCourseAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const parsed = readCourse(formData);
    if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Check the course details.");

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("courses").insert(parsed.data);
    if (error) {
      if (error.code === "23505") return errorState("A course with this code already exists.");
      return errorState("The course could not be created.");
    }
    revalidateCourses();
    return successState(`${parsed.data.course_code} added.`);
  } catch (error) {
    return errorState(accessErrorMessage(error, "The course could not be created."));
  }
}

export async function updateCourseAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const courseId = readCourseId(formData);
    if (!courseId) return errorState("A valid course is required.");
    const parsed = readCourse(formData);
    if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Check the course details.");

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("courses")
      .update(parsed.data)
      .eq("id", courseId)
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") return errorState("A course with this code already exists.");
      return errorState("The course could not be saved.");
    }
    if (!data) return errorState("Course not found.");
    revalidateCourses();
    return successState("Course saved.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The course could not be saved."));
  }
}

async function setArchived(formData: FormData, archived: boolean): Promise<ActionState> {
  try {
    await requireAdmin();
    const courseId = readCourseId(formData);
    if (!courseId) return errorState("A valid course is required.");
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("courses")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", courseId)
      .select("id")
      .maybeSingle();
    if (error || !data) return errorState("The course could not be updated.");
    revalidateCourses();
    return successState(archived ? "Course archived." : "Course restored.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The course could not be updated."));
  }
}

export async function archiveCourseAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return setArchived(formData, true);
}

export async function restoreCourseAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return setArchived(formData, false);
}

export async function deleteCourseAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const courseId = readCourseId(formData);
    if (!courseId) return errorState("A valid course is required.");
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("courses").delete().eq("id", courseId).select("id").maybeSingle();
    if (error) {
      if (error.code === "23503") {
        return errorState("Archive this course instead; it is referenced by timetable entries.");
      }
      return errorState("The course could not be deleted.");
    }
    if (!data) return errorState("Course not found.");
    revalidateCourses();
    return successState("Course deleted.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The course could not be deleted."));
  }
}
