"use client";

import { useState, useRef } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  BookOpen,
  GraduationCap,
  ListFilter,
  CheckCircle2,
  Clock,
  AlertCircle,
  CalendarDays,
  CalendarRange,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StudySessionCard } from "@/components/shared/study-planner/study-session-card";
import { LectureSessionCard } from "@/components/shared/study-planner/lecture-session-card";
import { StudySessionDialog } from "@/components/shared/study-planner/study-session-dialog";
import { RescheduleDialog } from "@/components/shared/study-planner/reschedule-dialog";
import { DeleteSessionDialog } from "@/components/shared/study-planner/delete-dialog";
import {
  formatDisplayDate,
  addDays,
  getWeekDatesForDate,
  getDayOfMonth,
} from "@/lib/dates";
import type {
  Course,
  StudySessionWithCourse,
  LectureSessionWithCourse,
} from "@/types";
import {
  toggleStudySessionCompleted,
  deleteStudySession,
} from "@/features/study-planner/actions";

type ViewMode = "daily" | "weekly" | "monthly" | "status";
type StatusFilter = "all" | "upcoming" | "completed" | "overdue";

type Notification = {
  id: string;
  type: "success" | "error";
  title: string;
  message?: string;
};

type Props = {
  courses: Course[];
  initialStudySessions: StudySessionWithCourse[];
  initialLectures: LectureSessionWithCourse[];
  todayDate: string;
};

export function StudyPlannerContainer({
  courses,
  initialStudySessions,
  initialLectures,
  todayDate,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [currentWeekOffset, setCurrentWeekOffset] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const notificationIdRef = useRef(0);

  // Dialog management
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<StudySessionWithCourse | null>(null);
  const [reschedulingSession, setReschedulingSession] = useState<StudySessionWithCourse | null>(null);
  const [deletingSession, setDeletingSession] = useState<StudySessionWithCourse | null>(null);

  // Compute week dates for weekly view
  const weekInfo = getWeekDatesForDate(todayDate, currentWeekOffset);

  function addNotification(type: Notification["type"], title: string, message?: string) {
    const id = `n-${notificationIdRef.current += 1}`;
    setNotifications((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }

  function removeNotification(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  // Handlers
  function handlePrevDay() {
    setSelectedDate((prev) => addDays(prev, -1));
  }
  function handleNextDay() {
    setSelectedDate((prev) => addDays(prev, 1));
  }
  function handleToday() {
    setSelectedDate(todayDate);
    setCurrentWeekOffset(0);
  }

  async function handleToggleComplete(session: StudySessionWithCourse) {
    setActionLoading(session.id);
    try {
      const result = await toggleStudySessionCompleted(session.id, !session.completed);
      if (result.ok) {
        addNotification(
          "success",
          session.completed ? "Session marked as planned" : "Session marked as completed"
        );
      } else {
        addNotification("error", "Failed to update session", result.error);
      }
    } catch {
      addNotification("error", "An unexpected error occurred.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(session: StudySessionWithCourse, deleteEntireSeries: boolean) {
    setActionLoading(session.id);
    try {
      const result = await deleteStudySession(session.id, deleteEntireSeries);
      if (result.ok) {
        addNotification("success", "Study session deleted");
      } else {
        addNotification("error", "Failed to delete session", result.error);
      }
    } catch {
      addNotification("error", "An unexpected error occurred.");
    } finally {
      setActionLoading(null);
    }
  }

  // Filter study sessions for daily view
  const dailyStudySessions = initialStudySessions.filter(
    (s) => s.study_date === selectedDate
  );
  const dailyLectures = initialLectures.filter(
    (l) => l.lecture_date === selectedDate
  );

  // Filter study sessions by status
  const filteredStatusSessions = initialStudySessions.filter((s) => {
    if (statusFilter === "completed") return s.completed;
    if (statusFilter === "overdue") return !s.completed && s.study_date < todayDate;
    if (statusFilter === "upcoming") return !s.completed && s.study_date >= todayDate;
    return true;
  });

  // Summary counts
  const totalCompleted = initialStudySessions.filter((s) => s.completed).length;
  const totalOverdue = initialStudySessions.filter(
    (s) => !s.completed && s.study_date < todayDate
  ).length;
  const totalUpcoming = initialStudySessions.filter(
    (s) => !s.completed && s.study_date >= todayDate
  ).length;

  return (
    <div className="space-y-6">
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-lg border p-4 text-sm shadow-lg",
                n.type === "success"
                  ? "border-green-200 bg-green-50 text-green-900"
                  : "border-red-200 bg-red-50 text-red-900"
              )}
            >
              <div className="shrink-0 mt-0.5">
                {n.type === "success" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{n.title}</p>
                {n.message && <p className="text-xs text-opacity-70">{n.message}</p>}
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() => removeNotification(n.id)}
                className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
              />
            </div>
          ))}
        </div>
      )}

      {/* Top action bar: View mode switcher & Plan button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* View Switcher */}
        <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border w-fit">
          <Button
            type="button"
            variant={viewMode === "daily" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("daily")}
            className="text-xs h-8 gap-1.5"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Daily
          </Button>
          <Button
            type="button"
            variant={viewMode === "weekly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("weekly")}
            className="text-xs h-8 gap-1.5"
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Weekly
          </Button>
          <Button
            type="button"
            variant={viewMode === "monthly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("monthly")}
            className="text-xs h-8 gap-1.5"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Monthly
          </Button>
          <Button
            type="button"
            variant={viewMode === "status" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("status")}
            className="text-xs h-8 gap-1.5"
          >
            <ListFilter className="h-3.5 w-3.5" />
            Status lists
          </Button>
        </div>

        {/* Plan Study Session Button */}
        <Button
          type="button"
          onClick={() => setCreateDialogOpen(true)}
          className="gap-2 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Plan study session
        </Button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. DAILY VIEW */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewMode === "daily" && (
        <div className="space-y-4">
          {/* Day Navigation Bar */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-xs"
                onClick={handlePrevDay}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={handleNextDay}
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className="text-xs font-medium"
              >
                Today
              </Button>
            </div>

            <div className="text-right sm:text-center">
              <p className="text-sm font-semibold text-foreground">
                {formatDisplayDate(selectedDate, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              {selectedDate === todayDate ? (
                <span className="text-[11px] font-medium text-primary">
                  Today (Africa/Lagos)
                </span>
              ) : null}
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="text-xs rounded-lg border border-border bg-background px-2.5 py-1.5 text-foreground hidden sm:block"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Personal Study Sessions (Col 1 & 2) */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Personal Study Sessions ({dailyStudySessions.length})
                </h2>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setCreateDialogOpen(true)}
                  className="text-xs text-primary"
                >
                  + Add session
                </Button>
              </div>

              {dailyStudySessions.length === 0 ? (
                <Card className="border-dashed border-border bg-muted/20">
                  <CardContent className="py-8 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      No personal study sessions planned for this day.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateDialogOpen(true)}
                      className="text-xs gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> Plan study block
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {dailyStudySessions.map((session) => (
                    <StudySessionCard
                      key={session.id}
                      session={session}
                      isLoading={actionLoading === session.id}
                      onToggleComplete={() => handleToggleComplete(session)}
                      onEdit={setEditingSession}
                      onReschedule={setReschedulingSession}
                      onDelete={(deleteEntireSeries) =>
                        handleDelete(session, deleteEntireSeries)
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Official Lectures on this date (Col 3) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  Official Lectures ({dailyLectures.length})
                </h2>
              </div>

              {dailyLectures.length === 0 ? (
                <Card className="border-border/60 bg-muted/10">
                  <CardContent className="py-6 text-center text-xs text-muted-foreground">
                    No official lectures on this date.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {dailyLectures.map((lecture) => (
                    <LectureSessionCard key={lecture.id} lecture={lecture} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. WEEKLY VIEW */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewMode === "weekly" && (
        <div className="space-y-4">
          {/* Week Navigation */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentWeekOffset(0)}
                className="text-xs font-medium"
              >
                Current Week
              </Button>
            </div>

            <p className="text-sm font-semibold text-foreground">
              {formatDisplayDate(weekInfo.weekStart, { day: "numeric", month: "short" })} –{" "}
              {formatDisplayDate(weekInfo.weekEnd, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>

          {/* 7-Day Week Columns / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekInfo.dates.map((dateStr) => {
              const dayStudy = initialStudySessions.filter((s) => s.study_date === dateStr);
              const dayLectures = initialLectures.filter((l) => l.lecture_date === dateStr);
              const isToday = dateStr === todayDate;

              return (
                <div
                  key={dateStr}
                  className={`flex flex-col rounded-xl border p-3 min-h-[220px] transition-colors ${
                    isToday
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/80 bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <span className="text-xs font-semibold">
                      {formatDisplayDate(dateStr, { weekday: "short" })}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                        isToday ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"
                      }`}
                    >
                      {getDayOfMonth(dateStr)}
                    </span>
                  </div>

                  <div className="flex-1 space-y-2 pt-2">
                    {/* Official Lectures summary in week column */}
                    {dayLectures.map((lec) => (
                      <div
                        key={lec.id}
                        className="rounded border border-border/80 bg-muted/40 p-1.5 text-[11px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between font-mono font-semibold text-muted-foreground">
                          <span>{lec.courses.course_code}</span>
                          <span>{lec.start_time.slice(0, 5)}</span>
                        </div>
                        <p className="line-clamp-1 text-[10px] text-muted-foreground">
                          {lec.venue}
                        </p>
                      </div>
                    ))}

                    {/* Personal Study Sessions in week column */}
                    {dayStudy.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => {
                          setSelectedDate(dateStr);
                          setViewMode("daily");
                        }}
                        className={`rounded border p-1.5 text-[11px] cursor-pointer transition-colors ${
                          session.completed
                            ? "border-border/60 bg-muted/20 line-through opacity-70"
                            : "border-primary/40 bg-card hover:border-primary text-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between font-medium">
                          <span className="line-clamp-1 font-semibold">{session.title}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                        </span>
                        {session.completed ? (
                          <Check className="h-3 w-3 text-primary mt-0.5" />
                        ) : null}
                      </div>
                    ))}

                    {dayStudy.length === 0 && dayLectures.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/60 text-center pt-6">
                        No events
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. MONTHLY OVERVIEW */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewMode === "monthly" && (
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base">Monthly Study Overview</CardTitle>
            <CardDescription>
              Click any calendar day to inspect and manage its scheduled lectures and study sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {/* Group all known dates */}
              {Array.from(
                new Set([
                  ...initialStudySessions.map((s) => s.study_date),
                  ...initialLectures.map((l) => l.lecture_date),
                  todayDate,
                ])
              )
                .sort()
                .slice(0, 28)
                .map((dateStr) => {
                  const studyCount = initialStudySessions.filter(
                    (s) => s.study_date === dateStr
                  ).length;
                  const lecCount = initialLectures.filter(
                    (l) => l.lecture_date === dateStr
                  ).length;
                  const isToday = dateStr === todayDate;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setViewMode("daily");
                      }}
                      className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors ${
                        isToday
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:bg-muted/50"
                      }`}
                    >
                      <span className="text-xs font-semibold">
                        {formatDisplayDate(dateStr, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {studyCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] h-4 text-primary border-primary/30">
                            {studyCount} study
                          </Badge>
                        ) : null}
                        {lecCount > 0 ? (
                          <Badge variant="secondary" className="text-[10px] h-4 text-muted-foreground">
                            {lecCount} class
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. STATUS LISTS VIEW */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewMode === "status" && (
        <div className="space-y-4">
          {/* Status Filter Badges */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="text-xs"
            >
              All Sessions ({initialStudySessions.length})
            </Button>
            <Button
              type="button"
              variant={statusFilter === "upcoming" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("upcoming")}
              className="text-xs gap-1.5"
            >
              <Clock className="h-3.5 w-3.5" />
              Upcoming ({totalUpcoming})
            </Button>
            <Button
              type="button"
              variant={statusFilter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("completed")}
              className="text-xs gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed ({totalCompleted})
            </Button>
            <Button
              type="button"
              variant={statusFilter === "overdue" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("overdue")}
              className="text-xs gap-1.5 text-destructive"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Missed / Overdue ({totalOverdue})
            </Button>
          </div>

          {filteredStatusSessions.length === 0 ? (
            <Card className="border-dashed border-border bg-muted/20">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No study sessions match the selected filter.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredStatusSessions.map((session) => (
                <div key={session.id} className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground font-mono">
                    {formatDisplayDate(session.study_date, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <StudySessionCard
                    session={session}
                    isLoading={actionLoading === session.id}
                    onToggleComplete={() => handleToggleComplete(session)}
                    onEdit={setEditingSession}
                    onReschedule={setReschedulingSession}
                    onDelete={(deleteEntireSeries) =>
                      handleDelete(session, deleteEntireSeries)
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <StudySessionDialog
        courses={courses}
        defaultDate={selectedDate}
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {editingSession ? (
        <StudySessionDialog
          courses={courses}
          sessionToEdit={editingSession}
          open={Boolean(editingSession)}
          onOpenChange={(open) => !open && setEditingSession(null)}
        />
      ) : null}

      {reschedulingSession ? (
        <RescheduleDialog
          session={reschedulingSession}
          open={Boolean(reschedulingSession)}
          onOpenChange={(open) => !open && setReschedulingSession(null)}
        />
      ) : null}

      {deletingSession ? (
        <DeleteSessionDialog
          session={deletingSession}
          open={Boolean(deletingSession)}
          onOpenChange={(open) => !open && setDeletingSession(null)}
        />
      ) : null}
    </div>
  );
}

function cn(...classes: (string | undefined | null | boolean)[]) {
  return classes.filter(Boolean).join(" ");
}
