import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { AdminAnnouncementsTable } from "@/components/shared/admin-announcements-table";
import { requireUserSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Announcement, Course } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const user = await requireUserSession();
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const [{ data: announcements, error: announcementsError }, { data: courses }] =
    await Promise.all([
      supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("courses")
        .select("*")
        .order("course_code", { ascending: true }),
    ]);

  return (
    <AdminShell currentLabel="Announcements" displayName={profile?.full_name ?? undefined}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin · Announcements"
          title="Manage announcements"
          description="Create, edit, publish and manage course notices for students."
        />

        {announcementsError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Unable to load announcements: {announcementsError.message}
          </div>
        )}

        <AdminAnnouncementsTable
          announcements={(announcements ?? []) as Announcement[]}
          courses={(courses ?? []) as Course[]}
        />
      </div>
    </AdminShell>
  );
}
