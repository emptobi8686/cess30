import Link from "next/link";
import { BookOpen, CalendarDays, Megaphone, ShieldCheck, Trophy } from "lucide-react";
import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAdminOverviewStats } from "@/features/admin/overview";
import { requireUserSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatTimestamp } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const user = await requireUserSession();
  const supabase = await createServerSupabaseClient();

  // Profile for display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.full_name ?? undefined;
  const stats = await getAdminOverviewStats();
  const show = (value: number | null) => (value === null ? "—" : String(value));

  // Recent lecture sessions (up to 5)
  const { data: recentSessions } = await supabase
    .from("lecture_sessions")
    .select(`*, courses ( course_code, course_title )`)
    .order("created_at", { ascending: false })
    .limit(5);

  // Recent announcements (up to 5)
  const { data: recentAnnouncements } = await supabase
    .from("announcements")
    .select("id, title, is_published, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <AdminShell currentLabel="Overview" displayName={displayName}>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Admin overview"
          title="Academic management"
          description="Manage lecture sessions, announcements, and the course catalogue."
        />

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Courses"
            value={String(stats.courses)}
            description="200-level catalogue"
            tone="default"
          />
          <StatCard
            label="Lecture sessions"
            value={String(stats.sessions)}
            description="Total scheduled"
            tone="default"
          />
          <StatCard
            label="Published notices"
            value={String(stats.published)}
            description="Visible to students"
            tone="success"
          />
          <StatCard
            label="Drafts"
            value={String(stats.drafts)}
            description="Unpublished"
            tone="muted"
          />
          <StatCard
            label="Pending verifications"
            value={String(stats.pendingVerifications)}
            description="Matric reviews awaiting decision"
            tone="default"
          />
          <StatCard
            label="Active quests"
            value={show(stats.activeQuests)}
            description="Visible to students"
            tone="success"
          />
          <StatCard
            label="Pending submissions"
            value={show(stats.pendingSubmissions)}
            description="Quest evidence awaiting review"
            tone="muted"
          />
        </div>

        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base">Notification delivery · last 7 days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.warnings.map((warning) => (
              <p key={warning} role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
                {warning}
              </p>
            ))}
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Notifications", show(stats.notifications?.total ?? null)],
                ["Queued", show(stats.notifications?.pending ?? null)],
                ["Delivered", show(stats.notifications?.sent ?? null)],
                ["Failed", show(stats.notifications?.failed ?? null)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            {stats.notifications && stats.notifications.failedAttempts.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-medium">Recent failed deliveries</h2>
                <ul className="divide-y divide-border/60">
                  {stats.notifications.failedAttempts.map((attempt) => (
                    <li key={attempt.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                      <span>
                        {attempt.notification_type.replaceAll("_", " ")} ·{" "}
                        {attempt.push_error_code ?? "delivery error"} ·{" "}
                        {attempt.push_attempt_count} attempt(s)
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(attempt.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/admin/timetable" className="group block">
            <Card className="border-border/80 bg-card shadow-none transition-colors group-hover:border-primary/40">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Timetable</p>
                  <p className="text-sm text-muted-foreground">Manage lecture sessions</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/announcements" className="group block">
            <Card className="border-border/80 bg-card shadow-none transition-colors group-hover:border-primary/40">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Announcements</p>
                  <p className="text-sm text-muted-foreground">Create and publish notices</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/verifications" className="group block">
            <Card className="border-border/80 bg-card shadow-none transition-colors group-hover:border-primary/40">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Verifications</p>
                  <p className="text-sm text-muted-foreground">Review student matriculation submissions</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/quests" className="group block">
            <Card className="border-border/80 bg-card shadow-none transition-colors group-hover:border-primary/40">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Quests</p>
                  <p className="text-sm text-muted-foreground">Manage academic quests and submissions</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/courses" className="group block">
            <Card className="border-border/80 bg-card shadow-none transition-colors group-hover:border-primary/40">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Courses</p>
                  <p className="text-sm text-muted-foreground">View course catalogue</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent sessions */}
          <Card className="border-border/80 bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent sessions</CardTitle>
                <Link href="/admin/timetable" className="text-xs text-primary hover:underline">
                  Manage →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {!recentSessions || recentSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions created yet.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {recentSessions.map((s) => {
                    const course = s.courses as { course_code: string; course_title: string } | null;
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div>
                          <span className="font-mono text-xs font-semibold text-primary">
                            {course?.course_code}
                          </span>
                          <p className="text-sm">{s.lecture_date} · {s.start_time?.slice(0, 5)}</p>
                        </div>
                        {s.is_cancelled && (
                          <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent announcements */}
          <Card className="border-border/80 bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent announcements</CardTitle>
                <Link href="/admin/announcements" className="text-xs text-primary hover:underline">
                  Manage →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {!recentAnnouncements || recentAnnouncements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No announcements created yet.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {recentAnnouncements.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                      <p className="line-clamp-1 text-sm">{a.title}</p>
                      <Badge variant={a.is_published ? "default" : "outline"} className="shrink-0 text-[10px]">
                        {a.is_published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
