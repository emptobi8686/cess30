"use client";

import { useActionState } from "react";
import { AudiencePicker } from "@/components/shared/audience-picker";
import { FormStatus } from "@/components/shared/form-status";
import { useAllowedLevels, useStaffAccess } from "@/components/shared/staff-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toAudienceInputs } from "@/features/audiences/schema";
import { createTutorialAction, updateTutorialAction } from "@/features/tutorials/actions";
import type { TutorialRow } from "@/features/tutorials/queries";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

const SELECT = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

export function TutorialForm({ tutorial, courses }: { tutorial?: TutorialRow; courses: Array<{ id: string; label: string; level: string }> }) {
  const [state, action, pending] = useActionState(tutorial ? updateTutorialAction : createTutorialAction, IDLE_ACTION_STATE);
  const { isAdmin } = useStaffAccess();
  const levels = useAllowedLevels();
  return (
    <form action={action} className="space-y-4">
      {tutorial ? <input type="hidden" name="tutorialId" value={tutorial.id} /> : null}
      <div className="space-y-1.5">
        <Label htmlFor="tu-url">Video link</Label>
        <Input id="tu-url" name="video_url" required defaultValue={tutorial?.external_url ?? ""} placeholder="https://www.youtube.com/watch?v=…" />
        <p className="text-xs text-muted-foreground">YouTube or Vimeo play inside BLUEPRINT; approved sites (MIT OCW, Khan Academy, NPTEL) open in a new tab.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tu-title">Title</Label>
          <Input id="tu-title" name="title" required minLength={3} maxLength={160} defaultValue={tutorial?.title ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tu-topic">Topic</Label>
          <Input id="tu-topic" name="topic" required minLength={2} maxLength={80} defaultValue={tutorial?.topic ?? ""} placeholder="e.g. Beams" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tu-course">Course (optional)</Label>
          <select id="tu-course" name="course_id" defaultValue={tutorial?.course_id ?? ""} className={SELECT}>
            <option value="">None</option>
            {courses.filter((c) => levels.includes(c.level)).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tu-level">Level</Label>
          <select id="tu-level" name="level_code" defaultValue={tutorial?.level_code ?? levels[0] ?? ""} className={SELECT}>
            {isAdmin ? <option value="">Any</option> : null}
            {levels.map((l) => <option key={l} value={l}>Level {l}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tu-duration">Duration in minutes (optional)</Label>
          <Input id="tu-duration" name="duration_minutes" type="number" min={1} max={600}
            defaultValue={tutorial?.duration_seconds ? Math.round(tutorial.duration_seconds / 60) : ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tu-description">Description</Label>
        <Textarea id="tu-description" name="description" maxLength={2000} defaultValue={tutorial?.description ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tu-objectives">Learning objectives (one per line, up to 8)</Label>
        <Textarea id="tu-objectives" name="learning_objectives" required defaultValue={tutorial?.learning_objectives.join("\n") ?? ""} />
      </div>
      <AudiencePicker name="audiences" id="tu-audience" defaultValue={toAudienceInputs(tutorial?.tutorial_audiences)} />
      <Button type="submit" disabled={pending}>{tutorial ? "Save changes" : "Create draft"}</Button>
      <FormStatus state={state} />
    </form>
  );
}
