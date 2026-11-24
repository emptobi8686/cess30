const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function selectedCourseIds(formData: FormData): string[] {
  return Array.from(
    new Set(formData.getAll("courseId").map(String).filter((value) => UUID.test(value)))
  );
}

export function bulkOfferingMessage(requested: number, inserted: number): string {
  const existing = requested - inserted;
  const noun = inserted === 1 ? "offering" : "offerings";
  if (existing === 0) return `${inserted} new ${noun} created.`;
  if (inserted === 0) return `0 new offerings (${existing} already existed).`;
  return `${inserted} new ${noun} created (${existing} already existed).`;
}

export const OFFERING_STATUSES = ["planned", "active", "completed", "cancelled"] as const;
export type OfferingStatus = (typeof OFFERING_STATUSES)[number];
