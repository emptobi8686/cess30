"use client";

import { useActionState } from "react";
import { CheckCircle2, RotateCcw, ShieldOff, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  approveVerificationAction,
  changeVerificationStatusAction,
  rejectVerificationAction,
} from "@/features/verification/actions";
import { IDLE_ACTION_STATE, type ActionState } from "@/features/verification/action-state";
import type { VerificationStatus } from "@/types";

function StatusMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      role="status"
      className={state.status === "error" ? "text-xs text-destructive" : "text-xs text-primary"}
    >
      {state.message}
    </p>
  );
}

function ConfirmBox({ id, label }: { id: string; label: string }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-xs text-muted-foreground">
      <input id={id} type="checkbox" name="confirmed" required />
      {label}
    </label>
  );
}

function ApproveForm({ profileId, hasMatric }: { profileId: string; hasMatric: boolean }) {
  const [state, action, pending] = useActionState(approveVerificationAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="hasMatric" value={String(hasMatric)} />
      <ConfirmBox id={`approve-${profileId}`} label="Confirm approval" />
      <Button type="submit" size="sm" className="gap-2" disabled={pending || !hasMatric}>
        <CheckCircle2 className="h-4 w-4" aria-hidden />
        {pending ? "Approving…" : "Approve"}
      </Button>
      {!hasMatric ? (
        <p className="text-xs text-muted-foreground">Waiting for a matriculation number.</p>
      ) : null}
      <StatusMessage state={state} />
    </form>
  );
}

function RejectForm({ profileId }: { profileId: string }) {
  const [state, action, pending] = useActionState(rejectVerificationAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="profileId" value={profileId} />
      <label htmlFor={`reason-${profileId}`} className="sr-only">
        Reason for rejection
      </label>
      <Textarea
        id={`reason-${profileId}`}
        name="reason"
        rows={2}
        minLength={12}
        maxLength={500}
        placeholder="Reason for rejection (minimum 12 characters)"
        required
      />
      <ConfirmBox id={`reject-${profileId}`} label="Confirm rejection" />
      <Button type="submit" variant="destructive" size="sm" className="gap-2" disabled={pending}>
        <XCircle className="h-4 w-4" aria-hidden />
        {pending ? "Rejecting…" : "Reject"}
      </Button>
      <StatusMessage state={state} />
    </form>
  );
}

function StatusChangeForm({
  profileId,
  newStatus,
  label,
  needsReason,
  icon,
  destructive,
}: {
  profileId: string;
  newStatus: "suspended" | "verified" | "pending";
  label: string;
  needsReason: boolean;
  icon: React.ReactNode;
  destructive?: boolean;
}) {
  const [state, action, pending] = useActionState(changeVerificationStatusAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="newStatus" value={newStatus} />
      {needsReason ? (
        <>
          <label htmlFor={`status-reason-${profileId}`} className="sr-only">
            Reason
          </label>
          <Textarea
            id={`status-reason-${profileId}`}
            name="reason"
            rows={2}
            minLength={12}
            maxLength={500}
            placeholder="Reason (minimum 12 characters)"
            required
          />
        </>
      ) : null}
      <ConfirmBox id={`status-${newStatus}-${profileId}`} label={`Confirm: ${label.toLowerCase()}`} />
      <Button
        type="submit"
        size="sm"
        variant={destructive ? "destructive" : "outline"}
        className="gap-2"
        disabled={pending}
      >
        {icon}
        {pending ? "Saving…" : label}
      </Button>
      <StatusMessage state={state} />
    </form>
  );
}

export function ReviewForms({
  profileId,
  status,
  hasMatric,
}: {
  profileId: string;
  status: VerificationStatus;
  hasMatric: boolean;
}) {
  switch (status) {
    case "pending":
      return (
        <div className="flex flex-col gap-3">
          <ApproveForm profileId={profileId} hasMatric={hasMatric} />
          <RejectForm profileId={profileId} />
        </div>
      );
    case "verified":
      return (
        <StatusChangeForm
          profileId={profileId}
          newStatus="suspended"
          label="Suspend"
          needsReason
          destructive
          icon={<ShieldOff className="h-4 w-4" aria-hidden />}
        />
      );
    case "suspended":
      return (
        <StatusChangeForm
          profileId={profileId}
          newStatus="verified"
          label="Reinstate"
          needsReason={false}
          icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
        />
      );
    case "rejected":
      return (
        <StatusChangeForm
          profileId={profileId}
          newStatus="pending"
          label="Reopen review"
          needsReason={false}
          icon={<RotateCcw className="h-4 w-4" aria-hidden />}
        />
      );
  }
}
