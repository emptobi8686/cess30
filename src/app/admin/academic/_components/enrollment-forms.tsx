"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/shared/form-status";
import { Button } from "@/components/ui/button";
import { dropEnrollmentAction, enrollLevelCoreAction, enrollStudentAction } from "@/features/academic/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export function EnrollLevelForm({ semesterId, levelCode }: { semesterId: string; levelCode: string }) {
  const [state, action, pending] = useActionState(enrollLevelCoreAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="semesterId" value={semesterId} />
      <input type="hidden" name="levelCode" value={levelCode} />
      <Button type="submit" disabled={pending}>Enrol all confirmed level {levelCode} students</Button>
      <p className="text-xs text-muted-foreground">Adds every confirmed level {levelCode} student to each open level {levelCode} offering this semester. Safe to repeat.</p>
      <FormStatus state={state} />
    </form>
  );
}

export function EnrollStudentForm({ studentId, offeringId, label }: { studentId: string; offeringId: string; label: string }) {
  const [state, action, pending] = useActionState(enrollStudentAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="offeringId" value={offeringId} />
      <select name="type" defaultValue="carryover" aria-label={`Enrolment type for ${label}`} className="h-8 rounded-lg border border-input bg-background px-2 text-xs">
        <option value="carryover">Carry-over</option>
        <option value="elective">Elective</option>
        <option value="audit">Audit</option>
        <option value="core">Core</option>
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending} aria-label={`Enrol ${label}`}>Enrol</Button>
      <FormStatus state={state} />
    </form>
  );
}

export function DropEnrollmentForm({ enrollmentId, label }: { enrollmentId: string; label: string }) {
  const [state, action, pending] = useActionState(dropEnrollmentAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending} aria-label={`Drop ${label}`}>Drop</Button>
      <FormStatus state={state} />
    </form>
  );
}
