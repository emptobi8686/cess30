"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { accessErrorMessage, guardStudentAction, requireStaff } from "@/lib/auth/guards";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { toSafeExternalHref } from "@/lib/safe-links";
import {
  questUpsertSchema,
  validateSubmitQuestInput,
  type SubmitQuestInput,
} from "./validation";

export type { SubmitQuestInput };

function quietRevalidateQuests() {
  revalidatePath("/quests");
  revalidatePath("/admin/quests");
  revalidatePath("/admin");
}

function firstIssue(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? "Check the quest details and try again.";
}

function questFormValues(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    xp_reward: String(formData.get("xp_reward") ?? ""),
    due_date: String(formData.get("due_date") ?? ""),
    is_active: formData.get("is_active") === null ? undefined : String(formData.get("is_active")),
    level_code: String(formData.get("level_code") ?? ""),
  };
}

export async function createQuestAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const admin = await requireStaff();
    const parsed = questUpsertSchema.safeParse(questFormValues(formData));
    if (!parsed.success) return errorState(firstIssue(parsed.error));

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("quests").insert({
      ...parsed.data,
      created_by: admin.userId,
    });

    if (error) {
      console.error("Quest creation failed.", { code: error.code });
      return errorState("The quest could not be created. Please try again.");
    }

    quietRevalidateQuests();
    return successState(`Quest "${parsed.data.title}" created.`);
  } catch (error) {
    return errorState(accessErrorMessage(error, "The quest could not be created."));
  }
}

export async function updateQuestAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireStaff();

    const questId = String(formData.get("questId") ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(questId)) return errorState("A valid quest is required.");

    const parsed = questUpsertSchema.safeParse(questFormValues(formData));
    if (!parsed.success) return errorState(firstIssue(parsed.error));

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("quests")
      .update(parsed.data)
      .eq("id", questId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Quest update failed.", { code: error.code });
      return errorState("The quest could not be saved. Please try again.");
    }
    if (!data) return errorState("Quest not found.");

    quietRevalidateQuests();
    return successState("Quest saved.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The quest could not be saved."));
  }
}

export async function submitQuestAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const access = await guardStudentAction("full");
  if (!access.ok) return errorState(access.error);

  const input: SubmitQuestInput = {
    quest_id: String(formData.get("quest_id") ?? "").trim(),
    evidence_url: String(formData.get("evidence_url") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim() || null,
  };

  const errors = validateSubmitQuestInput(input);
  if (errors.length > 0) return errorState(errors.join(" "));

  const evidenceUrl = toSafeExternalHref(input.evidence_url);
  if (!evidenceUrl) return errorState("Evidence must be an https:// link.");

  try {
    const supabase = await createServerSupabaseClient();

    const { data: quest, error: questError } = await supabase
      .from("quests")
      .select("id, is_active, due_date")
      .eq("id", input.quest_id)
      .maybeSingle();

    if (questError) return errorState("The quest could not be loaded. Please try again.");
    if (!quest) return errorState("Quest not found.");
    if (!quest.is_active) return errorState("This quest is no longer active.");
    if (quest.due_date && new Date(quest.due_date) < new Date()) {
      return errorState("This quest's submission deadline has passed.");
    }

    const { data: existing } = await supabase
      .from("quest_submissions")
      .select("id, status")
      .eq("quest_id", input.quest_id)
      .eq("student_id", access.ctx.userId)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existing) {
      return errorState(`You have already submitted for this quest (status: ${existing.status}).`);
    }

    const { error } = await supabase.from("quest_submissions").insert({
      quest_id: input.quest_id,
      student_id: access.ctx.userId,
      evidence_url: evidenceUrl,
      notes: input.notes,
    });

    if (error) {
      console.error("Quest submission failed.", { code: error.code });
      return errorState("Your evidence could not be submitted. Please try again.");
    }

    revalidatePath("/quests");
    revalidatePath("/dashboard");
    return successState("Evidence submitted. An administrator will review it.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "Your evidence could not be submitted."));
  }
}

export async function cancelQuestSubmissionAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const access = await guardStudentAction("full");
  if (!access.ok) return errorState(access.error);

  const submissionId = String(formData.get("submissionId") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(submissionId)) return errorState("A valid submission is required.");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("cancel_quest_submission", { p_submission_id: submissionId });
  if (error) {
    if ((error.message ?? "").includes("Only pending")) {
      return errorState("Only pending submissions can be cancelled.");
    }
    return errorState("The submission could not be cancelled.");
  }

  revalidatePath("/quests");
  return successState("Submission cancelled.");
}

export async function reviewQuestSubmissionAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireStaff();

    const submissionId = String(formData.get("submissionId") ?? "").trim();
    const newStatus = String(formData.get("new_status") ?? "").trim();
    const rejectionReason = String(formData.get("rejection_reason") ?? "").trim() || null;

    if (!/^[0-9a-f-]{36}$/i.test(submissionId)) return errorState("A valid submission is required.");
    if (newStatus !== "approved" && newStatus !== "rejected") return errorState("Invalid review decision.");
    if (newStatus === "rejected" && (!rejectionReason || rejectionReason.length < 12)) {
      return errorState("Rejection reason must be at least 12 characters.");
    }

    // The RPC re-checks admin rights, blocks self-review, locks the row and awards
    // XP in the same transaction.
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("review_quest_submission", {
      p_submission_id: submissionId,
      p_new_status: newStatus,
      p_rejection_reason: rejectionReason,
    });

    if (error) {
      const message = error.message ?? "";
      if (message.includes("already been reviewed")) return errorState("This submission has already been reviewed.");
      if (message.includes("their own quest submissions")) return errorState("You cannot review your own submission.");
      console.error("Quest review failed.", { code: error.code });
      return errorState("The review could not be saved. Please try again.");
    }

    quietRevalidateQuests();
    revalidatePath("/leaderboard");
    return successState(newStatus === "approved" ? "Submission approved and XP awarded." : "Submission rejected.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The review could not be saved."))
  }
}
