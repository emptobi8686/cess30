import { z } from "zod";

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


/** Form rules shared by create and update (BP-050); mirrors the database CHECK constraints. */
export const announcementSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(160, "Title cannot exceed 160 characters."),
    content: z.string().trim().min(1, "Content is required.").max(5000, "Content cannot exceed 5000 characters."),
    scope: z.string(),
    course_id: z
      .string()
      .optional()
      .transform((value) => (value && value.trim() ? value.trim() : null)),
  })
  .superRefine((value, ctx) => {
    const scopeError = validateAnnouncementScope(value.scope, value.course_id);
    if (scopeError) ctx.addIssue({ code: "custom", message: scopeError, path: ["scope"] });
  });
