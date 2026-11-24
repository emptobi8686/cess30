"use server";

import { revalidatePath } from "next/cache";
import { LEVEL_CODES, semesterSchema, sessionSchema } from "@/features/academic/validation";
import { isEnrolmentType, levelEnrolMessage } from "@/features/academic/enrollments";
import { bulkOfferingMessage, OFFERING_STATUSES, selectedCourseIds } from "@/features/academic/offerings";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { accessErrorMessage, requireAdmin, requireStaff } from "@/lib/auth/guards";
import { logServerError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

function revalidateAcademic() {
  revalidatePath("/admin/academic", "layout");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

function dbMessage(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === "23505") return "That already exists.";
  if (error.code === "23514") return error.message?.startsWith("Semester dates") ? error.message : "Check the dates.";
  if (error.code === "23503") return "It is still in use and cannot be removed.";
  const known = ["The semester must belong to the current academic session.", "Academic session not found."];
  if (error.message && known.includes(error.message)) return error.message;
  return fallback;
}

export async function createSessionAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const parsed = sessionSchema.safeParse({
      label: String(formData.get("label") ?? ""),
      starts_on: String(formData.get("starts_on") ?? ""),
      ends_on: String(formData.get("ends_on") ?? ""),
    });
    if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Check the session details.");
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("academic_sessions").insert(parsed.data);
    if (error) {
      logServerError("academic.createSession", error);
      return errorState(dbMessage(error, "The session could not be created."));
    }
    revalidateAcademic();
    return successState(`Session ${parsed.data.label} created.`);
  } catch (error) {
    return errorState(accessErrorMessage(error, "The session could not be created."));
  }
}

export async function createSemesterAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const sessionId = String(formData.get("sessionId") ?? "");
    if (!UUID.test(sessionId)) return errorState("Choose a session.");
    const parsed = semesterSchema.safeParse({
      number: String(formData.get("number") ?? ""),
      label: String(formData.get("label") ?? ""),
      starts_on: String(formData.get("starts_on") ?? ""),
      ends_on: String(formData.get("ends_on") ?? ""),
    });
    if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Check the semester details.");
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("semesters").insert({ ...parsed.data, session_id: sessionId });
    if (error) {
      logServerError("academic.createSemester", error);
      return errorState(dbMessage(error, "The semester could not be created."));
    }
    revalidateAcademic();
    return successState(`${parsed.data.label} added.`);
  } catch (error) {
    return errorState(accessErrorMessage(error, "The semester could not be created."));
  }
}

async function setCurrent(rpc: "set_current_session" | "set_current_semester", param: string, id: string, label: string) {
  try {
    await requireAdmin();
    if (!UUID.test(id)) return errorState("Invalid selection.");
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc(rpc, { [param]: id });
    if (error) {
      logServerError(`academic.${rpc}`, error);
      return errorState(dbMessage(error, "Could not update the current period."));
    }
    revalidateAcademic();
    return successState(`${label} is now current.`);
  } catch (error) {
    return errorState(accessErrorMessage(error, "Could not update the current period."));
  }
}

export async function setCurrentSessionAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return setCurrent("set_current_session", "p_session_id", String(formData.get("sessionId") ?? ""), "The session");
}

export async function setCurrentSemesterAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  return setCurrent("set_current_semester", "p_semester_id", String(formData.get("semesterId") ?? ""), "The semester");
}

export async function bulkCreateOfferingsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireStaff();
    const semesterId = String(formData.get("semesterId") ?? "");
    const levelCode = String(formData.get("levelCode") ?? "");
    const courseIds = selectedCourseIds(formData);
    if (!UUID.test(semesterId)) return errorState("Choose a semester.");
    if (!LEVEL_CODES.includes(levelCode as (typeof LEVEL_CODES)[number])) return errorState("Choose a level.");
    if (courseIds.length === 0) return errorState("Select at least one course.");

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("course_offerings")
      .upsert(
        courseIds.map((course_id) => ({ course_id, semester_id: semesterId, level_code: levelCode })),
        { onConflict: "course_id,semester_id,level_code", ignoreDuplicates: true }
      )
      .select("id");
    if (error) {
      logServerError("academic.bulkCreateOfferings", error);
      return errorState(dbMessage(error, "The offerings could not be created."));
    }
    revalidateAcademic();
    return successState(bulkOfferingMessage(courseIds.length, data?.length ?? 0));
  } catch (error) {
    return errorState(accessErrorMessage(error, "The offerings could not be created."));
  }
}

export async function updateOfferingStatusAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireStaff();
    const offeringId = String(formData.get("offeringId") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!UUID.test(offeringId)) return errorState("Invalid offering.");
    if (!OFFERING_STATUSES.includes(status as (typeof OFFERING_STATUSES)[number])) return errorState("Choose a valid status.");
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("course_offerings")
      .update({ status })
      .eq("id", offeringId)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      if (error) logServerError("academic.updateOfferingStatus", error);
      return errorState("The offering could not be updated.");
    }
    revalidateAcademic();
    return successState(`Status set to ${status}.`);
  } catch (error) {
    return errorState(accessErrorMessage(error, "The offering could not be updated."));
  }
}

const ENROL_MESSAGES = ["Enrolment not found.", "Invalid enrolment status."];

export async function enrollLevelCoreAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireStaff();
    const semesterId = String(formData.get("semesterId") ?? "");
    const levelCode = String(formData.get("levelCode") ?? "");
    if (!UUID.test(semesterId)) return errorState("Choose a semester.");
    if (!LEVEL_CODES.includes(levelCode as (typeof LEVEL_CODES)[number])) return errorState("Choose a level.");
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("enroll_level_core", { p_semester_id: semesterId, p_level_code: levelCode });
    if (error) {
      logServerError("academic.enrollLevelCore", error);
      return errorState("The level could not be enrolled.");
    }
    revalidateAcademic();
    return successState(levelEnrolMessage(levelCode, Number(data ?? 0)));
  } catch (error) {
    return errorState(accessErrorMessage(error, "The level could not be enrolled."));
  }
}

export async function enrollStudentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireStaff();
    const studentId = String(formData.get("studentId") ?? "");
    const offeringId = String(formData.get("offeringId") ?? "");
    const type = String(formData.get("type") ?? "carryover");
    if (!UUID.test(studentId) || !UUID.test(offeringId)) return errorState("Choose a student and an offering.");
    if (!isEnrolmentType(type)) return errorState("Choose a valid enrolment type.");
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("enroll_student", { p_student_id: studentId, p_offering_id: offeringId, p_type: type });
    if (error) {
      logServerError("academic.enrollStudent", error);
      return errorState("The student could not be enrolled.");
    }
    revalidateAcademic();
    return successState(`Student enrolled (${type}).`);
  } catch (error) {
    return errorState(accessErrorMessage(error, "The student could not be enrolled."));
  }
}

export async function dropEnrollmentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireStaff();
    const enrollmentId = String(formData.get("enrollmentId") ?? "");
    if (!UUID.test(enrollmentId)) return errorState("Invalid enrolment.");
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("set_enrollment_status", { p_enrollment_id: enrollmentId, p_status: "dropped" });
    if (error) {
      logServerError("academic.dropEnrollment", error);
      return errorState(error.message && ENROL_MESSAGES.includes(error.message) ? error.message : "The enrolment could not be dropped.");
    }
    revalidateAcademic();
    return successState("Enrolment dropped.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The enrolment could not be dropped."));
  }
}
