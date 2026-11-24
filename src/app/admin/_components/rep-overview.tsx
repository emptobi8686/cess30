import Link from "next/link";
import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TASKS = [
  { href: "/admin/courses", title: "Courses", text: "Add and edit your level's courses." },
  { href: "/admin/academic/offerings", title: "Course offerings", text: "Offer courses to your level this semester." },
  { href: "/admin/academic/placements", title: "Placements", text: "Confirm classmates' level for the session." },
  { href: "/admin/academic/enrollments", title: "Enrolments", text: "Enrol your level and add carry-over students." },
  { href: "/admin/timetable", title: "Timetable", text: "Schedule, move and cancel lectures." },
  { href: "/admin/announcements", title: "Announcements", text: "Post course announcements to your class." },
  { href: "/admin/quests", title: "Quests", text: "Create level quests and review submissions." },
];

/** Landing page for course representatives (level coordinators, decision 0004). */
export function RepOverview({ levels }: { levels: string[] }) {
  const scope = levels.map((level) => `Level ${level}`).join(", ");
  return (
    <AdminShell currentLabel="Overview">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Course representative"
          title={`Run ${scope}`}
          description="You manage your own level only. Verification and permissions stay with department administrators, and you cannot confirm your own placement or review your own quest work."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TASKS.map((task) => (
            <Link key={task.href} href={task.href} className="block">
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{task.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{task.text}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
