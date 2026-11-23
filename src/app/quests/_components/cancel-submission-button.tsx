"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { cancelQuestSubmissionAction } from "@/features/quests/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export function CancelSubmissionButton({ submissionId }: { submissionId: string }) {
  const [state, action, pending] = useActionState(cancelQuestSubmissionAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="submissionId" value={submissionId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Cancelling…" : "Cancel submission"}
      </Button>
      {state.message ? (
        <p role="status" className={state.status === "error" ? "text-xs text-destructive" : "text-xs text-primary"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
