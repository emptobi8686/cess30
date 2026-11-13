export const ANNOUNCEMENT_SCOPES = ["all", "department", "level", "course"] as const;

export type AnnouncementScope = (typeof ANNOUNCEMENT_SCOPES)[number];

/**
 * Validates the scope/course relationship for an announcement.
 */
export function validateAnnouncementScope(
  scope: string,
  courseId: string | null
): string | null {
  if (!ANNOUNCEMENT_SCOPES.includes(scope as AnnouncementScope)) {
    return "Invalid scope.";
  }
  if (scope === "course" && !courseId) {
    return "A course must be selected for course-scoped announcements.";
  }
  if (scope !== "course" && courseId) {
    return "Only course-scoped announcements may specify a course.";
  }
  return null;
}
