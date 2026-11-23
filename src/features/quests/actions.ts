"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUserSession } from "@/lib/supabase/auth";
import { requireAdmin } from "@/lib/auth/guards";
import type { ActionResult, QuestStatus } from "@/types";
import {
  validateCreateQuestInput,
  validateSubmitQuestInput,
  type CreateQuestInput,
  type SubmitQuestInput,
} from "./validation";

export type { CreateQuestInput, SubmitQuestInput };

export async function createQuestAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireAdmin();

    const supabase = await createServerSupabaseClient();

    const input: CreateQuestInput = {
      title: String(formData.get("title") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      xp_reward: Number(formData.get("xp_reward") ?? 0),
      due_date: String(formData.get("due_date") ?? "").trim() || null,
      is_active: String(formData.get("is_active") ?? "").toLowerCase() === "on",
    };

    const errors = validateCreateQuestInput(input);
    if (errors.length > 0) {
      return { ok: false, error: errors.join(" ") };
    }

    const { data, error } = await supabase
      .from("quests")
      .insert({
        title: input.title,
        description: input.description,
        xp_reward: input.xp_reward,
        due_date: input.due_date,
        is_active: input.is_active,
      })
      .select("id")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/quests");
    revalidatePath("/admin/quests");
    revalidatePath("/admin");

    return { ok: true, data: { id: data.id } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to create quest.",
    };
  }
}

export async function updateQuestAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const adminUser = await requireAdmin();

    const questId = String(formData.get("questId") ?? "").trim();
    if (!questId || !/^[0-9a-fA-F-]{36}$/.test(questId)) {
      return { ok: false, error: "A valid quest is required." };
    }

    const supabase = await createServerSupabaseClient();

    const input: Partial<CreateQuestInput> = {
      title: String(formData.get("title") ?? "").trim() || undefined,
      description: String(formData.get("description") ?? "").trim() || undefined,
      xp_reward:
        formData.get("xp_reward") !== null && formData.get("xp_reward") !== undefined
          ? Number(formData.get("xp_reward"))
          : undefined,
      due_date:
        formData.get("due_date") !== null && formData.get("due_date") !== undefined
          ? String(formData.get("due_date") ?? "").trim() || null
          : undefined,
      is_active:
        formData.get("is_active") !== null && formData.get("is_active") !== undefined
          ? String(formData.get("is_active")).toLowerCase() === "on"
          : undefined,
    };

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) {
      updateData.title = input.title;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.xp_reward !== undefined) {
      updateData.xp_reward = input.xp_reward;
    }
    if (input.due_date !== undefined) {
      updateData.due_date = input.due_date;
    }
    if (input.is_active !== undefined) {
      updateData.is_active = input.is_active;
    }

    const { error } = await supabase
      .from("quests")
      .update(updateData)
      .eq("id", questId);

    if (error) {
      return { ok: false, error: error.message };
    }

    void adminUser;
    revalidatePath("/quests");
    revalidatePath("/admin/quests");
    revalidatePath("/admin");

    return { ok: true, data: { id: questId } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to update quest.",
    };
  }
}

export async function submitQuestAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUserSession();
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

export type ReviewQuestSubmissionInput = {
  submission_id: string;
  new_status: QuestStatus;
  rejection_reason: string | null;
};

export async function reviewQuestSubmissionAction(
  formData: FormData
): Promise<ActionResult<{ status: QuestStatus }>> {
  try {
    await requireAdmin();

    const supabase = await createServerSupabaseClient();

    const submissionId = String(formData.get("submissionId") ?? "").trim();
    const newStatus = String(formData.get("new_status") ?? "").trim() as QuestStatus;
    const rejectionReason = String(formData.get("rejection_reason") ?? "").trim() || null;

    if (!submissionId || !/^[0-9a-fA-F-]{36}$/.test(submissionId)) {
      return { ok: false, error: "A valid submission is required." };
    }

    if (newStatus !== "approved" && newStatus !== "rejected") {
      return { ok: false, error: "Invalid review decision." };
    }

    if (newStatus === "rejected" && (!rejectionReason || rejectionReason.length < 12)) {
      return { ok: false, error: "Rejection reason must be at least 12 characters." };
    }

    // Call the atomic database RPC. The RPC independently verifies admin
    // authorization, locks the submission row, validates the decision, and
    // updates the submission + awards XP in one transaction.
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "review_quest_submission",
      {
        p_submission_id: submissionId,
        p_new_status: newStatus,
        p_rejection_reason: rejectionReason ?? null,
      }
    );

    if (rpcError) {
      return { ok: false, error: rpcError.message };
    }

    revalidatePath("/quests");
    revalidatePath("/admin/quests");
    revalidatePath("/admin");
    revalidatePath("/leaderboard");

    void rpcResult;

    return { ok: true, data: { status: newStatus } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to review quest submission.",
    };
  }
}