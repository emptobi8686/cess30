import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAcademicSessions } from "@/features/academic/queries";
import { formatDisplayDate } from "@/lib/dates";
import { CreateSemesterForm, CreateSessionForm, MakeCurrentButton } from "../_components/session-forms";

export const dynamic = "force-dynamic";

const shortDate = (value: string) => formatDisplayDate(value, { day: "numeric", month: "short", year: "numeric" });

export default async function AcademicSessionsPage() {
  const sessions = await getAcademicSessions();

  return (
    <AdminShell currentLabel="Academic">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin · Academic"
          title="Sessions & semesters"
          description="Dates are entered here, not hard-coded. Only one session and one semester can be current."
        />

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">New session</CardTitle></CardHeader>
          <CardContent><CreateSessionForm /></CardContent>
        </Card>

        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet. Create the current session to begin.</p>
        ) : (
          sessions.map((session) => (
            <Card key={session.id}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {session.label}
                    {session.is_current ? <Badge>Current</Badge> : null}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {shortDate(session.starts_on)} – {shortDate(session.ends_on)}
                  </p>
                </div>
                {!session.is_current ? <MakeCurrentButton kind="session" id={session.id} label={session.label} /> : null}
              </CardHeader>
              <CardContent className="space-y-4">
                {session.semesters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No semesters yet.</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {session.semesters.map((semester) => (
                      <li key={semester.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                        <span>
                          <span className="font-medium">{semester.label}</span>{" "}
                          <span className="text-muted-foreground">
                            {shortDate(semester.starts_on)} – {shortDate(semester.ends_on)}
                          </span>
                          {semester.is_current ? <Badge className="ml-2">Current</Badge> : null}
                        </span>
                        {session.is_current && !semester.is_current ? (
                          <MakeCurrentButton kind="semester" id={semester.id} label={semester.label} />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                <CreateSemesterForm sessionId={session.id} />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AdminShell>
  );
}
