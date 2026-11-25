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
import { parseAudienceField } from "@/features/audiences/schema";
import {
  EVIDENCE_BUCKET,
  EVIDENCE_MAX_BYTES,
  checkEvidenceUpload,
  evidencePathOwner,
  isEvidencePath,
  planEvidencePath,
  sniffEvidence,
} from "./evidence-file";
import type { ActionResult } from "@/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function serviceClient() {
  const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");
  return createAdminSupabaseClient();
}

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
    const audienceField = parseAudienceField(String(formData.get("audiences") ?? ""));
    if (!audienceField.ok) return errorState(audienceField.error);
    if (audienceField.audiences.length === 0) return errorState("Choose who should see this quest.");
    // Legacy level tag is superseded by audiences (E5).
    const { level_code: _legacyLevel, ...fields } = parsed.data;
    void _legacyLevel;

    const supabase = await createServerSupabaseClient();
    const { data: created, error } = await supabase
      .from("quests")
      .insert({ ...fields, is_active: false, created_by: admin.userId })
      .select("id")
      .single();

    if (error) {
      console.error("Quest creation failed.", { code: error.code });
      return errorState("The quest could not be created. Please try again.");
    }

    // Activated only once its audiences are stored (deny by default).
    const saved = await (await import("@/features/audiences/server")).saveAudiences("quest_audiences", created.id, audienceField.audiences);
    if (!saved.ok) {
      await supabase.from("quests").delete().eq("id", created.id);
      return errorState(saved.error);
    }
    if (fields.is_active) {
      await supabase.from("quests").update({ is_active: true }).eq("id", created.id);
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
    const audienceField = parseAudienceField(String(formData.get("audiences") ?? ""));
    if (!audienceField.ok) return errorState(audienceField.error);
    const { level_code: _legacyLevel, ...fields } = parsed.data;
    void _legacyLevel;

    const supabase = await createServerSupabaseClient();
    const saved = await (await import("@/features/audiences/server")).saveAudiences("quest_audiences", questId, audienceField.audiences);
    if (!saved.ok) return errorState(saved.error);

    const { data, error } = await supabase
      .from("quests")
      .update(fields)
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

/**
 * Step 1 of a file upload: the server picks the path inside the student's own folder and
 * hands the browser a one-time signed upload URL for the private bucket.
 */
export async function startEvidenceUploadAction(input: {
  questId: string;
  type: string;
  size: number;
}): Promise<ActionResult<{ path: string; token: string }>> {
  const access = await guardStudentAction("full");
  if (!access.ok) return { ok: false, error: access.error };
  if (!UUID.test(input.questId)) return { ok: false, error: "Quest not found." };
  const check = checkEvidenceUpload({ type: input.type, size: input.size });
  if (!check.ok) return { ok: false, error: check.error };

  try {
    const path = planEvidencePath(access.ctx.userId, check.ext);
    const service = await serviceClient();
    const { data, error } = await service.storage.from(EVIDENCE_BUCKET).createSignedUploadUrl(path);
    if (error || !data) {
      console.error("Evidence upload could not be signed.", { name: error?.name });
      return { ok: false, error: "The upload could not be started. Please try again." };
    }
    return { ok: true, data: { path, token: data.token } };
  } catch (error) {
    return { ok: false, error: accessErrorMessage(error, "The upload could not be started.") };
  }
}

/** Checks the stored bytes are really a photo or PDF under the size limit; removes it if not. */
async function verifyStoredEvidence(path: string): Promise<string | null> {
  const service = await serviceClient();
  const { data, error } = await service.storage.from(EVIDENCE_BUCKET).download(path);
  if (error || !data) return "The uploaded file could not be found. Please upload it again.";
  const buffer = new Uint8Array(await data.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > EVIDENCE_MAX_BYTES || !sniffEvidence(buffer.subarray(0, 32))) {
    await service.storage.from(EVIDENCE_BUCKET).remove([path]);
    return "That file is not a valid photo or PDF. Please upload a different file.";
  }
  return null;
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
    evidence_path: String(formData.get("evidence_path") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };

  const errors = validateSubmitQuestInput(input);
  if (errors.length > 0) return errorState(errors.join(" "));

  let evidenceUrl: string | null = null;
  if (input.evidence_url) {
    evidenceUrl = toSafeExternalHref(input.evidence_url);
    if (!evidenceUrl) return errorState("Evidence must be an https:// link.");
  }

  const evidencePath = input.evidence_path ?? null;
  if (evidencePath) {
    if (!isEvidencePath(evidencePath) || evidencePathOwner(evidencePath) !== access.ctx.userId) {
      return errorState("The uploaded file could not be found. Please upload it again.");
    }
    const fileError = await verifyStoredEvidence(evidencePath);
    if (fileError) return errorState(fileError);
  }

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
      evidence_path: evidencePath,
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

/**
 * Deletes a quest the caller manages. Its submissions go with it (database cascade) and
 * their uploaded files are removed; XP students already earned stays on the leaderboard.
 */
export async function deleteQuestAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await requireStaff();
    const questId = String(formData.get("questId") ?? "").trim();
    if (!UUID.test(questId)) return errorState("A valid quest is required.");

    const supabase = await createServerSupabaseClient();
    const { data: files } = await supabase
      .from("quest_submissions")
      .select("evidence_path")
      .eq("quest_id", questId)
      .not("evidence_path", "is", null);

    const { data, error } = await supabase.from("quests").delete().eq("id", questId).select("id, title");
    if (error) {
      console.error("Quest delete failed.", { code: error.code });
      return errorState("The quest could not be deleted. Please try again.");
    }
    if (!data || data.length === 0) return errorState("Quest not found, or you cannot delete it.");

    const paths = (files ?? []).map((f) => f.evidence_path).filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      try {
        const service = await serviceClient();
        await service.storage.from(EVIDENCE_BUCKET).remove(paths);
      } catch (cleanupError) {
        console.error("Evidence cleanup failed after quest delete.", {
          name: cleanupError instanceof Error ? cleanupError.name : "unknown",
        });
      }
    }

    quietRevalidateQuests();
    revalidatePath("/leaderboard");
    return successState(`Quest "${data[0].title}" deleted.`);
  } catch (error) {
    return errorState(accessErrorMessage(error, "The quest could not be deleted."));
  }
}
