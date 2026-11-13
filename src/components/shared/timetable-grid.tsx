"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "cn";
import { formatTime, formatDisplayDate, formatShortDay, getDayOfMonth } from "@/lib/dates";
import type { LectureSessionWithCourse } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Single session card
// ─────────────────────────────────────────────────────────────────────────────

function SessionCard({
  session,
  compact = false,
}: {
  session: LectureSessionWithCourse;
  compact?: boolean;
}) {
  const cancelled = session.is_cancelled;
  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        cancelled
          ? "border-border/50 bg-muted/30 opacity-60"
          : "border-border/80 bg-card hover:border-primary/30"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-primary">
              {session.courses.course_code}
            </span>
            {cancelled && (
              <Badge variant="destructive" className="text-[10px]">
                Cancelled
              </Badge>
            )}
          </div>
          <p className={cn("mt-0.5 text-sm font-medium leading-tight", cancelled && "line-through")}>
            {session.courses.course_title}
          </p>
        </div>
      </div>
      {!compact && (
        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          <p>{formatTime(session.start_time)} – {formatTime(session.end_time)}</p>
          <p>{session.venue}</p>
          {session.lecturer_name && <p>{session.lecturer_name}</p>}
        </div>
      )}
      {compact && (
        <p className="mt-1 text-xs text-muted-foreground">
          {formatTime(session.start_time)} · {session.venue}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Agenda view — grouped by date
// ─────────────────────────────────────────────────────────────────────────────

export function TimetableAgendaView({
  sessions,
}: {
  sessions: LectureSessionWithCourse[];
}) {
  const grouped: Record<string, LectureSessionWithCourse[]> = {};
  for (const s of sessions) {
    if (!grouped[s.lecture_date]) grouped[s.lecture_date] = [];
    grouped[s.lecture_date].push(s);
  }
  const sortedDates = Object.keys(grouped).sort();

  if (sortedDates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => (
        <div key={date}>
          <div className="mb-3 flex items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {formatShortDay(date)}
            </p>
            <p className="text-sm font-medium text-foreground">{formatDisplayDate(date)}</p>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[date].map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly grid view — responsive Monday–Sunday grid
// ─────────────────────────────────────────────────────────────────────────────

export function TimetableWeeklyView({
  sessions,
  weekDates,
  todayStr,
}: {
  sessions: LectureSessionWithCourse[];
  weekDates: string[];
  /** Today's date in Africa/Lagos as "YYYY-MM-DD". Passed from server so the
   *  "today" highlight is timezone-correct even on a UTC server. */
  todayStr: string;
}) {
  const byDate: Record<string, LectureSessionWithCourse[]> = {};
  for (const d of weekDates) byDate[d] = [];
  for (const s of sessions) {
    if (byDate[s.lecture_date]) byDate[s.lecture_date].push(s);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {weekDates.map((date) => {
        // Use the server-provided Lagos date for today comparison
        const isToday = date === todayStr;
        return (
          <div key={date}>
            <div
              className={cn(
                "mb-2 rounded-lg px-2 py-1.5 text-center",
                isToday ? "bg-primary/10" : ""
              )}
            >
              <p className={cn(
                "text-xs font-semibold uppercase tracking-widest",
                isToday ? "text-primary" : "text-muted-foreground"
              )}>
                {formatShortDay(date)}
              </p>
              <p className={cn(
                "mt-0.5 text-sm font-medium",
                isToday ? "text-primary" : "text-foreground"
              )}>
                {getDayOfMonth(date)}
              </p>
            </div>
            <div className="space-y-2">
              {byDate[date].length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/50 px-2 py-4 text-center">
                  <p className="text-xs text-muted-foreground/50">—</p>
                </div>
              ) : (
                byDate[date].map((s) => (
                  <SessionCard key={s.id} session={s} compact />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Today's sessions — compact list for dashboard widget
// ─────────────────────────────────────────────────────────────────────────────

export function TodaySessionsList({
  sessions,
}: {
  sessions: LectureSessionWithCourse[];
}) {
  if (sessions.length === 0) return null;

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <div
          key={s.id}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-2.5",
            s.is_cancelled
              ? "border-border/40 bg-muted/20 opacity-60"
              : "border-border/70 bg-card"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
            <span className="font-mono text-[10px] font-bold leading-tight">
              {s.courses.course_code.replace(/[A-Z]/g, "").slice(0, 3)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-sm font-medium", s.is_cancelled && "line-through")}>
              {s.courses.course_title}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatTime(s.start_time)} – {formatTime(s.end_time)} · {s.venue}
            </p>
          </div>
          {s.is_cancelled && (
            <Badge variant="destructive" className="shrink-0 text-[10px]">
              Cancelled
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}

