import { getAccessContext } from "@/lib/auth/access-server";
import Link from "next/link";
import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAcademicSessions, getOfferings } from "@/features/academic/queries";
import { LEVEL_CODES } from "@/features/academic/validation";
import { getCourses } from "@/features/courses/queries";
import { BulkOfferForm, OfferingStatusForm } from "../_components/offering-forms";

export const dynamic = "force-dynamic";

export default async function OfferingsPage(props: PageProps<"/admin/academic/offerings">) {
  const params = await props.searchParams;
  const sessions = await getAcademicSessions();
  const semesters = sessions.flatMap((session) =>
    session.semesters.map((semester) => ({ ...semester, sessionLabel: session.label }))
  );
  const requested = typeof params.semester === "string" ? params.semester : null;
  const semester =
    semesters.find((s) => s.id === requested) ?? semesters.find((s) => s.is_current) ?? semesters[0] ?? null;
  const access = await getAccessContext();
  const allowed: readonly string[] = access?.isAdmin ? LEVEL_CODES : (access?.staffLevels ?? []);
  const requestedLevel = typeof params.level === "string" && allowed.includes(params.level) ? params.level : null;
  // Course representatives always work inside their own level.
  const level = access?.isAdmin ? requestedLevel : (requestedLevel ?? allowed[0] ?? null);

  const [offerings, courses] = semester
    ? await Promise.all([getOfferings({ semesterId: semester.id, levelCode: level }), getCourses()])
    : [[], []];

  return (
    <AdminShell currentLabel="Academic">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin · Academic"
          title="Course offerings"
          description="An offering is a catalogue course taught to one level in one semester. Shared courses get one offering per level."
        />

        {!semester ? (
          <p className="text-sm text-muted-foreground">
            Create a session and a semester first in{" "}
            <Link href="/admin/academic/sessions" className="text-primary hover:underline">Sessions &amp; semesters</Link>.
          </p>
        ) : (
          <>
            <nav aria-label="Semester" className="flex flex-wrap gap-2 text-xs">
              {semesters.map((s) => (
                <Link
                  key={s.id}
                  href={`/admin/academic/offerings?semester=${s.id}${level ? `&level=${level}` : ""}`}
                  aria-current={s.id === semester.id ? "page" : undefined}
                  className={s.id === semester.id ? "rounded-lg bg-primary px-3 py-1.5 text-primary-foreground" : "rounded-lg border px-3 py-1.5 hover:bg-muted"}
                >
                  {s.sessionLabel} · {s.label}
                </Link>
              ))}
            </nav>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Offer courses for {semester.label}</CardTitle></CardHeader>
              <CardContent>
                <BulkOfferForm semesterId={semester.id} courses={courses} defaultLevel={level ?? "200"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Offerings{level ? ` · Level ${level}` : ""}</CardTitle>
                <nav aria-label="Level filter" className="flex flex-wrap gap-2 pt-2 text-xs">
                  {[null, ...LEVEL_CODES].map((code) => (
                    <Link
                      key={code ?? "all"}
                      href={`/admin/academic/offerings?semester=${semester.id}${code ? `&level=${code}` : ""}`}
                      aria-current={code === level ? "page" : undefined}
                      className={code === level ? "rounded-lg bg-primary px-2.5 py-1 text-primary-foreground" : "rounded-lg border px-2.5 py-1 hover:bg-muted"}
                    >
                      {code ? `Level ${code}` : "All levels"}
                    </Link>
                  ))}
                </nav>
              </CardHeader>
              <CardContent>
                {offerings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No offerings yet for this semester.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th scope="col" className="px-2 py-2 font-medium">Level</th>
                          <th scope="col" className="px-2 py-2 font-medium">Course</th>
                          <th scope="col" className="px-2 py-2 font-medium">Units</th>
                          <th scope="col" className="px-2 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {offerings.map((offering) => (
                          <tr key={offering.id}>
                            <td className="px-2 py-2">{offering.level_code}</td>
                            <td className="px-2 py-2">
                              <span className="font-mono text-xs font-semibold">{offering.courses?.course_code}</span>{" "}
                              {offering.courses?.course_title}
                            </td>
                            <td className="px-2 py-2">{offering.courses?.credit_units}</td>
                            <td className="px-2 py-2">
                              <OfferingStatusForm
                                offeringId={offering.id}
                                status={offering.status}
                                label={`${offering.courses?.course_code ?? "course"} level ${offering.level_code}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminShell>
  );
}
