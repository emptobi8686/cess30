"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Plus, RotateCcw, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LectureSessionForm } from "@/components/shared/lecture-session-form";
import { formatDisplayDate, formatTime } from "@/lib/dates";
import {
  cancelLectureSession,
  deleteLectureSession,
  restoreLectureSession,
} from "@/features/timetable/actions";
import type { Course, LectureSessionWithCourse } from "@/types";

function formatDate(d: string): string {
  return formatDisplayDate(d, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Row actions
// ─────────────────────────────────────────────────────────────────────────────

function CancelRestoreButton({ session }: { session: LectureSessionWithCourse }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleAction() {
    setError(null);
    startTransition(async () => {
      const result = session.is_cancelled
        ? await restoreLectureSession(session.id)
        : await cancelLectureSession(session.id);

      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={handleAction}
        aria-label={session.is_cancelled ? "Restore session" : "Cancel session"}
        title={session.is_cancelled ? "Restore session" : "Cancel session"}
      >
        {session.is_cancelled ? (
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function DeleteButton({ session }: { session: LectureSessionWithCourse }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteLectureSession(session.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete session"
          title="Delete session"
          onClick={() => setOpen(true)} />}
      >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete session</DialogTitle>
          <DialogDescription>
            Delete <strong>{session.courses.course_code}</strong> on {formatDate(session.lecture_date)}?
            This action cannot be undone. Consider cancelling instead.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Keep session
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditButton({
  session,
  courses,
}: {
  session: LectureSessionWithCourse;
  courses: Course[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit session"
          title="Edit session"
          onClick={() => setOpen(true)} />}
      >
          <Edit2 className="h-4 w-4 text-muted-foreground" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit session</DialogTitle>
          <DialogDescription>
            Update the details for {session.courses.course_code} on {formatDate(session.lecture_date)}.
          </DialogDescription>
        </DialogHeader>
        <LectureSessionForm
          courses={courses}
          session={session}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main table
// ─────────────────────────────────────────────────────────────────────────────

export function AdminSessionsTable({
  sessions,
  courses,
}: {
  sessions: LectureSessionWithCourse[];
  courses: Course[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex justify-end">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={<Button onClick={() => setCreateOpen(true)} />}
          >
              <Plus className="mr-2 h-4 w-4" />
              Add session
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>New lecture session</DialogTitle>
              <DialogDescription>
                Schedule a new official lecture session for students.
              </DialogDescription>
            </DialogHeader>
            <LectureSessionForm
              courses={courses}
              onSuccess={() => {
                setCreateOpen(false);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {sessions.length === 0 ? (
        <Card className="border-dashed border-border bg-muted/30">
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No lecture sessions yet. Use the button above to schedule the first one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/80 bg-card overflow-hidden">
          <CardHeader className="border-b border-border/60 pb-3 pt-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {sessions.length} session{sessions.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Venue</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className={s.is_cancelled ? "bg-muted/20 opacity-70" : "hover:bg-muted/30"}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {s.courses.course_code}
                      </span>
                      <p className="mt-0.5 max-w-[160px] truncate text-xs text-muted-foreground">
                        {s.courses.course_title}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs">{formatDate(s.lecture_date)}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {formatTime(s.start_time)} – {formatTime(s.end_time)}
                    </td>
                    <td className="px-4 py-3 text-xs">{s.venue}</td>
                    <td className="px-4 py-3">
                      {s.is_cancelled ? (
                        <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <EditButton session={s} courses={courses} />
                        <CancelRestoreButton session={s} />
                        <DeleteButton session={s} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
