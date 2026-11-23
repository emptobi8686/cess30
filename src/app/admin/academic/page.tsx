import { getAccessContext } from "@/lib/auth/access-server";
import Link from "next/link";
import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentLabels, getAcademicSessions } from "@/features/academic/queries";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/admin/academic/sessions", title: "Sessions & semesters", text: "Create academic sessions and choose the current semester." },
  { href: "/admin/academic/offerings", title: "Course offerings", text: "Offer catalogue courses to a level for a semester." },
  { href: "/admin/academic/placements", title: "Placements", text: "Confirm which level each student is in this session." },
  { href: "/admin/academic/enrollments", title: "Enrolments", text: "Enrol a level into its courses and add carry-over students." },
];

export default async function AcademicOverviewPage() {
  const access = await getAccessContext();
  const sections = SECTIONS.filter((section) => access?.isAdmin || section.href !== "/admin/academic/sessions");
  const sessions = await getAcademicSessions();
  const current = currentLabels(sessions);

  return (
    <AdminShell currentLabel="Academic">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin · Academic structure"
          title="Academic structure"
          description="Sessions, semesters, course offerings, student placements and enrolments for every level."
        />
        <p className="text-sm">
          <span className="text-muted-foreground">Current: </span>
          <span className="font-medium">
            {current.session ? `${current.session}${current.semester ? ` · ${current.semester}` : " · no current semester"}` : "No current session yet"}
          </span>
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-primary">
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader className="pb-2"><CardTitle className="text-base">{section.title}</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">{section.text}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
