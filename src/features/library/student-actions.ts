"use server";

import { revalidatePath } from "next/cache";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { guardStudentAction } from "@/lib/auth/guards";
import { logServerError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const REPORT_REASONS = ["broken", "wrong_course", "copyright", "inappropriate", "outdated", "other"] as const;

export async function toggleBookmarkAction(resourceId: string): Promise<ActionResult<{ bookmarked: boolean }>> {
  const access = await guardStudentAction("full");
  if (!access.ok) return access;
  if (!UUID.test(resourceId)) return { ok: false, error: "Resource not found." };
  const supabase = await createServerSupabaseClient();
  const { data: existing } = await supabase.from("library_bookmarks").select("resource_id")
    .eq("user_id", access.ctx.userId).eq("resource_id", resourceId).maybeSingle();
  if (existing) {
    await supabase.from("library_bookmarks").delete().eq("user_id", access.ctx.userId).eq("resource_id", resourceId);
  } else {
    const { error } = await supabase.from("library_bookmarks").insert({ user_id: access.ctx.userId, resource_id: resourceId });
    if (error) {
      logServerError("library.bookmark", error);
      return { ok: false, error: "This resource could not be bookmarked." };
    }
  }
  revalidatePath("/library");
  revalidatePath(`/library/${resourceId}`);
  return { ok: true, data: { bookmarked: !existing } };
}

export async function reportLibraryResourceAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await guardStudentAction("full");
  if (!access.ok) return errorState(access.error);
  const resourceId = String(formData.get("resourceId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const details = String(formData.get("details") ?? "").trim();
  if (!UUID.test(resourceId)) return errorState("Resource not found.");
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) return errorState("Choose a reason.");
  if (details.length > 1000) return errorState("Keep the details under 1000 characters.");
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("library_reports").insert({
    resource_id: resourceId,
    reporter_id: access.ctx.userId,
    reason,
    details: details || null,
  });
  if (error) {
    if (error.code === "23505") return errorState("You already reported this resource. A library manager will review it.");
    logServerError("library.report", error);
    return errorState("The report could not be sent.");
  }
  return successState("Thanks, a library manager will review this.");
}
