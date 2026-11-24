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
import { createLibraryResourceAction, updateLibraryResourceAction } from "@/features/library/actions";
import type { LibraryResourceRow } from "@/features/library/queries";
import { COPYRIGHT_BASES, COPYRIGHT_LABELS, RESOURCE_TYPE_LABELS, RESOURCE_TYPES } from "@/features/library/schema";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

const SELECT = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

export function ResourceForm({ resource, courses }: { resource?: LibraryResourceRow; courses: Array<{ id: string; label: string; level: string }> }) {
  const [state, action, pending] = useActionState(resource ? updateLibraryResourceAction : createLibraryResourceAction, IDLE_ACTION_STATE);
  const { isAdmin } = useStaffAccess();
  const levels = useAllowedLevels();
  const scopedCourses = courses.filter((c) => levels.includes(c.level));
  // Only department administrators can approve past questions (enforced in the database too).
  const bases = COPYRIGHT_BASES.filter((b) => isAdmin || b !== "approved_past_question");
  const types = RESOURCE_TYPES.filter((t) => isAdmin || t !== "past_question" || resource?.resource_type === "past_question");

  return (
    <form action={action} className="space-y-4">
      {resource ? <input type="hidden" name="resourceId" value={resource.id} /> : null}
      <div className="space-y-1.5">
        <Label htmlFor="lib-title">Title</Label>
        <Input id="lib-title" name="title" required minLength={3} maxLength={200} defaultValue={resource?.title ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lib-description">Description</Label>
        <Textarea id="lib-description" name="description" maxLength={2000} defaultValue={resource?.description ?? ""} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lib-type">Type</Label>
          <select id="lib-type" name="resource_type" defaultValue={resource?.resource_type ?? "course_notes"} className={SELECT}>
            {types.map((t) => <option key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lib-course">Course (optional)</Label>
          <select id="lib-course" name="course_id" defaultValue={resource?.course_id ?? ""} className={SELECT}>
            <option value="">None</option>
            {scopedCourses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lib-level">Level (for filtering)</Label>
          <select id="lib-level" name="level_code" defaultValue={resource?.level_code ?? levels[0] ?? ""} className={SELECT}>
            {isAdmin ? <option value="">Any</option> : null}
            {levels.map((l) => <option key={l} value={l}>Level {l}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lib-tags">Tags (comma-separated, up to 10)</Label>
          <Input id="lib-tags" name="tags" defaultValue={resource?.tags.join(", ") ?? ""} placeholder="beams, statics" />
        </div>
      </div>

      <AudiencePicker name="audiences" id="lib-audience" defaultValue={toAudienceInputs(resource?.library_resource_audiences)} />

      <fieldset className="space-y-3 rounded-lg border border-border/70 p-3">
        <legend className="px-1 text-sm font-medium">Copyright</legend>
        <div className="space-y-1.5">
          <Label htmlFor="lib-basis">Basis for sharing</Label>
          <select id="lib-basis" name="copyright_basis" defaultValue={resource?.copyright_basis ?? "own_work"} className={SELECT}>
            {bases.map((b) => <option key={b} value={b}>{COPYRIGHT_LABELS[b]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lib-licence">Licence or permission note (optional)</Label>
          <Input id="lib-licence" name="licence_note" maxLength={500} defaultValue={resource?.licence_note ?? ""} placeholder="e.g. Shared by Dr Ade for CEE301, Oct 2026" />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="attestation" required className="mt-1" />
          <span>I confirm I have the right to share this file with the chosen students, and it contains no personal data.</span>
        </label>
      </fieldset>

      <Button type="submit" disabled={pending}>{resource ? "Save changes" : "Create draft"}</Button>
      <FormStatus state={state} />
    </form>
  );
}
