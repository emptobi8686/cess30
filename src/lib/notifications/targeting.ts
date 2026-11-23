import type { Announcement } from "@/types";

type RecipientProfile = {
  id: string;
  department: string;
  level: string;
};

type CourseAudience = {
  department: string;
  level: string;
};


/**
 * Legacy "level" announcements target the original pilot cohort. P6 replaces this with
 * audience-based targeting (offerings and confirmed placements) and removes the constant.
 */
const LEGACY_LEVEL_SCOPE = "200";

export function getAnnouncementRecipients(
  profiles: RecipientProfile[],
  scope: Announcement["scope"],
  course: CourseAudience | null
) {
  if (scope === "department") {
    return profiles.filter((profile) => profile.department === "Civil Engineering");
  }
  if (scope === "level") {
    return profiles.filter((profile) => profile.level === LEGACY_LEVEL_SCOPE);
  }
  if (scope === "course") {
    if (!course) throw new Error("Course-scoped announcements require a course.");
    return profiles.filter(
      (profile) =>
        profile.department === course.department && profile.level === course.level
    );
  }
  return profiles;
}
