"use server";

import { revalidatePath } from "next/cache";
import { planResolution } from "@/features/academic/review-dispatch";
import { errorState, successState, type ActionState } from "@/lib/action-state";
import { accessErrorMessage, requireAdmin } from "@/lib/auth/guards";
import { logServerError } from "@/lib/errors";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

export async function resolveReviewItemAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const itemId = String(formData.get("itemId") ?? "");
    if (!UUID.test(itemId)) return errorState("Invalid review item.");
    const supabase = await createServerSupabaseClient();
    const { data: item, error: itemError } = await supabase
      .from("migration_review_items")
      .select("id, item_type, entity_id, status")
      .eq("id", itemId)
      .maybeSingle();
    if (itemError || !item) return errorState("Review item not found.");
    if (item.status !== "open") return errorState("This item is already resolved.");

    const values = Object.fromEntries(
      ["decision", "level_code", "audience", "offering_id", "course_id", "semester_id"].map((k) => [k, formData.get(k)?.toString()])
    );
    let plan;
    try {
      plan = planResolution(item, values);
    } catch (error) {
      return errorState(error instanceof Error ? error.message : "Check the resolution.");
    }

    let failure: { message?: string } | null = null;
    if (plan.kind === "insert_audience") {
      const table = plan.payload.announcement_id ? "announcement_audiences" : "quest_audiences";
      const owner = plan.payload.announcement_id ?? plan.payload.quest_id;
      const row: Record<string, string> = { audience_kind: plan.payload.audience_kind };
      if (plan.payload.level_code) row.level_code = plan.payload.level_code;
      ({ error: failure } = await supabase.rpc("replace_audiences", { p_table: table, p_owner: owner, p_rows: [row] }));
    } else if (plan.kind === "set_lecture_offering") {
      ({ error: failure } = await supabase
        .from("lecture_sessions")
        .update({ offering_id: plan.payload.offering_id, updated_by: admin.userId })
        .eq("id", plan.payload.lecture_id));
    } else if (plan.kind === "confirm_placement") {
      ({ error: failure } = await supabase.rpc("confirm_placements", {
        p_placement_ids: [plan.payload.placement_id],
        p_status: "confirmed",
        p_note: "Confirmed from the migration review queue",
      }));
    } else if (plan.kind === "create_offering") {
      ({ error: failure } = await supabase.from("course_offerings").insert(plan.payload));
    }
    if (failure) {
      logServerError("academic.resolveReviewItem", failure);
      return errorState(
        failure.message === "You cannot confirm your own placement." ? failure.message : "The item could not be resolved."
      );
    }

    const { error: updateError } = await supabase
      .from("migration_review_items")
      .update({ status: plan.kind === "dismiss" ? "dismissed" : "resolved", resolved_by: admin.userId, resolved_at: new Date().toISOString() })
      .eq("id", item.id);
    if (updateError) {
      logServerError("academic.resolveReviewItem.mark", updateError);
      return errorState("The change was saved, but the item could not be marked resolved.");
    }
    revalidatePath("/admin/academic", "layout");
    return successState(plan.kind === "dismiss" ? "Dismissed." : "Resolved.");
  } catch (error) {
    return errorState(accessErrorMessage(error, "The item could not be resolved."));
  }
}

export async function rerunBackfillAction(_previous: ActionState, _formData: FormData): Promise<ActionState> {
  void _formData;
  try {
    await requireAdmin();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("run_legacy_backfill");
    if (error) {
      logServerError("academic.rerunBackfill", error);
      return errorState("The backfill could not run.");
    }
    revalidatePath("/admin/academic", "layout");
    const counts = (data ?? {}) as Record<string, number>;
    return successState(
      `Backfill finished: ${counts.placements ?? 0} placements, ${counts.audiences ?? 0} audiences, ${counts.lectures ?? 0} lectures linked, ${counts.review_items ?? 0} new review items.`
    );
  } catch (error) {
    return errorState(accessErrorMessage(error, "The backfill could not run."));
  }
}
