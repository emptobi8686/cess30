"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/shared/form-status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { bulkCreateOfferingsAction, updateOfferingStatusAction } from "@/features/academic/actions";
import { OFFERING_STATUSES } from "@/features/academic/offerings";
import { LEVEL_CODES } from "@/features/academic/validation";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

type CourseOption = { id: string; course_code: string; course_title: string; level: string };

export function BulkOfferForm({ semesterId, courses, defaultLevel }: { semesterId: string; courses: CourseOption[]; defaultLevel: string }) {
  const [state, action, pending] = useActionState(bulkCreateOfferingsAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="semesterId" value={semesterId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="offer-level">Offer to level</Label>
          <select id="offer-level" name="levelCode" defaultValue={defaultLevel} className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
            {LEVEL_CODES.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>{pending ? "Offering…" : "Offer selected courses"}</Button>
      </div>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-medium text-muted-foreground">Courses</legend>
        {courses.map((course) => (
          <label key={course.id} htmlFor={`offer-${course.id}`} className="flex items-center gap-2 text-sm">
            <input id={`offer-${course.id}`} type="checkbox" name="courseId" value={course.id} />
            <span className="font-mono text-xs font-semibold">{course.course_code}</span>
            <span>{course.course_title}</span>
            <span className="text-xs text-muted-foreground">({course.level})</span>
          </label>
        ))}
      </fieldset>
      <FormStatus state={state} />
    </form>
  );
}

export function OfferingStatusForm({ offeringId, status, label }: { offeringId: string; status: string; label: string }) {
  const [state, action, pending] = useActionState(updateOfferingStatusAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="offeringId" value={offeringId} />
      <label htmlFor={`status-${offeringId}`} className="sr-only">Status for {label}</label>
      <select id={`status-${offeringId}`} name="status" defaultValue={status} className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
        {OFFERING_STATUSES.map((value) => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>Save</Button>
      <FormStatus state={state} />
    </form>
  );
}
