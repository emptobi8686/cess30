import Link from "next/link";
import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAcademicSessions, getOfferingEnrollments, getOfferings, searchStudents } from "@/features/academic/queries";
import { DropEnrollmentForm, EnrollLevelForm, EnrollStudentForm } from "../_components/enrollment-forms";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { core: "Core", carryover: "Carry-over", elective: "Elective", audit: "Audit" };

export default async function EnrollmentsPage(props: PageProps<"/admin/academic/enrollments">) {
  const params = await props.searchParams;
  const sessions = await getAcademicSessions();
  const semester = sessions.flatMap((s) => s.semesters.map((sem) => ({ ...sem, sessionLabel: s.label }))).find((s) => s.is_current) ?? null;
  const offerings = semester ? await getOfferings({ semesterId: semester.id }) : [];
  const offeringId = typeof params.offering === "string" ? params.offering : null;
  const offering = offerings.find((o) => o.id === offeringId) ?? null;
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const [enrollments, results] = offering
    ? await Promise.all([getOfferingEnrollments(offering.id), q ? searchStudents(q) : Promise.resolve([])])
    : [[], []];
  const enrolledIds = new Set(enrollments.map((e) => e.student_id));
  const levels = [...new Set(offerings.map((o) => o.level_code))];

  return (
    <AdminShell currentLabel="Academic">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin · Academic"
          title="Enrolments"
          description={semester ? `${semester.sessionLabel} · ${semester.label}. Enrol confirmed students by level, then add carry-over students to individual offerings.` : "No current semester."}
        />

        {!semester ? (
          <p className="text-sm text-muted-foreground">
            Make a semester current first in{" "}
            <Link href="/admin/academic/sessions" className="text-primary hover:underline">Sessions &amp; semesters</Link>.
          </p>
        ) : (
          <>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Enrol by level</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {levels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No offerings this semester yet. <Link href="/admin/academic/offerings" className="text-primary hover:underline">Create offerings</Link>.
                  </p>
                ) : (
                  levels.map((level) => <EnrollLevelForm key={level} semesterId={semester.id} levelCode={level} />)
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3"><CardTitle className="text-base">Offerings</CardTitle></CardHeader>
                <CardContent>
                  <nav aria-label="Offerings" className="space-y-1 text-sm">
                    {offerings.map((o) => (
                      <Link
                        key={o.id}
                        href={`/admin/academic/enrollments?offering=${o.id}`}
                        aria-current={o.id === offering?.id ? "page" : undefined}
                        className={o.id === offering?.id ? "block rounded-lg bg-primary/10 px-2 py-1.5 font-medium text-primary" : "block rounded-lg px-2 py-1.5 hover:bg-muted"}
                      >
                        {o.courses?.course_code ?? "Course"} · Level {o.level_code}
                      </Link>
                    ))}
                  </nav>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {offering ? `${offering.courses?.course_code ?? "Course"} · Level ${offering.level_code}` : "Choose an offering"}
                  </CardTitle>
                </CardHeader>
                {offering ? (
                  <CardContent className="space-y-6">
                    <section aria-label="Enrolled students" className="space-y-2">
                      <p className="text-sm font-medium" data-testid="enrolment-count">{enrollments.length} enrolled</p>
                      <ul className="divide-y divide-border/60 text-sm">
                        {enrollments.map((e) => {
                          const name = e.profiles?.full_name ?? "Student";
                          return (
                            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                              <span>
                                {name} <span className="font-mono text-xs text-muted-foreground">{e.profiles?.matric_number ?? ""}</span>
                                <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">{TYPE_LABEL[e.enrolment_type] ?? e.enrolment_type}</span>
                              </span>
                              <DropEnrollmentForm enrollmentId={e.id} label={name} />
                            </li>
                          );
                        })}
                      </ul>
                    </section>

                    <section aria-label="Add a student" className="space-y-3">
                      <form className="flex flex-wrap items-end gap-2" action="/admin/academic/enrollments">
                        <input type="hidden" name="offering" value={offering.id} />
                        <div className="space-y-1">
                          <label htmlFor="student-search" className="text-sm font-medium">Find a student (name or matric)</label>
                          <Input id="student-search" name="q" defaultValue={q} maxLength={80} className="max-w-xs" />
                        </div>
                        <Button type="submit" variant="outline">Search</Button>
                      </form>
                      {q && results.length === 0 ? <p className="text-sm text-muted-foreground">No verified students match.</p> : null}
                      <ul className="divide-y divide-border/60 text-sm">
                        {results.map((s) => (
                          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <span>
                              {s.full_name} <span className="font-mono text-xs text-muted-foreground">{s.matric_number ?? ""}</span>
                              {s.level ? <span className="ml-2 text-xs text-muted-foreground">{s.level}</span> : null}
                            </span>
                            {enrolledIds.has(s.id) ? (
                              <span className="text-xs text-muted-foreground">Already enrolled</span>
                            ) : (
                              <EnrollStudentForm studentId={s.id} offeringId={offering.id} label={s.full_name} />
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  </CardContent>
                ) : (
                  <CardContent><p className="text-sm text-muted-foreground">Select an offering to see and manage its students.</p></CardContent>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
