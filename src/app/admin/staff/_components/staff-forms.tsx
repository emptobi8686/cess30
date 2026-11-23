"use client";

import { useActionState, useState } from "react";
import { FormStatus } from "@/components/shared/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEVEL_CODES } from "@/features/academic/validation";
import { approveCapabilityAction, grantCapabilityAction, revokeCapabilityAction } from "@/features/staff/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export function GrantForm({ userId, name }: { userId: string; name: string }) {
  const [state, action, pending] = useActionState(grantCapabilityAction, IDLE_ACTION_STATE);
  const [capability, setCapability] = useState("level_coordinator");
  const prefix = `grant-${userId}`;
  return (
    <form action={action} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
      <input type="hidden" name="userId" value={userId} />
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-cap`}>Role for {name}</Label>
        <select id={`${prefix}-cap`} name="capability" value={capability} onChange={(e) => setCapability(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
          <option value="level_coordinator">Course representative</option>
          <option value="department_admin">Department administrator</option>
        </select>
      </div>
      {capability === "level_coordinator" ? (
        <div className="space-y-1">
          <Label htmlFor={`${prefix}-level`}>Level</Label>
          <select id={`${prefix}-level`} name="levelCode" defaultValue="200" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
            {LEVEL_CODES.map((level) => <option key={level} value={level}>Level {level}</option>)}
          </select>
        </div>
      ) : <p className="text-xs text-muted-foreground">Needs approval by a second administrator.</p>}
      <div className="space-y-1">
        <Label htmlFor={`${prefix}-reason`}>Reason</Label>
        <Input id={`${prefix}-reason`} name="reason" minLength={8} maxLength={300} required placeholder="e.g. Elected class representative for 2026/2027" />
      </div>
      <Button type="submit" disabled={pending}>Grant</Button>
      <div className="sm:col-span-4"><FormStatus state={state} /></div>
    </form>
  );
}

export function ApproveForm({ assignmentId, name }: { assignmentId: string; name: string }) {
  const [state, action, pending] = useActionState(approveCapabilityAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Button type="submit" size="sm" disabled={pending} aria-label={`Approve ${name}`}>Approve</Button>
      <FormStatus state={state} />
    </form>
  );
}

export function RevokeForm({ assignmentId, name }: { assignmentId: string; name: string }) {
  const [state, action, pending] = useActionState(revokeCapabilityAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending} aria-label={`Remove ${name}`}>Remove</Button>
      <FormStatus state={state} />
    </form>
  );
}
