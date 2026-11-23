/** Pure helpers for enrolment management (no server imports, so they are unit-testable). */
export const ENROLMENT_TYPES = ["core", "carryover", "elective", "audit"] as const;
export type EnrolmentType = (typeof ENROLMENT_TYPES)[number];

export function isEnrolmentType(value: string): value is EnrolmentType {
  return (ENROLMENT_TYPES as readonly string[]).includes(value);
}

export function levelEnrolMessage(level: string, count: number): string {
  if (count === 0) return `No new level ${level} students to enrol. Everyone confirmed is already enrolled.`;
  return `${count} enrolment${count === 1 ? "" : "s"} added for level ${level}.`;
}
