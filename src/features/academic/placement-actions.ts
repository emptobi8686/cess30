"use server";

import { revalidatePath } from "next/cache";
import { LEVEL_CODES } from "@/features/academic/validation";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { accessErrorMessage, guardStudentAction, requireStaff } from "@/lib/auth/guards";
import { logServerError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SAFE_MESSAGES = [
  "No academic session is open yet.",
  "Choose a valid level.",
  "Your level for this session is already confirmed. Contact your course representative to change it.",
  "You cannot confirm your own placement.",
];

function rpcMessage(error: { message?: string }, fallback: string) {
  return error.message && SAFE_MESSAGES.includes(error.message) ? error.message : fallback;
}

/** Student: claim a level for the current session (confirmed later by staff). */
export async function requestPlacementAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const access = await guardStudentAction("read");
  if (!access.ok) return errorState(access.error);

  const level = String(formData.get("levelCode") ?? "");
  if (!LEVEL_CODES.includes(level as (typeof LEVEL_CODES)[number])) return errorState("Choose a valid level.");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("request_placement", { p_level_code: level });
  if (error) {
    logServerError("academic.requestPlacement", error);
    return errorState(rpcMessage(error, "Your level could not be saved."));
  }
  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  return successState(`Level ${level} requested. Awaiting confirmation.`);
}

/** Staff: confirm or reject selected placements (never one's own; enforced in the database). */
export async function confirmPlacementsAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireStaff();
    const ids = Array.from(new Set(formData.getAll("placementId").map(String).filter((v) => UUID.test(v))));
    const status = String(formData.get("decision") ?? "");
    if (ids.length === 0) return errorState("Select at least one student.");
    if (status !== "confirmed" && status !== "rejected") return errorState("Choose confirm or reject.");

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("confirm_placements", {
      p_placement_ids: ids,
      p_status: status,
      p_note: null,
    });
    if (error) {
      logServerError("academic.confirmPlacements", error);
      return errorState(rpcMessage(error, "The placements could not be updated."));
    }
    revalidatePath("/admin/academic/placements");
    const count = typeof data === "number" ? data : ids.length;
    return successState(`${count} placement${count === 1 ? "" : "s"} ${status}.`);
  } catch (error) {
    return errorState(accessErrorMessage(error, "The placements could not be updated."));
  }
}
