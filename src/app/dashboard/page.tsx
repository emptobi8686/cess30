import Link from "next/link";
import {
  CalendarDays,
  Megaphone,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  MapPin,
} from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TodaySessionsList } from "@/components/shared/timetable-grid";
import { VerificationBanner } from "@/components/shared/verification-banner";
import { XpBeam } from "@/components/shared/xp-beam";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireUserSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  formatDisplayDate,
  formatTime,
  formatTimestamp,
  getWeekDates,
} from "@/lib/dates";
import {
  getNextUpcomingSession,
  getTodaySessions,
} from "@/features/timetable/queries";
import { getRecentAnnouncements } from "@/features/announcements/queries";
import {
  getTodayStudySessions,
  getNextUpcomingStudySession,
  getWeeklyStudySummary,
  getRecentlyCompletedStudySessions,
} from "@/features/study-planner/queries";
import type { VerificationStatus } from "@/types";
import { getAcademicContext } from "@/features/academic/context";
import { academicHeadline } from "@/features/academic/context-core";
import { getActiveQuests, getUserXpSummary } from "@/features/quests/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const { locked } = await props.searchParams;
  const user = await requireUserSession();
  const supabase = await createServerSupabaseClient();

  const weekInfo = getWeekDates();

  // Fetch student profile including matriculation and verification status
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, nickname, matric_number, avatar_url, verification_status, verification_rejection_reason")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = (profile?.nickname || profile?.full_name) ?? undefined;
  const avatarUrl = profile?.avatar_url ?? null;
  const matricNumber = profile?.matric_number ?? null;
  const verificationStatus = (profile?.verification_status as VerificationStatus) ?? "pending";

  // Fetch all timetable and study planner metrics in parallel
  const [
    todaySessions,
    nextSession,
    recentAnnouncements,
    todayStudySessions,
    nextStudySession,
    weeklyStudySummary,
    recentlyCompletedStudy,
  ] = await Promise.all([
    getTodaySessions(),
    getNextUpcomingSession(),
    getRecentAnnouncements(3),
    getTodayStudySessions(user.id),
    getNextUpcomingStudySession(user.id),
    getWeeklyStudySummary(user.id, weekInfo.weekStart, weekInfo.weekEnd),
    getRecentlyCompletedStudySessions(user.id, 3),
  ]);
  const [academic, myQuests, myXp] = await Promise.all([
    getAcademicContext(),
    verificationStatus === "verified" ? getActiveQuests().then((q) => q.slice(0, 3)) : Promise.resolve([]),
    verificationStatus === "verified" ? getUserXpSummary(user.id).catch(() => null) : Promise.resolve(null),
  ]);
  const headline = academicHeadline(academic);

  const firstName = displayName?.split(" ")[0];

  return (
    <DashboardShell currentLabel="Overview" displayName={displayName} avatarUrl={avatarUrl} academic={academic}>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Student overview"
          title={firstName ? `Welcome back, ${firstName}.` : "Your workspace is ready."}
          description={headline ?? "Your Civil Engineering academic dashboard."}
        />

        {locked === "verification" && verificationStatus !== "verified" ? (
          <p
            role="status"
            data-testid="locked-notice"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
          >
            That page opens once an admin verifies your account. Until then you won&apos;t see
            announcements, quests or the leaderboard. Check the status below.
          </p>
        ) : null}

        {/* Verification & Profile Status Banner */}
        <VerificationBanner
          matricNumber={matricNumber}
          verificationStatus={verificationStatus}
          rejectionReason={profile?.verification_rejection_reason ?? null}
          placement={{ sessionLabel: academic.sessionLabel, status: academic.placementStatus }}
        />

        {/* ───────────────────────────────────────────────────────────── */}
        {/* Two-Column Grid: Official Lectures vs Personal Study Plan */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Official Lectures */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
                Today&apos;s lectures
              </h2>
              <Link href="/timetable" className="inline-flex min-h-8 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
                Full timetable
              </Link>
            </div>

            {todaySessions.length === 0 ? (
              <Card className="border-dashed border-border bg-muted/20">
                <CardContent className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">No official lectures scheduled today.</p>
                </CardContent>
              </Card>
            ) : (
              <TodaySessionsList sessions={todaySessions} />
            )}

            {/* Next Upcoming Lecture */}
            {nextSession && !todaySessions.some((s) => s.id === nextSession.id) && (
              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Next scheduled lecture
                </h3>
                <Card className="border-border/80 bg-card">
                  <CardContent className="flex items-center justify-between gap-3 py-3.5">
                    <div>
                      <p className="tabular-nums text-xs font-bold text-foreground">
                        {nextSession.courses.course_code}
                      </p>
                      <p className="text-sm font-medium">{nextSession.courses.course_title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDisplayDate(nextSession.lecture_date, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        · {formatTime(nextSession.start_time)} · {nextSession.venue}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      Official
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Column 2: Personal Study Planner */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <BookOpen className="h-4 w-4 text-primary" aria-hidden />
                Today&apos;s study plan
              </h2>
              <Link href="/study-planner" className="inline-flex min-h-8 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
                Open planner
              </Link>
            </div>

            {todayStudySessions.length === 0 ? (
              <Card className="border-dashed border-primary/20 bg-primary/5">
                <CardContent className="py-6 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    No study sessions scheduled for today.
                  </p>
                  <Link
                    href="/study-planner"
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                  >
                    + Schedule today&apos;s study session
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {todayStudySessions.map((study) => (
                  <Card
                    key={study.id}
                    className={`border ${
                      study.completed
                        ? "border-border/60 bg-muted/20 opacity-75"
                        : "border-primary/30 bg-card"
                    }`}
                  >
                    <CardContent className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="default" className="text-[10px] h-4 bg-primary/15 text-primary border-primary/20">
                            Study
                          </Badge>
                          {study.courses ? (
                            <span className="tabular-nums text-xs font-semibold text-primary">
                              {study.courses.course_code}
                            </span>
                          ) : null}
                          <span className="tabular-nums text-xs text-muted-foreground">
                            {formatTime(study.start_time)} – {formatTime(study.end_time)}
                          </span>
                        </div>
                        <p
                          className={`text-sm font-medium mt-1 truncate ${
                            study.completed ? "line-through text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {study.title}
                        </p>
                        {study.location ? (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            <MapPin className="mr-1 inline h-3 w-3" aria-hidden />
                            <span className="sr-only">Location: </span>
                            {study.location}
                          </p>
                        ) : null}
                      </div>

                      {study.completed ? (
                        <Badge variant="outline" className="shrink-0 text-xs text-primary border-primary/30">
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          Planned
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Next Upcoming Study Session (if not today) */}
            {nextStudySession && !todayStudySessions.some((s) => s.id === nextStudySession.id) && (
              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Next personal study session
                </h3>
                <Card className="border-primary/20 bg-card">
                  <CardContent className="flex items-center justify-between gap-3 py-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        {nextStudySession.courses ? (
                          <span className="tabular-nums text-xs font-bold text-primary">
                            {nextStudySession.courses.course_code}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">General Study</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDisplayDate(nextStudySession.study_date, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          · {formatTime(nextStudySession.start_time)}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-0.5">{nextStudySession.title}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs text-primary border-primary/40">
                      Personal
                    </Badge>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recently Completed Study Sessions */}
            {recentlyCompletedStudy.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Recently completed
                </h3>
                <div className="space-y-1.5">
                  {recentlyCompletedStudy.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-border/60 bg-muted/20 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate line-through text-muted-foreground">
                          {c.title}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                        {formatDisplayDate(c.study_date, { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {verificationStatus === "verified" ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">My quests</CardTitle>
                <CardDescription>Open quests for your level and courses.</CardDescription>
              </CardHeader>
              <CardContent>
                {myQuests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open quests right now.</p>
                ) : (
                  <ul className="divide-y divide-border/60 text-sm">
                    {myQuests.map((quest) => (
                      <li key={quest.id} className="flex items-center justify-between gap-3 py-2">
                        <Link href="/quests" className="-my-1 block min-w-0 flex-1 truncate py-1 font-medium underline-offset-4 hover:underline pointer-coarse:py-2">{quest.title}</Link>
                        <Badge variant="secondary">{quest.xp_reward} XP</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">My rank</CardTitle>
                <CardDescription>Earn XP from approved quests to climb.</CardDescription>
              </CardHeader>
              <CardContent>
                <XpBeam totalXp={myXp?.total_xp ?? 0} questsCompleted={myXp?.quests_completed ?? 0} />
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* Study Planner Integration: Weekly Progress Summary */}
        {/* ───────────────────────────────────────────────────────────── */}
        <section aria-labelledby="study-summary-heading">
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
                  <CardTitle id="study-summary-heading" className="text-base font-semibold">
                    This week&apos;s study
                  </CardTitle>
                </div>
                <CardDescription className="text-xs">
                  {formatDisplayDate(weekInfo.weekStart, { day: "numeric", month: "short" })} –{" "}
                  {formatDisplayDate(weekInfo.weekEnd, { day: "numeric", month: "short" })}
                </CardDescription>
              </div>
              <Link
                href="/study-planner"
                className="inline-flex min-h-8 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Study planner
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Completion rate</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {weeklyStudySummary.completionRate}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Sessions completed</p>
                  <p className="text-2xl font-bold tracking-tight text-primary">
                    {weeklyStudySummary.completedSessions}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / {weeklyStudySummary.totalSessions} planned
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Upcoming this week</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {weeklyStudySummary.pendingSessions}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Overdue sessions</p>
                  <p
                    className={`text-2xl font-bold tracking-tight ${
                      weeklyStudySummary.overdueSessions > 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {weeklyStudySummary.overdueSessions}
                  </p>
                </div>
              </div>

              {/* Visual Progress Bar */}
              <div className="mt-4 h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full origin-left animate-[bar-grow_600ms_var(--ease-out)_200ms_backwards] bg-primary"
                  style={{ width: `${weeklyStudySummary.completionRate}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* Recent Announcements */}
        {/* ───────────────────────────────────────────────────────────── */}
        <section aria-labelledby="announcements-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="announcements-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Megaphone className="h-4 w-4 text-primary" aria-hidden />
              Recent announcements
            </h2>
            <Link href="/announcements" className="inline-flex min-h-8 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
              All announcements
            </Link>
          </div>

          {recentAnnouncements.length === 0 ? (
            <EmptyState
              title="No announcements yet"
              description="Published course announcements will appear here."
            />
          ) : (
            <Card className="border-border/80 bg-card py-0">
              <ul className="divide-y divide-border/60">
                {recentAnnouncements.map((a) => (
                  <li key={a.id}>
                    <Link
                      href="/announcements"
                      className="block px-4 py-3 transition-colors duration-(--duration-fast) hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-medium text-foreground">{a.title}</p>
                        <time className="shrink-0 text-xs text-muted-foreground" dateTime={a.published_at}>
                          {formatTimestamp(a.published_at, { day: "numeric", month: "short" })}
                        </time>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{a.content}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
