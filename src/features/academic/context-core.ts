export type PlacementStatus = "none" | "claimed" | "confirmed" | "rejected";

export type AcademicContext = {
  sessionLabel: string | null;
  semesterLabel: string | null;
  levelCode: string | null;
  placementStatus: PlacementStatus;
  offeringIds: string[];
};

const STATUSES: PlacementStatus[] = ["claimed", "confirmed", "rejected"];

export function toAcademicContext(
  row: { level_code: string | null; placement_status: string | null } | null,
  enrolments: Array<{ offering_id: string }>,
  labels: { session: string | null; semester: string | null } | null
): AcademicContext {
  const status = STATUSES.includes(row?.placement_status as PlacementStatus)
    ? (row!.placement_status as PlacementStatus)
    : "none";
  return {
    sessionLabel: labels?.session ?? null,
    semesterLabel: labels?.semester ?? null,
    levelCode: status === "none" ? null : (row?.level_code ?? null),
    placementStatus: status,
    offeringIds: enrolments.map((e) => e.offering_id),
  };
}

/** Dashboard headline, e.g. "Level 200 · First Semester" (spec 5.2); null before any session exists. */
export function academicHeadline(ctx: Pick<AcademicContext, "levelCode" | "semesterLabel" | "sessionLabel">): string | null {
  const term = ctx.semesterLabel ?? ctx.sessionLabel;
  if (!term) return null;
  return `${ctx.levelCode ? `Level ${ctx.levelCode}` : "Level not set"} · ${term}`;
}
