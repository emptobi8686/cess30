"use client";

import { useActionState, useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, CheckCircle2, Circle } from "lucide-react";
import { FormStatus } from "@/components/shared/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  addToPlaylistAction,
  createPlaylistAction,
  markTutorialCompletedAction,
  reportTutorialAction,
  toggleSaveTutorialAction,
} from "@/features/tutorials/student-actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export function SaveToggle({ tutorialId, initial }: { tutorialId: string; initial: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="outline" aria-pressed={saved} disabled={pending}
      onClick={() => start(async () => { const r = await toggleSaveTutorialAction(tutorialId); if (r.ok) setSaved(r.data.saved); })}>
      {saved ? <BookmarkCheck className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}

export function CompletionToggle({ tutorialId, initial }: { tutorialId: string; initial: boolean }) {
  const [done, setDone] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" variant={done ? "default" : "outline"} aria-pressed={done} disabled={pending}
        onClick={() => start(async () => {
          const r = await markTutorialCompletedAction(tutorialId, !done);
          if (r.ok) { setDone(r.data.completed); setError(null); } else setError(r.error);
        })}>
        {done ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Circle className="mr-2 h-4 w-4" />}
        {done ? "Completed" : "Mark as completed"}
      </Button>
      {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
    </span>
  );
}

export function AddToPlaylist({ tutorialId, playlists }: { tutorialId: string; playlists: Array<{ id: string; title: string }> }) {
  const [state, action, pending] = useActionState(addToPlaylistAction, IDLE_ACTION_STATE);
  if (playlists.length === 0) return null;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tutorialId" value={tutorialId} />
      <div className="space-y-1">
        <Label htmlFor={`pl-${tutorialId}`}>Add to playlist</Label>
        <select id={`pl-${tutorialId}`} name="playlistId" className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
          {playlists.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>Add</Button>
      <FormStatus state={state} />
    </form>
  );
}

export function NewPlaylist() {
  const [state, action, pending] = useActionState(createPlaylistAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="new-playlist">New playlist</Label>
        <Input id="new-playlist" name="title" minLength={2} maxLength={120} required placeholder="e.g. Exam revision" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>Create</Button>
      <FormStatus state={state} />
    </form>
  );
}

const REASONS: Array<[string, string]> = [
  ["broken_link", "Video doesn't load"],
  ["not_embeddable", "Won't play here"],
  ["inaccurate", "Contains an error"],
  ["inappropriate", "Inappropriate"],
  ["copyright", "Copyright concern"],
  ["other", "Something else"],
];

export function ReportTutorial({ tutorialId }: { tutorialId: string }) {
  const [state, action, pending] = useActionState(reportTutorialAction, IDLE_ACTION_STATE);
  const [open, setOpen] = useState(false);
  if (!open) return <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>Report a problem</Button>;
  return (
    <form action={action} className="space-y-2 rounded-lg border p-3">
      <input type="hidden" name="tutorialId" value={tutorialId} />
      <Label htmlFor="tu-report-reason">What&apos;s wrong?</Label>
      <select id="tu-report-reason" name="reason" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
        {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Label htmlFor="tu-report-details">Details (optional)</Label>
      <Textarea id="tu-report-details" name="details" maxLength={1000} />
      <Button type="submit" size="sm" disabled={pending}>Send report</Button>
      <FormStatus state={state} />
    </form>
  );
}
