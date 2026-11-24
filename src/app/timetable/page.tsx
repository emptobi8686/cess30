import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TimetableAgendaView, TimetableWeeklyView } from "@/components/shared/timetable-grid";
import { Button } from "@/components/ui/button";
import { requireUserSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLagosDateString, getWeekDates, formatWeekLabel } from "@/lib/dates";
import type { LectureSessionWithCourse } from "@/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TimetablePage(props: PageProps<"/timetable">) {
  await requireUserSession();

  const searchParams = await (props as { searchParams: SearchParams }).searchParams;
  const rawView = typeof searchParams?.view === "string" ? searchParams.view : "agenda";
  const view = rawView === "week" ? "week" : "agenda";
  const parsedWeekOffset =
    parseInt(typeof searchParams?.week === "string" ? searchParams.week : "0", 10) || 0;
  // Keep navigation bounded so malformed/hostile query strings cannot request
  // absurd date ranges.
  const weekOffset = Math.max(-520, Math.min(520, parsedWeekOffset));

  // Lagos-aware date calculations
  const todayStr = getLagosDateString();
  const { weekStart, weekEnd, dates } = getWeekDates(new Date(), weekOffset);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("lecture_sessions")
    .select(`*, courses ( course_code, course_title )`)
    .gte("lecture_date", weekStart)
    .lte("lecture_date", weekEnd)
    .order("lecture_date", { ascending: true })
    .order("start_time", { ascending: true });

  const sessions: LectureSessionWithCourse[] = error
    ? []
    : ((data ?? []) as LectureSessionWithCourse[]);

  const weekLabel = formatWeekLabel(weekStart, weekEnd);
  const prevWeek = weekOffset - 1;
  const nextWeek = weekOffset + 1;

  return (
    <DashboardShell currentLabel="Timetable">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Academic timetable"
          title="Official lecture schedule"
          description="The department's official lecture timetable. Contact the course representative to report errors."
        />

        {/* Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" aria-label="Previous week" nativeButton={false} render={<Link href={`/timetable?view=${view}&week=${prevWeek}`} />}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            <span className="min-w-[180px] text-center text-sm font-medium text-foreground">
              {weekLabel}
            </span>
            <Button variant="outline" size="icon-sm" aria-label="Next week" nativeButton={false} render={<Link href={`/timetable?view=${view}&week=${nextWeek}`} />}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            {weekOffset !== 0 && (
              <Button variant="ghost" size="sm" className="text-xs" nativeButton={false} render={<Link href={`/timetable?view=${view}&week=0`} />}>
                  This week
                </Button>
            )}
          </div>

          <div className="flex rounded-lg border border-border p-0.5">
            <Link href={`/timetable?view=agenda&week=${weekOffset}`}>
              <button
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === "agenda"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Agenda
              </button>
            </Link>
            <Link href={`/timetable?view=week&week=${weekOffset}`}>
              <button
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === "week"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Weekly
              </button>
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Unable to load timetable. Please try again.
          </div>
        )}

        {!error && sessions.length === 0 ? (
          <EmptyState
            title="No sessions this week"
            description="No lectures have been scheduled for this week yet. Check back later or navigate to another week."
          />
        ) : view === "week" ? (
          <TimetableWeeklyView
            sessions={sessions}
            weekDates={dates}
            todayStr={todayStr}
          />
        ) : (
          <TimetableAgendaView sessions={sessions} />
        )}
      </div>
    </DashboardShell>
  );
}
