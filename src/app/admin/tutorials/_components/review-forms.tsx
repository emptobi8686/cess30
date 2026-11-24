"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/shared/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveTutorialAction,
  publishTutorialAction,
  removeTutorialAction,
  resolveTutorialReportAction,
  reviewTutorialAction,
  submitForReviewAction,
} from "@/features/tutorials/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

function Simple({ id, label, action: fn, variant }: { id: string; label: string; action: typeof publishTutorialAction; variant?: "outline" }) {
  const [state, action, pending] = useActionState(fn, IDLE_ACTION_STATE);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="tutorialId" value={id} />
      <Button type="submit" size="sm" variant={variant ?? "default"} disabled={pending}>{label}</Button>
      <FormStatus state={state} />
    </form>
  );
}

export function TutorialStatusControls({ id, status, reviewStatus }: { id: string; status: string; reviewStatus: string }) {
  const [removeState, remove, removing] = useActionState(removeTutorialAction, IDLE_ACTION_STATE);
  if (status === "removed") return <p className="text-sm text-muted-foreground">Removed.</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {status === "draft" ? <Simple id={id} label="Send for review" action={submitForReviewAction} variant="outline" /> : null}
        {status !== "published" && reviewStatus === "approved" ? <Simple id={id} label="Publish" action={publishTutorialAction} /> : null}
        {status === "published" ? <Simple id={id} label="Archive" action={archiveTutorialAction} variant="outline" /> : null}
      </div>
      <form action={remove} className="space-y-2 rounded-lg border border-destructive/30 p-3">
        <input type="hidden" name="tutorialId" value={id} />
        <Label htmlFor={`tu-remove-${id}`}>Take down</Label>
        <Input id={`tu-remove-${id}`} name="reason" minLength={8} maxLength={500} required placeholder="Reason" />
        <Button type="submit" size="sm" variant="destructive" disabled={removing}>Remove</Button>
        <FormStatus state={removeState} />
      </form>
    </div>
  );
}

export function ReviewPanel({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reviewTutorialAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="tutorialId" value={id} />
      <Label htmlFor={`review-${id}`}>Review notes (required)</Label>
      <Textarea id={`review-${id}`} name="notes" minLength={8} maxLength={1000} required placeholder="What you checked, e.g. against the CEE201 lecture notes" />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="decision" value="approved" size="sm" disabled={pending}>Approve</Button>
        <Button type="submit" name="decision" value="changes_requested" size="sm" variant="outline" disabled={pending}>Request changes</Button>
        <Button type="submit" name="decision" value="rejected" size="sm" variant="ghost" disabled={pending}>Reject</Button>
      </div>
      <FormStatus state={state} />
    </form>
  );
}

export function ResolveTutorialReport({ reportId }: { reportId: string }) {
  const [state, action, pending] = useActionState(resolveTutorialReportAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      <Input name="note" placeholder="Note (8+ characters to dismiss)" maxLength={500} className="max-w-xs" aria-label="Resolution note" />
      <Button type="submit" name="decision" value="actioned" size="sm" disabled={pending}>Mark fixed</Button>
      <Button type="submit" name="decision" value="dismissed" size="sm" variant="ghost" disabled={pending}>Dismiss</Button>
      <FormStatus state={state} />
    </form>
  );
}
