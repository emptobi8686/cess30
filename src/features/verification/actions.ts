"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUserSession } from "@/lib/supabase/auth";
import { getCurrentUserRole } from "@/lib/supabase/role";
import { validateVerificationRejectionReason } from "@/lib/verification";
import type { ActionResult } from "@/types";

async function requireAdminSession() {
  const user = await requireUserSession();
  const role = await getCurrentUserRole();

  if (role !== "admin") {
    throw new Error("Administrator access required.");
  }

  return user;
}

async function createVerificationNotification(
  profileId: string,
  status: "verified" | "rejected",
  reason?: string | null
) {
  const supabase = await createServerSupabaseClient();
  const dedupeKey = `verification:${profileId}:${status}`;

  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (existing) {
    return;
  }

  const title =
    status === "verified" ? "Matriculation verified" : "Matriculation update required";
  const message =
    status === "verified"
      ? "Your matriculation number has been verified and your student profile is active."
      : `Your matriculation number was not approved. ${reason ?? "Please contact the course representative."}`;

  const { error } = await supabase.from("notifications").insert({
    user_id: profileId,
    title,
    message,
    notification_type: "system",
    source_type: "system",
    source_id: null,
    action_url: "/settings/profile",
    dedupe_key: dedupeKey,
    is_read: false,
    push_requested: false,
    push_status: "not_requested",
  });

  if (error) {
    console.error("Could not create verification notification.", error);
  }
}

async function applyVerificationDecision(
  profileId: string,
  nextStatus: "verified" | "rejected",
  reason?: string | null
): Promise<ActionResult<{ status: "verified" | "rejected" }>> {
  try {
    const adminUser = await requireAdminSession();

    const normalizedReason =
      nextStatus === "rejected"
        ? validateVerificationRejectionReason(reason)
        : null;

    const supabase = await createServerSupabaseClient();

    // Call the atomic database RPC. The RPC independently verifies admin
    // authorization, rejects self-review, locks the profile row, validates
    // status/decision, and updates profile + history in one transaction.
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "verify_profile_decision",
      {
        p_profile_id: profileId,
        p_new_status: nextStatus,
        p_rejection_reason: normalizedReason ?? null,
      }
    );

    if (rpcError) {
      return { ok: false, error: rpcError.message };
    }

    // Notification is created only after the review commits. If notification
    // creation fails, log it but do not pretend the review itself failed.
    void createVerificationNotification(profileId, nextStatus, normalizedReason);

    revalidatePath("/admin");
    revalidatePath("/admin/verifications");
    revalidatePath("/dashboard");
    revalidatePath("/settings/profile");

    void adminUser;
    void rpcResult;

    return { ok: true, data: { status: nextStatus } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to update verification status.",
    };
  }
}

export async function approveVerificationAction(formData: FormData): Promise<void> {
  const confirmed = String(formData.get("confirmed") ?? "").toLowerCase() === "on";
  const profileId = String(formData.get("profileId") ?? "").trim();

  if (!profileId) {
    console.error("A student profile is required.");
    return;
  }

  if (!confirmed) {
    console.error("Confirmation is required before approval.");
    return;
  }

  const result = await applyVerificationDecision(profileId, "verified");
  if (!result.ok) {
    console.error(result.error);
  }
}

export async function rejectVerificationAction(formData: FormData): Promise<void> {
  const confirmed = String(formData.get("confirmed") ?? "").toLowerCase() === "on";
  const profileId = String(formData.get("profileId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!profileId) {
    console.error("A student profile is required.");
    return;
  }

  if (!confirmed) {
    console.error("Confirmation is required before rejection.");
    return;
  }

  if (!reason) {
    console.error("A rejection reason is required.");
    return;
  }

  const result = await applyVerificationDecision(profileId, "rejected", reason);
  if (!result.ok) {
    console.error(result.error);
  }
}
