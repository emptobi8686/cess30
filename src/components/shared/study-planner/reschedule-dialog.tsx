"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rescheduleStudySession } from "@/features/study-planner/actions";
import type { StudySessionWithCourse } from "@/types";

type Props = {
  session: StudySessionWithCourse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function RescheduleDialog({ session, open, onOpenChange, onSuccess }: Props) {
  const [studyDate, setStudyDate] = useState(session?.study_date ?? "");
  const [startTime, setStartTime] = useState(session?.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState(session?.end_time?.slice(0, 5) ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;

  async function handleReschedule(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await rescheduleStudySession(session.id, studyDate, startTime, endTime);
      if (!result.ok) {
        setError(result.error);
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
      onOpenChange(false);
      onSuccess?.();
    } catch {
      setError("Failed to reschedule session. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule study session</DialogTitle>
          <DialogDescription>
            Change the scheduled date and time for &ldquo;{session.title}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleReschedule} className="space-y-4 pt-2">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="reschedule-date">New date</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={studyDate}
              onChange={(e) => setStudyDate(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-start">Start time</Label>
              <Input
                id="reschedule-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-end">End time</Label>
              <Input
                id="reschedule-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Save new time"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

