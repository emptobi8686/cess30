"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/shared/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  archiveLibraryResourceAction,
  publishLibraryResourceAction,
  removeLibraryResourceAction,
  restoreLibraryResourceAction,
} from "@/features/library/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

function StatusButton({ id, label, action: serverAction, variant }: {
  id: string;
  label: string;
  action: typeof publishLibraryResourceAction;
  variant?: "default" | "outline";
}) {
  const [state, action, pending] = useActionState(serverAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="resourceId" value={id} />
      <Button type="submit" size="sm" variant={variant ?? "default"} disabled={pending}>{label}</Button>
      <FormStatus state={state} />
    </form>
  );
}

export function StatusControls({ id, status }: { id: string; status: string }) {
  const [removeState, remove, removing] = useActionState(removeLibraryResourceAction, IDLE_ACTION_STATE);
  if (status === "removed") return <p className="text-sm text-muted-foreground">Removed. Files were deleted from storage.</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {status === "draft" || status === "in_review" ? <StatusButton id={id} label="Publish" action={publishLibraryResourceAction} /> : null}
        {status === "published" ? <StatusButton id={id} label="Archive" action={archiveLibraryResourceAction} variant="outline" /> : null}
        {status === "archived" ? <StatusButton id={id} label="Restore" action={restoreLibraryResourceAction} /> : null}
      </div>
      <form action={remove} className="space-y-2 rounded-lg border border-destructive/30 p-3">
        <input type="hidden" name="resourceId" value={id} />
        <label htmlFor={`remove-${id}`} className="text-sm font-medium">Take down (copyright or other complaint)</label>
        <Input id={`remove-${id}`} name="reason" minLength={8} maxLength={500} required placeholder="Reason, e.g. lecturer withdrew permission" />
        <Button type="submit" size="sm" variant="destructive" disabled={removing}>Remove and delete files</Button>
        <FormStatus state={removeState} />
      </form>
    </div>
  );
}
