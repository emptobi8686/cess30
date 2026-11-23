"use server";

import { revalidatePath } from "next/cache";
import { semesterSchema, sessionSchema } from "@/features/academic/validation";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { accessErrorMessage, requireAdmin } from "@/lib/auth/guards";
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
