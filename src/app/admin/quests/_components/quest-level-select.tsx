"use client";

import { Label } from "@/components/ui/label";
import { useStaffAccess } from "@/components/shared/staff-access";
import { LEVEL_CODES } from "@/features/academic/validation";

/** Quest audience. Course representatives only see their own levels; the database enforces it too. */
export function QuestLevelSelect({ id, defaultValue }: { id: string; defaultValue: string | null }) {
  const { isAdmin, staffLevels } = useStaffAccess();
  const levels = isAdmin ? LEVEL_CODES : LEVEL_CODES.filter((level) => staffLevels.includes(level));
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Audience</Label>
      <select
        id={id}
        name="level_code"
        defaultValue={defaultValue ?? (isAdmin ? "" : levels[0])}
        className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
      >
        {isAdmin ? <option value="">Whole department</option> : null}
        {levels.map((level) => (
          <option key={level} value={level}>
            Level {level}
          </option>
        ))}
      </select>
    </div>
  );
}
