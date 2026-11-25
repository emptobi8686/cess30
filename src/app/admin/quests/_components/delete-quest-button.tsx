"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
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
import { deleteQuestAction } from "@/features/quests/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export function DeleteQuestButton({
  questId,
  questTitle,
  submissionCount,
}: {
  questId: string;
  questTitle: string;
  /** null when unknown (the submissions list is filtered). */
  submissionCount: number | null;
}) {
  const [state, action, pending] = useActionState(deleteQuestAction, IDLE_ACTION_STATE);

  if (state.status === "success") {
    return <p role="status" className="text-xs text-primary">{state.message}</p>;
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
        <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
        Delete quest
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &quot;{questTitle}&quot;?</DialogTitle>
          <DialogDescription>
            {submissionCount === null
              ? "Its submissions and uploaded files will be deleted too. "
              : submissionCount > 0
                ? `Its ${submissionCount} submission(s) and uploaded files will be deleted too. `
                : ""}
            XP students already earned from it stays on the leaderboard. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="questId" value={questId} />
          {state.status === "error" ? (
            <p role="status" className="mb-3 text-xs text-destructive">{state.message}</p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" size="sm" className="ml-auto" />}>
              Keep it
            </DialogClose>
            <Button type="submit" variant="destructive" size="sm" disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
