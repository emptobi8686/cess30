import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Course } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const user = await requireUserSession();
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: courses, error } = await supabase
    .from("courses")
    .select("*")
    .order("course_code", { ascending: true });

  const courseList: Course[] = (courses ?? []) as Course[];
  const totalUnits = courseList.reduce((sum, c) => sum + c.credit_units, 0);

  return (
    <AdminShell currentLabel="Courses" displayName={profile?.full_name ?? undefined}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin · Courses"
          title="Course catalogue"
          description="The official 200-level Civil Engineering course catalogue. Courses referenced by existing sessions are protected from deletion."
        />

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Unable to load courses: {error.message}
          </div>
        )}

        {!error && (
          <>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{courseList.length} courses</span>
              <span>·</span>
              <span>{totalUnits} total units</span>
            </div>

            <Card className="border-border/80 bg-card overflow-hidden">
              <CardHeader className="border-b border-border/60 pb-3 pt-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  200-Level Civil Engineering
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Units</th>
                      <th className="px-4 py-3">Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {courseList.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-primary">
                            {c.course_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{c.course_title}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-[10px]">
                            {c.credit_units} units
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {c.level} Level
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CardContent className="border-t border-border/60 pb-3 pt-3">
                <p className="text-right text-xs font-medium text-muted-foreground">
                  Total: {totalUnits} units
                </p>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Course management (add, edit, remove) is performed via the Supabase dashboard or a future admin tool to prevent accidental deletion of courses referenced by existing timetable entries.
            </p>
          </>
        )}
      </div>
    </AdminShell>
  );
}
