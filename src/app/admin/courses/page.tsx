import { ChevronRight } from "lucide-react";
import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCourses } from "@/features/courses/queries";
import { requireUserSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CourseCreateForm, CourseEditForm, CourseLifecycleButtons } from "./_components/course-forms";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage() {
  const user = await requireUserSession();
  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

  const courses = await getCourses({ includeArchived: true });
  const active = courses.filter((c) => !c.archived_at);
  const totalUnits = active.reduce((sum, c) => sum + c.credit_units, 0);

  return (
    <AdminShell currentLabel="Courses" displayName={profile?.full_name ?? undefined}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin · Courses"
          title="Course catalogue"
          description="Add, edit or archive courses. Courses used by timetable entries cannot be deleted; archive them instead."
        />

        <p className="text-sm text-muted-foreground">
          {active.length} active courses · {totalUnits} units
          {courses.length > active.length ? ` · ${courses.length - active.length} archived` : ""}
        </p>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add a course</CardTitle>
          </CardHeader>
          <CardContent>
            <CourseCreateForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Courses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courses yet.</p>
            ) : (
              courses.map((course) => (
                <details key={course.id} className="disclosure rounded-lg border border-border/60 p-3 transition-colors duration-(--duration-base) open:bg-muted/20">
                  <summary className="flex min-h-8 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ChevronRight className="disclosure-chevron h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="font-mono text-sm font-semibold">{course.course_code}</span>
                    <span className="text-sm">{course.course_title}</span>
                    <span className="text-xs text-muted-foreground">
                      {course.credit_units} units · Level {course.level}
                    </span>
                    {course.archived_at ? <Badge variant="secondary">Archived</Badge> : null}
                  </summary>
                  <div className="mt-3 space-y-3">
                    <CourseEditForm course={course} />
                    <CourseLifecycleButtons course={course} />
                  </div>
                </details>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
