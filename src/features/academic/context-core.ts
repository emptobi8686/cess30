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
