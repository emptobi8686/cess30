"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/shared/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveLibraryReportAction } from "@/features/library/actions";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export function ResolveReportForm({ reportId, resourceId }: { reportId: string; resourceId: string }) {
  const [state, action, pending] = useActionState(resolveLibraryReportAction, IDLE_ACTION_STATE);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="resourceId" value={resourceId} />
      <Input name="note" placeholder="Resolution note (8+ characters)" maxLength={500} className="max-w-xs" aria-label="Resolution note" />
      <Button type="submit" name="decision" value="actioned" size="sm" disabled={pending}>Mark fixed</Button>
      <Button type="submit" name="decision" value="takedown" size="sm" variant="destructive" disabled={pending}>Take down</Button>
      <Button type="submit" name="decision" value="dismissed" size="sm" variant="ghost" disabled={pending}>Dismiss</Button>
      <FormStatus state={state} />
    </form>
  );
}
