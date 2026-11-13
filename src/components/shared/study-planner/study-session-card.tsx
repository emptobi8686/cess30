"use client";

import { useState } from "react";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  MoreVertical,
  Repeat,
  Bell,
  Edit2,
  CalendarClock,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleStudySessionCompleted } from "@/features/study-planner/actions";
import { formatTime } from "@/lib/dates";
import type { StudySessionWithCourse } from "@/types";

type Props = {
  session: StudySessionWithCourse;
  onEdit: (session: StudySessionWithCourse) => void;
  onReschedule: (session: StudySessionWithCourse) => void;
  onDelete: (session: StudySessionWithCourse) => void;
};

const REMINDER_LABELS: Record<string, string> = {
  none: "No reminder",
  "15_min": "15m reminder",
  "30_min": "30m reminder",
  "1_hour": "1h reminder",
  "1_day": "1d reminder",
};

export function StudySessionCard({ session, onEdit, onReschedule, onDelete }: Props) {
  const [isCompleted, setIsCompleted] = useState(session.completed);
  const [isToggling, setIsToggling] = useState(false);

  async function handleToggleCompleted() {
    if (isToggling) return;
    const nextState = !isCompleted;
    setIsCompleted(nextState);
    setIsToggling(true);

    try {
      const res = await toggleStudySessionCompleted(session.id, nextState);
      if (!res.ok) {
        setIsCompleted(!nextState); // Rollback
      }
    } catch {
      setIsCompleted(!nextState); // Rollback
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <div
      className={`group relative rounded-xl border p-4 transition-all ${
        isCompleted
          ? "border-border/60 bg-muted/20 opacity-80"
          : "border-primary/30 bg-card shadow-xs hover:border-primary/60 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Toggle completion & Content */}
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={handleToggleCompleted}
            disabled={isToggling}
            aria-label={isCompleted ? "Mark incomplete" : "Mark completed"}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
          >
            {isCompleted ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            )}
          </button>

          <div className="space-y-1.5 min-w-0">
            {/* Header badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="default" className="text-[11px] h-5 bg-primary/15 text-primary border-primary/20 hover:bg-primary/20">
                <BookOpen className="h-3 w-3 mr-1" />
                Personal Study
              </Badge>

              {session.courses ? (
                <Badge variant="outline" className="text-[11px] h-5 font-mono font-medium">
                  {session.courses.course_code}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] h-5 text-muted-foreground">
                  General
                </Badge>
              )}

              {session.recurrence_id ? (
                <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                  <Repeat className="h-2.5 w-2.5" />
                  Recurring
                </Badge>
              ) : null}

              {isCompleted ? (
                <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary">
                  Completed
                </Badge>
              ) : null}
            </div>

            {/* Title / Goal */}
            <h3
              className={`text-sm font-semibold text-foreground leading-snug break-words ${
                isCompleted ? "line-through text-muted-foreground" : ""
              }`}
            >
              {session.title}
            </h3>

            {/* Course description if present */}
            {session.courses?.course_title ? (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {session.courses.course_title}
              </p>
            ) : null}

            {/* Time & Venue meta */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1">
              <span className="inline-flex items-center gap-1 font-mono">
                <Clock className="h-3.5 w-3.5 text-primary/70" />
                {formatTime(session.start_time)} – {formatTime(session.end_time)}
              </span>

              {session.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {session.location}
                </span>
              ) : null}

              {session.reminder_preference && session.reminder_preference !== "none" ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
                  <Bell className="h-3 w-3" />
                  {REMINDER_LABELS[session.reminder_preference]}
                </span>
              ) : null}
            </div>

            {/* Notes */}
            {session.notes ? (
              <p className="text-xs text-muted-foreground/90 bg-muted/30 rounded-md p-2 mt-2 whitespace-pre-wrap">
                {session.notes}
              </p>
            ) : null}
          </div>
        </div>

        {/* Dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Study session actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onEdit(session)}>
              <Edit2 className="mr-2 h-3.5 w-3.5" />
              Edit session
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReschedule(session)}>
              <CalendarClock className="mr-2 h-3.5 w-3.5" />
              Reschedule
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(session)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

