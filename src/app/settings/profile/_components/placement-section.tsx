"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/shared/form-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { requestPlacementAction } from "@/features/academic/placement-actions";
import type { AcademicContext } from "@/features/academic/context-core";
import { LEVEL_CODES } from "@/features/academic/validation";
import { IDLE_ACTION_STATE } from "@/lib/action-state";

const STATUS_TEXT: Record<AcademicContext["placementStatus"], string> = {
  none: "Not set",
  claimed: "Awaiting confirmation",
  confirmed: "Confirmed",
  rejected: "Not accepted. Choose your level again.",
};

export function PlacementSection({ academic }: { academic: AcademicContext }) {
  const [state, action, pending] = useActionState(requestPlacementAction, IDLE_ACTION_STATE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your level</CardTitle>
        <CardDescription>
          {academic.sessionLabel
            ? `Your level for ${academic.sessionLabel} decides your timetable, courses and announcements.`
            : "Levels open once an administrator starts the academic session."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          {academic.levelCode ? <span className="font-medium">Level {academic.levelCode}</span> : null}
          {academic.levelCode ? " · " : null}
          <span className="text-muted-foreground">{STATUS_TEXT[academic.placementStatus]}</span>
        </p>
        {academic.sessionLabel && academic.placementStatus !== "confirmed" ? (
          <form action={action} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="placement-level">Level</Label>
              <select
                id="placement-level"
                name="levelCode"
                defaultValue={academic.levelCode ?? "200"}
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
              >
                {LEVEL_CODES.map((level) => (
                  <option key={level} value={level}>
                    {level} Level
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : academic.placementStatus === "none" ? "Request level" : "Update request"}
            </Button>
          </form>
        ) : null}
        <FormStatus state={state} />
      </CardContent>
    </Card>
  );
}
