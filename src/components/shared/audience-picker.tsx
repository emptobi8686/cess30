"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAllowedLevels, useStaffAccess } from "@/components/shared/staff-access";
import { describeAudience, type AudienceInput, type AudienceKind } from "@/features/audiences/schema";

type Option = { id: string; label: string; level: string; courseId?: string };
export type AudiencePickerOptions = { courses: Option[]; offerings: Option[] };

const OptionsContext = createContext<AudiencePickerOptions>({ courses: [], offerings: [] });

/** Current-semester offerings the user may schedule for (course reps: their levels). */
export function useOfferingOptions(): Option[] {
  const allowedLevels = useAllowedLevels();
  const options = useContext(OptionsContext);
  return useMemo(() => options.offerings.filter((o) => allowedLevels.includes(o.level)), [options.offerings, allowedLevels]);
}

export function AudienceOptionsProvider({ value, children }: { value: AudiencePickerOptions; children: React.ReactNode }) {
  return <OptionsContext.Provider value={value}>{children}</OptionsContext.Provider>;
}

const KIND_LABELS: Record<AudienceKind, string> = {
  department: "Whole department",
  level: "A level",
  offering: "A course offering (this semester)",
  course: "A course (any semester)",
  staff_only: "Staff only",
};

/**
 * Chooses who sees an announcement or quest. Serialises a JSON list into a hidden input.
 * Course representatives only get targets inside their own levels; the database re-checks.
 */
export function AudiencePicker({ name, defaultValue = [], id = "audience" }: { name: string; defaultValue?: AudienceInput[]; id?: string }) {
  const { isAdmin } = useStaffAccess();
  const allowedLevels = useAllowedLevels();
  const options = useContext(OptionsContext);
  const courses = useMemo(() => options.courses.filter((c) => allowedLevels.includes(c.level)), [options.courses, allowedLevels]);
  const offerings = useMemo(() => options.offerings.filter((o) => allowedLevels.includes(o.level)), [options.offerings, allowedLevels]);
  const kinds: AudienceKind[] = isAdmin ? ["department", "level", "offering", "course", "staff_only"] : ["level", "offering", "course"];

  const [rows, setRows] = useState<AudienceInput[]>(defaultValue);
  const [kind, setKind] = useState<AudienceKind>(kinds[0]);
  const [target, setTarget] = useState("");

  const labels = useMemo(
    () => Object.fromEntries([...options.courses, ...options.offerings].map((o) => [o.id, o.label])),
    [options.courses, options.offerings]
  );
  const targets: Array<{ value: string; label: string }> =
    kind === "level" ? allowedLevels.map((l) => ({ value: l, label: `Level ${l}` }))
    : kind === "offering" ? offerings.map((o) => ({ value: o.id, label: o.label }))
    : kind === "course" ? courses.map((c) => ({ value: c.id, label: c.label }))
    : [];

  function add() {
    let row: AudienceInput | null = null;
    if (kind === "department" || kind === "staff_only") row = { audience_kind: kind };
    else if (kind === "level" && target) row = { audience_kind: "level", level_code: target as "100" };
    else if (kind === "offering" && target) row = { audience_kind: "offering", offering_id: target };
    else if (kind === "course" && target) row = { audience_kind: "course", course_id: target };
    if (!row) return;
    const label = describeAudience(row, labels);
    if (rows.some((r) => describeAudience(r, labels) === label)) return;
    setRows([...rows, row]);
    setTarget("");
  }

  return (
    <fieldset className="space-y-2 rounded-lg border border-border/70 p-3">
      <legend className="px-1 text-sm font-medium">Who sees this</legend>
      <input type="hidden" name={name} value={JSON.stringify(rows)} />
      {rows.length === 0 ? (
        <p role="status" className="text-xs font-medium text-amber-700 dark:text-amber-400">Not visible to any student yet. Add an audience.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Chosen audiences">
          {rows.map((row, index) => {
            const label = describeAudience(row, labels);
            return (
              <li key={label} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-xs">
                {label}
                <button type="button" aria-label={`Remove ${label}`} onClick={() => setRows(rows.filter((_, i) => i !== index))} className="flex items-center justify-center rounded-full p-0.5 transition-colors duration-(--duration-fast) hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:-my-1.5 pointer-coarse:p-2">
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${id}-kind`}>Add audience</Label>
          <select id={`${id}-kind`} value={kind} onChange={(e) => { setKind(e.target.value as AudienceKind); setTarget(""); }}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
            {kinds.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          </select>
        </div>
        {targets.length > 0 || kind === "level" || kind === "offering" || kind === "course" ? (
          <div className="space-y-1">
            <Label htmlFor={`${id}-target`}>Target</Label>
            <select id={`${id}-target`} value={target} onChange={(e) => setTarget(e.target.value)}
              className="h-9 max-w-64 rounded-lg border border-input bg-background px-2 text-sm">
              <option value="">Choose…</option>
              {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={add}>Add</Button>
      </div>
    </fieldset>
  );
}
