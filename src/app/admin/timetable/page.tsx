import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { AdminSessionsTable } from "@/components/shared/admin-sessions-table";
import { requireUserSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { LectureSessionWithCourse, Course } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminTimetablePage() {
  const user = await requireUserSession();
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const [{ data: sessions, error: sessionsError }, { data: courses }] = await Promise.all([
    supabase
      .from("lecture_sessions")
      .select(`*, courses ( course_code, course_title )`)
      .order("lecture_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("courses")
      .select("*")
      .is("archived_at", null)
      .order("course_code", { ascending: true }),
  ]);

  return (
    <AdminShell currentLabel="Timetable" displayName={profile?.full_name ?? undefined}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin · Timetable"
          title="Lecture sessions"
          description="Create, edit, cancel and manage official lecture sessions."
        />

        {sessionsError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Unable to load sessions: {sessionsError.message}
          </div>
        )}

        <AdminSessionsTable
          sessions={(sessions ?? []) as LectureSessionWithCourse[]}
          courses={(courses ?? []) as Course[]}
        />
      </div>
    </AdminShell>
  );
}
