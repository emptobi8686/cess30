"use client";

import { useActionState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Stamp } from "@/components/shared/stamp";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reviewQuestSubmissionAction } from "@/features/quests/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";
import { FormStatus } from "./form-status";

export function SubmissionReview({ submissionId }: { submissionId: string }) {
  const [approveState, approve, approving] = useActionState(reviewQuestSubmissionAction, IDLE_ACTION_STATE);
  const [rejectState, reject, rejecting] = useActionState(reviewQuestSubmissionAction, IDLE_ACTION_STATE);

  if (approveState.status === "success") return <Stamp label="Approved" detail={approveState.message} />;
  if (rejectState.status === "success") return <Stamp label="Returned" detail={rejectState.message} tone="muted" />;

  return (
    <div className="flex flex-col gap-3">
      <form action={approve} className="space-y-2">
        <input type="hidden" name="submissionId" value={submissionId} />
        <input type="hidden" name="new_status" value="approved" />
        <div className="flex items-center gap-2">
          <input id={`approve-${submissionId}`} type="checkbox" name="confirmed" required />
          <Label htmlFor={`approve-${submissionId}`} className="text-xs">Confirm approval</Label>
        </div>
        <Button type="submit" size="sm" className="gap-2" disabled={approving}>
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {approving ? "Approving…" : "Approve"}
        </Button>
        <FormStatus state={approveState} />
      </form>
      <form action={reject} className="space-y-2">
        <input type="hidden" name="submissionId" value={submissionId} />
        <input type="hidden" name="new_status" value="rejected" />
        <Label htmlFor={`reject-reason-${submissionId}`} className="sr-only">Reason for rejection</Label>
        <Textarea id={`reject-reason-${submissionId}`} name="rejection_reason" rows={2} minLength={12} maxLength={500} placeholder="Reason (12+ characters)" required />
        <div className="flex items-center gap-2">
          <input id={`reject-${submissionId}`} type="checkbox" name="confirmed" required />
          <Label htmlFor={`reject-${submissionId}`} className="text-xs">Confirm rejection</Label>
        </div>
        <Button type="submit" variant="destructive" size="sm" className="gap-2" disabled={rejecting}>
          <XCircle className="h-4 w-4" aria-hidden />
          {rejecting ? "Rejecting…" : "Reject"}
        </Button>
        <FormStatus state={rejectState} />
      </form>
    </div>
  );
}
