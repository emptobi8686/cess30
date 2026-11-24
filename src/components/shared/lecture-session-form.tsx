"use client";

import { useOfferingOptions } from "@/components/shared/audience-picker";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLectureSession, updateLectureSession } from "@/features/timetable/actions";
import type { Course, LectureSessionWithCourse } from "@/types";

type Props = {
  courses: Course[];
  session?: LectureSessionWithCourse | null;
  onSuccess?: () => void;
};

/** Errors prefixed with VENUE_CONFLICT: are soft warnings, not hard blocks. */
function parseError(raw: string): { isConflict: boolean; message: string } {
  if (raw.startsWith("VENUE_CONFLICT:")) {
    return { isConflict: true, message: raw.slice("VENUE_CONFLICT:".length) };
  }
  return { isConflict: false, message: raw };
}

export function LectureSessionForm({ courses, session, onSuccess }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [courseId, setCourseId] = useState(session?.course_id ?? "");
  const offerings = useOfferingOptions();
  const [offeringId, setOfferingId] = useState(session?.offering_id ?? "");

  async function handleSubmit(formData: FormData, force = false) {
    setError(null);
    setIsConflict(false);
    setSuccess(null);
    const offering = offerings.find((o) => o.id === offeringId);
    formData.set("offering_id", offering ? offering.id : "");
    formData.set("course_id", offering?.courseId ?? courseId);
    if (force) formData.set("force", "true");

    startTransition(async () => {
      const result = session
        ? await updateLectureSession(session.id, formData)
        : await createLectureSession(formData);

      if (!result.ok) {
        const parsed = parseError(result.error);
        setError(parsed.message);
        setIsConflict(parsed.isConflict);
        return;
      }

      setSuccess(session ? "Session updated." : "Session created.");
      router.refresh();
      onSuccess?.();
    });
  }

  return (
    <form
      ref={formRef}
      action={(formData) => handleSubmit(formData)}
      className="space-y-4"
    >
      {/* Class: the offering decides who sees the lecture (E4) */}
      <div className="space-y-1.5">
        <Label htmlFor="offering_id">Class (this semester)</Label>
        <select
          id="offering_id"
          value={offeringId}
          onChange={(e) => setOfferingId(e.target.value)}
          className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
        >
          <option value="">No offering (course level decides)</option>
          {offerings.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Students enrolled in the class see it, including carry-over students.</p>
      </div>

      {/* Course (only when no class is chosen) */}
      {!offeringId && (
      <div className="space-y-1.5">
        <Label htmlFor="course_id">Course</Label>
        <Select value={courseId} onValueChange={(v: string | null) => setCourseId(v ?? "")}>
          <SelectTrigger className="w-full" id="course_id">
            <SelectValue placeholder="Select a course…" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.course_code} — {c.course_title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      )}

      {/* Date */}
      <div className="space-y-1.5">
        <Label htmlFor="lecture_date">Date</Label>
        <Input
          id="lecture_date"
          name="lecture_date"
          type="date"
          required
          defaultValue={session?.lecture_date ?? ""}
        />
      </div>

      {/* Times */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="start_time">Start time</Label>
          <Input
            id="start_time"
            name="start_time"
            type="time"
            required
            defaultValue={session?.start_time?.slice(0, 5) ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="end_time">End time</Label>
          <Input
            id="end_time"
            name="end_time"
            type="time"
            required
            defaultValue={session?.end_time?.slice(0, 5) ?? ""}
          />
        </div>
      </div>

      {/* Venue */}
      <div className="space-y-1.5">
        <Label htmlFor="venue">Venue</Label>
        <Input
          id="venue"
          name="venue"
          placeholder="e.g. LT1, Engineering Block"
          required
          defaultValue={session?.venue ?? ""}
        />
      </div>

      {/* Lecturer */}
      <div className="space-y-1.5">
        <Label htmlFor="lecturer_name">Lecturer name (optional)</Label>
        <Input
          id="lecturer_name"
          name="lecturer_name"
          placeholder="e.g. Dr. A. Okafor"
          defaultValue={session?.lecturer_name ?? ""}
        />
      </div>

      {/* Conflict warning — shows "Save anyway" button */}
      {error && isConflict && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-50/60 p-3 text-sm dark:bg-amber-900/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-amber-800 dark:text-amber-300">{error}</p>
          </div>
        </div>
      )}

      {/* Hard error */}
      {error && !isConflict && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {success && <p className="text-sm text-primary">{success}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" disabled={isPending || (!courseId && !offeringId)}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {session ? "Saving…" : "Creating…"}
            </>
          ) : session ? (
            "Save changes"
          ) : (
            "Create session"
          )}
        </Button>

        {/* Only shown after a venue conflict warning */}
        {isConflict && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              const form = formRef.current;
              if (!form) return;
              handleSubmit(new FormData(form), true);
            }}
          >
            Save anyway
          </Button>
        )}
      </div>
    </form>
  );
}
