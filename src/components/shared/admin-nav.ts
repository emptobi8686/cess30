/** Admin navigation entries; adminOnly items are hidden from course representatives. */
export const ADMIN_NAV = [
  { label: "Overview", href: "/admin", adminOnly: false },
  { label: "Timetable", href: "/admin/timetable", adminOnly: false },
  { label: "Announcements", href: "/admin/announcements", adminOnly: false },
  { label: "Verifications", href: "/admin/verifications", adminOnly: true },
  { label: "Quests", href: "/admin/quests", adminOnly: false },
  { label: "Courses", href: "/admin/courses", adminOnly: false },
  { label: "Academic", href: "/admin/academic", adminOnly: false },
  { label: "Library", href: "/admin/library", adminOnly: false },
  { label: "Tutorials", href: "/admin/tutorials", adminOnly: false },
  { label: "Staff", href: "/admin/staff", adminOnly: true },
] as const;

export type AdminNavLabel = (typeof ADMIN_NAV)[number]["label"];

export function visibleAdminNav(isAdmin: boolean) {
  return ADMIN_NAV.filter((item) => isAdmin || !item.adminOnly);
}
