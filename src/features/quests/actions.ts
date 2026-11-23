"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { accessErrorMessage, guardStudentAction, requireAdmin } from "@/lib/auth/guards";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import type { ActionResult } from "@/types";
import {
  questUpsertSchema,
  validateSubmitQuestInput,
  type CreateQuestInput,
  type SubmitQuestInput,
} from "./validation";

export type { CreateQuestInput, SubmitQuestInput };

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
  };
}

export async function createQuestAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
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
    await requireAdmin();

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
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const access = await guardStudentAction("full");
  if (!access.ok) return access;
  const user = { id: access.ctx.userId };
    const supabase = await createServerSupabaseClient();

    const input: SubmitQuestInput = {
      quest_id: String(formData.get("quest_id") ?? "").trim(),
      evidence_url: String(formData.get("evidence_url") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim() || null,
    };

    const errors = validateSubmitQuestInput(input);
    if (errors.length > 0) {
      return { ok: false, error: errors.join(" ") };
    }

    // Check quest exists and is active.
    const { data: quest, error: questError } = await supabase
      .from("quests")
      .select("id, is_active, due_date")
      .eq("id", input.quest_id)
      .maybeSingle();

    if (questError) {
      return { ok: false, error: questError.message };
    }
    if (!quest) {
      return { ok: false, error: "Quest not found." };
    }
    if (!quest.is_active) {
      return { ok: false, error: "This quest is no longer active." };
    }
    if (quest.due_date && new Date(quest.due_date) < new Date()) {
      return { ok: false, error: "This quest's submission deadline has passed." };
    }

    // Check for existing submission (one per student per quest).
    const { data: existing } = await supabase
      .from("quest_submissions")
      .select("id, status")
      .eq("quest_id", input.quest_id)
      .eq("student_id", user.id)
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        error: `You have already submitted for this quest (status: ${existing.status}).`,
      };
    }

    const { data, error } = await supabase
      .from("quest_submissions")
      .insert({
        quest_id: input.quest_id,
        student_id: user.id,
        evidence_url: input.evidence_url,
        notes: input.notes,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/quests");
    revalidatePath("/dashboard");

    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to submit quest evidence.",
    };
  }
}

export async function reviewQuestSubmissionAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireAdmin();

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
