import { z } from "zod";
import { LEVEL_CODES } from "@/features/academic/validation";

/** Who sees an announcement or quest (E4). Deny by default: an empty list reaches no student. */
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Choose a valid target.");
const level = z.enum(LEVEL_CODES, { message: "Choose a valid level." });

export const audienceInputSchema = z.discriminatedUnion("audience_kind", [
  z.object({ audience_kind: z.literal("department") }),
  z.object({ audience_kind: z.literal("staff_only") }),
  z.object({ audience_kind: z.literal("level"), level_code: level }),
  z.object({ audience_kind: z.literal("course"), course_id: uuid }),
  z.object({ audience_kind: z.literal("offering"), offering_id: uuid }),
]);

export type AudienceInput = z.infer<typeof audienceInputSchema>;
export type AudienceKind = AudienceInput["audience_kind"];

export const audienceListSchema = z.array(audienceInputSchema).max(20, "Choose at most 20 audiences.");

function keyOf(a: AudienceInput): string {
  switch (a.audience_kind) {
    case "level":
      return `level:${a.level_code}`;
    case "course":
      return `course:${a.course_id}`;
    case "offering":
      return `offering:${a.offering_id}`;
    default:
      return a.audience_kind;
  }
}

export function parseAudienceField(
  raw: string | null | undefined
): { ok: true; audiences: AudienceInput[] } | { ok: false; error: string } {
  if (!raw || !raw.trim()) return { ok: true, audiences: [] };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Choose who should see this." };
  }
  const parsed = audienceListSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Choose who should see this." };
  const seen = new Set<string>();
  const audiences = parsed.data.filter((a) => {
    const k = keyOf(a);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { ok: true, audiences };
}

/** The legacy announcements.scope/course_id columns are kept consistent for old readers. */
export function scopeForAudiences(audiences: AudienceInput[]): { scope: "department" | "level" | "course"; course_id: string | null } {
  const first = audiences[0];
  if (!first || first.audience_kind === "department" || first.audience_kind === "staff_only") return { scope: "department", course_id: null };
  if (first.audience_kind === "level") return { scope: "level", course_id: null };
  if (first.audience_kind === "course") return { scope: "course", course_id: first.course_id };
  return { scope: "department", course_id: null };
}

export function describeAudience(
  a: { audience_kind: string; level_code?: string | null; course_id?: string | null; offering_id?: string | null },
  labels: Record<string, string> = {}
): string {
  switch (a.audience_kind) {
    case "department":
      return "Department";
    case "staff_only":
      return "Staff only";
    case "level":
      return `Level ${a.level_code ?? "?"}`;
    case "course":
      return (a.course_id && labels[a.course_id]) || "Course";
    case "offering":
      return (a.offering_id && labels[a.offering_id]) || "Course offering";
    default:
      return "Audience";
  }
}

export type AudienceRow = {
  audience_kind: string;
  level_code: string | null;
  course_id: string | null;
  offering_id: string | null;
};

/** Stored audience rows → picker inputs (rows that no longer validate are dropped). */
export function toAudienceInputs(rows: AudienceRow[] | null | undefined): AudienceInput[] {
  return (rows ?? []).flatMap((row) => {
    const candidate = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null));
    const parsed = audienceInputSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Select fragment that loads audience rows with readable course codes. */
export const AUDIENCE_SELECT =
  "audience_kind, level_code, course_id, offering_id, courses ( course_code ), course_offerings ( level_code, courses ( course_code ) )";

type LabelledAudienceRow = AudienceRow & {
  courses?: { course_code: string } | null;
  course_offerings?: { level_code: string; courses: { course_code: string } | null } | null;
};

/** Badge text for an item's audiences, e.g. "Level 300 · GET209 (Level 200)"; empty → "Hidden (no audience)". */
export function audienceBadge(rows: LabelledAudienceRow[] | null | undefined): string {
  if (!rows || rows.length === 0) return "Hidden (no audience)";
  return rows
    .map((row) => {
      if (row.audience_kind === "course" && row.courses) return row.courses.course_code;
      if (row.audience_kind === "offering" && row.course_offerings)
        return `${row.course_offerings.courses?.course_code ?? "Course"} (Level ${row.course_offerings.level_code})`;
      return describeAudience(row);
    })
    .join(" · ");
}
