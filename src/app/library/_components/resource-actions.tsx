"use client";

import { useActionState, useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { FormStatus } from "@/components/shared/form-status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reportLibraryResourceAction, toggleBookmarkAction } from "@/features/library/student-actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export function BookmarkToggle({ resourceId, initial }: { resourceId: string; initial: boolean }) {
  const [bookmarked, setBookmarked] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" variant="outline" disabled={pending} aria-pressed={bookmarked}
        onClick={() => start(async () => {
          const r = await toggleBookmarkAction(resourceId);
          if (r.ok) { setBookmarked(r.data.bookmarked); setError(null); } else setError(r.error);
        })}>
        {bookmarked ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </Button>
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}

const REASONS: Array<[string, string]> = [
  ["broken", "File is broken or won't open"],
  ["wrong_course", "Wrong course or level"],
  ["outdated", "Outdated"],
  ["copyright", "Copyright concern"],
  ["inappropriate", "Inappropriate content"],
  ["other", "Something else"],
];

export function ReportForm({ resourceId }: { resourceId: string }) {
  const [state, action, pending] = useActionState(reportLibraryResourceAction, IDLE_ACTION_STATE);
  const [open, setOpen] = useState(false);
  if (!open) return <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>Report a problem</Button>;
  return (
    <form action={action} className="space-y-2 rounded-lg border p-3">
      <input type="hidden" name="resourceId" value={resourceId} />
      <Label htmlFor="report-reason">What&apos;s wrong?</Label>
      <select id="report-reason" name="reason" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
        {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Label htmlFor="report-details">Details (optional)</Label>
      <Textarea id="report-details" name="details" maxLength={1000} />
      <Button type="submit" size="sm" disabled={pending}>Send report</Button>
      <FormStatus state={state} />
    </form>
  );
}
