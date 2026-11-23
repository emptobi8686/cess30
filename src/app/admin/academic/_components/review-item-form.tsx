"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/shared/form-status";
import { useOfferingOptions } from "@/components/shared/audience-picker";
import { Button } from "@/components/ui/button";
import { LEVEL_CODES } from "@/features/academic/validation";
import { rerunBackfillAction, resolveReviewItemAction } from "@/features/academic/review-actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

const SELECT = "h-8 rounded-lg border border-input bg-background px-2 text-xs";

export function ReviewItemForm({ item }: { item: { id: string; item_type: string; label: string; suggested_level?: string } }) {
  const [state, action, pending] = useActionState(resolveReviewItemAction, IDLE_ACTION_STATE);
  const offerings = useOfferingOptions();
  const name = item.label || "item";
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="itemId" value={item.id} />
      {item.item_type === "announcement_level" ? (
        <select name="level_code" defaultValue={item.suggested_level ?? "200"} aria-label={`Level for ${name}`} className={SELECT}>
          {LEVEL_CODES.map((l) => <option key={l} value={l}>Level {l}</option>)}
        </select>
      ) : null}
      {item.item_type === "quest_audience" ? (
        <select name="audience" defaultValue="department" aria-label={`Audience for ${name}`} className={SELECT}>
          <option value="department">Whole department</option>
          {LEVEL_CODES.map((l) => <option key={l} value={l}>Level {l}</option>)}
        </select>
      ) : null}
      {item.item_type === "lecture_out_of_range" ? (
        <select name="offering_id" defaultValue="" aria-label={`Class for ${name}`} className={SELECT}>
          <option value="">Choose a class…</option>
          {offerings.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      ) : null}
      {item.item_type !== "profile_no_matric" ? (
        <Button type="submit" size="sm" disabled={pending} aria-label={`Resolve ${name}`}>
          {item.item_type === "placement" ? "Confirm" : "Apply"}
        </Button>
      ) : null}
      <Button type="submit" name="decision" value="dismiss" size="sm" variant="ghost" disabled={pending} aria-label={`Dismiss ${name}`}>Dismiss</Button>
      <FormStatus state={state} />
    </form>
  );
}

export function RerunBackfillForm() {
  const [state, action, pending] = useActionState(rerunBackfillAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="outline" disabled={pending}>Re-run legacy backfill</Button>
      <p className="text-xs text-muted-foreground">Safe to repeat. Run it after opening a new session so carried-over levels get placements.</p>
      <FormStatus state={state} />
    </form>
  );
}
