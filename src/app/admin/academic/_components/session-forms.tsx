"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/shared/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSemesterAction,
  createSessionAction,
  setCurrentSemesterAction,
  setCurrentSessionAction,
} from "@/features/academic/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export function CreateSessionForm() {
  const [state, action, pending] = useActionState(createSessionAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="session-label">Session</Label>
        <Input id="session-label" name="label" placeholder="2026/2027" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="session-start">Starts</Label>
        <Input id="session-start" name="starts_on" type="date" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="session-end">Ends</Label>
        <Input id="session-end" name="ends_on" type="date" required />
      </div>
      <div className="flex flex-col justify-end gap-1">
        <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create session"}</Button>
      </div>
      <div className="sm:col-span-4"><FormStatus state={state} /></div>
    </form>
  );
}

export function CreateSemesterForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState(createSemesterAction, IDLE_ACTION_STATE);
  const id = (field: string) => `semester-${sessionId}-${field}`;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-5">
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="space-y-1.5">
        <Label htmlFor={id("number")}>Number</Label>
        <select id={id("number")} name="number" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" defaultValue="1">
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("label")}>Name</Label>
        <Input id={id("label")} name="label" placeholder="First Semester" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("start")}>Starts</Label>
        <Input id={id("start")} name="starts_on" type="date" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("end")}>Ends</Label>
        <Input id={id("end")} name="ends_on" type="date" required />
      </div>
      <div className="flex flex-col justify-end">
        <Button type="submit" variant="outline" disabled={pending}>{pending ? "Adding…" : "Add semester"}</Button>
      </div>
      <div className="sm:col-span-5"><FormStatus state={state} /></div>
    </form>
  );
}

export function MakeCurrentButton({ kind, id, label }: { kind: "session" | "semester"; id: string; label: string }) {
  const [state, action, pending] = useActionState(
    kind === "session" ? setCurrentSessionAction : setCurrentSemesterAction,
    IDLE_ACTION_STATE
  );
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name={kind === "session" ? "sessionId" : "semesterId"} value={id} />
      <Button type="submit" size="sm" variant="outline" disabled={pending} aria-label={`Make ${label} current`}>
        Make current
      </Button>
      <FormStatus state={state} />
    </form>
  );
}
