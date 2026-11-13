"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteStudySession } from "@/features/study-planner/actions";
import type { StudySessionWithCourse } from "@/types";

type Props = {
  session: StudySessionWithCourse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function DeleteSessionDialog({ session, open, onOpenChange, onSuccess }: Props) {
  const [deleteSeries, setDeleteSeries] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;

  async function handleDelete() {
    if (!session) return;
    setError(null);
    setIsDeleting(true);

    try {
      const result = await deleteStudySession(
        session.id,
        deleteSeries && Boolean(session.recurrence_id)
      );
      if (!result.ok) {
        setError(result.error);
        setIsDeleting(false);
        return;
      }
      setIsDeleting(false);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      setError("Failed to delete study session. Please try again.");
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            <DialogTitle>Delete study session</DialogTitle>
          </div>
          <DialogDescription>
            Are you sure you want to remove &ldquo;{session.title}&rdquo;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {session.recurrence_id ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-semibold">Recurring Series Options</p>
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={deleteSeries}
                onChange={(e) => setDeleteSeries(e.target.checked)}
                className="rounded border-border text-destructive focus:ring-destructive"
              />
              Delete all recurring sessions in this series
            </label>
          </div>
        ) : null}

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : deleteSeries && session.recurrence_id ? (
              "Delete entire series"
            ) : (
              "Delete session"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

