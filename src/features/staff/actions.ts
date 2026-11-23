"use server";

import { revalidatePath } from "next/cache";
import { LEVEL_CODES } from "@/features/academic/validation";
import { staffRpcMessage } from "@/features/staff/messages";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { accessErrorMessage, requireAdmin } from "@/lib/auth/guards";
import { logServerError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;
const CAPABILITIES = ["department_admin", "level_coordinator"] as const;

function revalidateStaff() {
  revalidatePath("/admin/staff");
  revalidatePath("/admin", "layout");
}

export async function grantCapabilityAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const userId = String(formData.get("userId") ?? "");
    const capability = String(formData.get("capability") ?? "");
    const levelCode = String(formData.get("levelCode") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (!UUID.test(userId)) return errorState("Choose a person.");
    if (!(CAPABILITIES as readonly string[]).includes(capability)) return errorState("Choose a role.");
    if (capability === "level_coordinator" && !(LEVEL_CODES as readonly string[]).includes(levelCode)) {
      return errorState("Choose the level they represent.");
    }
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("grant_capability", {
      p_user: userId,
      p_cap: capability,
      p_level: capability === "level_coordinator" ? levelCode : null,
      p_course: null,
      p_offering: null,
      p_expires: null,
      p_reason: reason,
    });
    if (error) {
      logServerError("staff.grant", error);
      return errorState(staffRpcMessage(error, "The role could not be granted."));
    }
    revalidateStaff();
    return successState(
      capability === "department_admin"
        ? "Department administrator grant created. Another administrator must approve it."
        : `Course representative for level ${levelCode} appointed.`
    );
  } catch (error) {
    return errorState(accessErrorMessage(error, "The role could not be granted."));
  }
}

export async function approveCapabilityAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const id = String(formData.get("assignmentId") ?? "");
    if (!UUID.test(id)) return errorState("Invalid assignment.");
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("approve_capability", { p_id: id });
    if (error) {
      logServerError("staff.approve", error);
      return errorState(staffRpcMessage(error, "The grant could not be approved."));
    }
    revalidateStaff();
    return successState("Approved.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The grant could not be approved."));
  }
}

export async function revokeCapabilityAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const id = String(formData.get("assignmentId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (!UUID.test(id)) return errorState("Invalid assignment.");
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("revoke_capability", { p_id: id, p_reason: reason || "Removed by administrator" });
    if (error) {
      logServerError("staff.revoke", error);
      return errorState(staffRpcMessage(error, "The role could not be removed."));
    }
    revalidateStaff();
    return successState("Removed.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The role could not be removed."));
  }
}
