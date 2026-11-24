"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/guards";
import { validateVerificationRejectionReason } from "@/lib/verification";
import {
  errorState,
  rpcErrorToMessage,
  successState,
  type ActionState,
} from "@/features/verification/action-state";
import { ACCESS_DENIED_MESSAGE, AccessDeniedError } from "@/lib/auth/guards";

/**
 * Notifies the student about a committed decision. Uses the service-role client:
 * authenticated users have no INSERT grant on notifications (BP-023).
 * Returns false when the notice could not be stored.
 */
async function createVerificationNotification(
  profileId: string,
  status: "verified" | "rejected",
  reason: string | null
): Promise<boolean> {
  try {
    const admin = createAdminSupabaseClient();
    const { data: latest } = await admin
      .from("profile_verification_history")
      .select("id")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const title = status === "verified" ? "Matriculation verified" : "Matriculation update required";
    const message =
      status === "verified"
        ? "Your matriculation number has been verified and your student profile is active."
        : `Your matriculation number was not approved. ${reason ?? "Please contact your course representative."}`.slice(0, 500);

    const { error } = await admin.from("notifications").upsert(
      {
        user_id: profileId,
        title,
        message,
        notification_type: "system",
        source_type: "system",
        source_id: null,
        action_url: "/settings/profile",
        dedupe_key: `verification:${profileId}:${status}:${latest?.id ?? new Date().toISOString()}`,
        is_read: false,
        push_requested: false,
        push_status: "not_requested",
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true }
    );

    if (error) {
      console.error("Could not create verification notification.", { code: error.code });
      return false;
    }
    return true;
  } catch (error) {
    console.error("Could not create verification notification.", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}

function revalidateVerificationViews() {
  revalidatePath("/admin");
  revalidatePath("/admin/verifications");
  revalidatePath("/dashboard");
  revalidatePath("/settings/profile");
}

function readProfileId(formData: FormData): string | null {
  const value = String(formData.get("profileId") ?? "").trim();
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function isConfirmed(formData: FormData): boolean {
  return String(formData.get("confirmed") ?? "").toLowerCase() === "on";
}

function failure(error: unknown): ActionState {
  if (error instanceof AccessDeniedError) return errorState(ACCESS_DENIED_MESSAGE);
  if (error instanceof Error && error.message.includes("Rejection reason")) {
    return errorState(error.message);
  }
  return errorState(rpcErrorToMessage({}));
}

async function applyVerificationDecision(
  profileId: string,
  nextStatus: "verified" | "rejected",
  reason: string | null
): Promise<ActionState> {
  try {
    await requireAdmin();

    const normalizedReason =
      nextStatus === "rejected" ? validateVerificationRejectionReason(reason) : null;

    const supabase = await createServerSupabaseClient();

    // The RPC independently verifies admin authorization, rejects self-review,
    // locks the profile row, validates the decision, and writes profile + history
    // in one transaction.
    const { error: rpcError } = await supabase.rpc("verify_profile_decision", {
      p_profile_id: profileId,
      p_new_status: nextStatus,
      p_rejection_reason: normalizedReason,
    });

    if (rpcError) return errorState(rpcErrorToMessage(rpcError));

    const notified = await createVerificationNotification(profileId, nextStatus, normalizedReason);
    revalidateVerificationViews();

    const done = nextStatus === "verified" ? "Student verified." : "Verification rejected.";
    return successState(notified ? done : `${done} The student could not be notified.`);
  } catch (error) {
    return failure(error);
  }
}

export async function approveVerificationAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profileId = readProfileId(formData);
  if (!profileId) return errorState("A student profile is required.");
  if (!isConfirmed(formData)) return errorState("Confirm the approval before submitting.");
  if (String(formData.get("hasMatric") ?? "") !== "true") {
    return errorState("This student has not submitted a matriculation number yet.");
  }
  return applyVerificationDecision(profileId, "verified", null);
}

export async function rejectVerificationAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profileId = readProfileId(formData);
  if (!profileId) return errorState("A student profile is required.");
  if (!isConfirmed(formData)) return errorState("Confirm the rejection before submitting.");
  return applyVerificationDecision(profileId, "rejected", String(formData.get("reason") ?? ""));
}

const STATUS_CHANGE_MESSAGES: Record<string, string> = {
  suspended: "Student suspended.",
  verified: "Student reinstated.",
  pending: "Verification reopened for review.",
};

/** Suspend (verified→suspended), reinstate (suspended→verified) or reopen (rejected→pending). */
export async function changeVerificationStatusAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profileId = readProfileId(formData);
  const newStatus = String(formData.get("newStatus") ?? "");
  if (!profileId) return errorState("A student profile is required.");
  if (!(newStatus in STATUS_CHANGE_MESSAGES)) return errorState("Choose a valid status change.");
  if (!isConfirmed(formData)) return errorState("Confirm the change before submitting.");

  try {
    await requireAdmin();
    const supabase = await createServerSupabaseClient();
    const reason = String(formData.get("reason") ?? "").trim() || null;
    const { error } = await supabase.rpc("admin_change_status", {
      p_profile_id: profileId,
      p_new_status: newStatus,
      p_reason: reason,
    });
    if (error) return errorState(rpcErrorToMessage(error));
    revalidateVerificationViews();
    return successState(STATUS_CHANGE_MESSAGES[newStatus]);
  } catch (error) {
    return failure(error);
  }
}
