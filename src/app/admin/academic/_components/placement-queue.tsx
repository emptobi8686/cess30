"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/shared/form-status";
import { Button } from "@/components/ui/button";
import { confirmPlacementsAction } from "@/features/academic/placement-actions";
import type { PlacementQueueRow } from "@/features/academic/queries";
import { getVerificationStatusLabel } from "@/lib/verification";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

export function PlacementQueue({ rows, readOnly }: { rows: PlacementQueueRow[]; readOnly: boolean }) {
  const [state, action, pending] = useActionState(confirmPlacementsAction, IDLE_ACTION_STATE);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No placements match this filter.</p>;
  }

  return (
    <form action={action} className="space-y-3">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              {!readOnly ? <th scope="col" className="px-2 py-2"><span className="sr-only">Select</span></th> : null}
              <th scope="col" className="px-2 py-2 font-medium">Student</th>
              <th scope="col" className="px-2 py-2 font-medium">Matric</th>
              <th scope="col" className="px-2 py-2 font-medium">Verification</th>
              <th scope="col" className="px-2 py-2 font-medium">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.id}>
                {!readOnly ? (
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      name="placementId"
                      value={row.id}
                      aria-label={`Select ${row.profiles?.full_name ?? "student"}`}
                    />
                  </td>
                ) : null}
                <td className="px-2 py-2">{row.profiles?.full_name ?? "Unknown"}</td>
                <td className="px-2 py-2 font-mono text-xs">{row.profiles?.matric_number ?? "—"}</td>
                <td className="px-2 py-2 text-xs">{getVerificationStatusLabel(row.profiles?.verification_status ?? "pending")}</td>
                <td className="px-2 py-2">{row.level_code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="decision" value="confirmed" disabled={pending}>Confirm selected</Button>
          <Button type="submit" name="decision" value="rejected" variant="outline" disabled={pending}>Reject selected</Button>
        </div>
      ) : null}
      <FormStatus state={state} />
    </form>
  );
}
