"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitQuestAction } from "@/features/quests/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export function SubmitEvidenceDialog({
  questId,
  questTitle,
  disabled,
}: {
  questId: string;
  questTitle: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(submitQuestAction, IDLE_ACTION_STATE);

  if (state.status === "success") {
    return (
      <p role="status" className="text-xs text-primary">
        {state.message}
      </p>
    );
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" disabled={disabled} className="w-full" />}>
        {disabled ? "Expired" : "Submit evidence"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit evidence for &quot;{questTitle}&quot;</DialogTitle>
          <DialogDescription>Provide an https:// link to your evidence of completion.</DialogDescription>
        </DialogHeader>
        <form action={action} className="mt-4 space-y-4">
          <input type="hidden" name="quest_id" value={questId} />
          <div className="space-y-2">
            <Label htmlFor={`evidence-${questId}`}>Evidence link</Label>
            <Input
              id={`evidence-${questId}`}
              name="evidence_url"
              type="url"
              inputMode="url"
              pattern="https://.*"
              maxLength={500}
              placeholder="https://…"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`notes-${questId}`}>Notes (optional)</Label>
            <Textarea
              id={`notes-${questId}`}
              name="notes"
              rows={2}
              maxLength={1000}
              placeholder="Any additional context for reviewers…"
            />
          </div>
          {state.status === "error" ? (
            <p role="status" className="text-xs text-destructive">
              {state.message}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" size="sm" className="ml-auto" />}>
              Cancel
            </DialogClose>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
