"use client";

import { useState } from "react";
import { Loader2, Plus, Sparkles, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createStudySession, updateStudySession } from "@/features/study-planner/actions";
import type {
  Course,
  StudySessionWithCourse,
  ReminderPreference,
  RecurrencePattern,
} from "@/types";

type Props = {
  courses: Course[];
  sessionToEdit?: StudySessionWithCourse | null;
  defaultDate?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
};

const WEEKDAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

export function StudySessionDialog({
  courses,
  sessionToEdit,
  defaultDate,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSuccess,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const isEditing = Boolean(sessionToEdit);

  // Form states
  const [title, setTitle] = useState(sessionToEdit?.title ?? "");
  const [courseId, setCourseId] = useState(sessionToEdit?.course_id ?? "none");
  const [studyDate, setStudyDate] = useState(
    sessionToEdit?.study_date ?? defaultDate ?? new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(sessionToEdit?.start_time?.slice(0, 5) ?? "16:00");
  const [endTime, setEndTime] = useState(sessionToEdit?.end_time?.slice(0, 5) ?? "18:00");
  const [location, setLocation] = useState(sessionToEdit?.location ?? "");
  const [reminder, setReminder] = useState<ReminderPreference>(
    sessionToEdit?.reminder_preference ?? "15_min"
  );
  const [notes, setNotes] = useState(sessionToEdit?.notes ?? "");

  // Recurrence states
  const [recurrencePattern, setRecurrencePattern] = useState<string>(
    sessionToEdit?.recurrence_pattern ?? "none"
  );
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    sessionToEdit?.recurrence_end_date ?? ""
  );
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [updateSeries, setUpdateSeries] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  function toggleWeekday(day: number) {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setWarnings([]);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("course_id", courseId);
    formData.append("study_date", studyDate);
    formData.append("start_time", startTime);
    formData.append("end_time", endTime);
    if (location) formData.append("location", location);
    formData.append("reminder_preference", reminder);
    if (notes) formData.append("notes", notes);

    if (!isEditing && recurrencePattern !== "none" && recurrenceEndDate) {
      formData.append("recurrence_pattern", recurrencePattern);
      formData.append("recurrence_end_date", recurrenceEndDate);
      selectedWeekdays.forEach((day) =>
        formData.append("selected_weekdays", day.toString())
      );
    }

    try {
      if (isEditing && sessionToEdit) {
        const result = await updateStudySession(
          sessionToEdit.id,
          formData,
          updateSeries && Boolean(sessionToEdit.recurrence_id)
        );
        if (!result.ok) {
          setError(result.error);
          setIsSubmitting(false);
          return;
        }
      } else {
        const result = await createStudySession(formData);
        if (!result.ok) {
          setError(result.error);
          setIsSubmitting(false);
          return;
        }
        if (result.data.warnings && result.data.warnings.length > 0) {
          setWarnings(result.data.warnings);
        }
      }

      setIsSubmitting(false);
      setIsOpen(false);
      onSuccess?.();
    } catch {
      setError("An unexpected error occurred while saving the study session.");
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger render={<Button className="gap-2"><Plus className="size-4" />Plan study session</Button>} />
      )}
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEditing ? "Edit study session" : "Plan personal study session"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your personal revision session and study objectives."
              : "Schedule dedicated revision time around your academic timetable."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-semibold">Schedule Note:</p>
              {warnings.map((w, i) => (
                <p key={i}>• {w}</p>
              ))}
            </div>
          ) : null}

          {/* Goal / Title */}
          <div className="space-y-1.5">
            <Label htmlFor="study-title">Study objective / goal *</Label>
            <Input
              id="study-title"
              placeholder="e.g. Solve tutorial 3 on Mohr's Circle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Course select (Central catalogue) */}
          <div className="space-y-1.5">
            <Label htmlFor="study-course">Associated course</Label>
            <Select value={courseId} onValueChange={(val) => setCourseId(val ?? "none")}>
              <SelectTrigger id="study-course" className="w-full">
                <SelectValue placeholder="Select a course (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">General study (No specific course)</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.course_code} — {c.course_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date, Start time, End time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="study-date">Date *</Label>
              <Input
                id="study-date"
                type="date"
                value={studyDate}
                onChange={(e) => setStudyDate(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="study-start">Start time *</Label>
              <Input
                id="study-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="study-end">End time *</Label>
              <Input
                id="study-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Location & Reminder preference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="study-location">Location (optional)</Label>
              <Input
                id="study-location"
                placeholder="e.g. Main Library 2nd Floor, Home"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="study-reminder">Reminder preference</Label>
              <Select
                value={reminder}
                onValueChange={(val) => setReminder((val as ReminderPreference) ?? "15_min")}
              >
                <SelectTrigger id="study-reminder" className="w-full">
                  <SelectValue placeholder="Choose reminder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No reminder</SelectItem>
                  <SelectItem value="15_min">15 minutes before</SelectItem>
                  <SelectItem value="30_min">30 minutes before</SelectItem>
                  <SelectItem value="1_hour">1 hour before</SelectItem>
                  <SelectItem value="1_day">1 day before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Optional notes */}
          <div className="space-y-1.5">
            <Label htmlFor="study-notes">Notes / preparation checklist</Label>
            <Textarea
              id="study-notes"
              placeholder="e.g. Bring drawing set, calculator, and lecture notes 4-6."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              className="min-h-20"
            />
          </div>

          {/* Recurrence section (Only when creating, or editing recurring series) */}
          {!isEditing ? (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-primary" />
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recurrence Schedule
                </Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="recurrence-pattern" className="text-xs">
                    Repeat cadence
                  </Label>
                  <Select
                    value={recurrencePattern}
                    onValueChange={(val) => setRecurrencePattern(val ?? "none")}
                  >
                    <SelectTrigger id="recurrence-pattern" className="w-full">
                      <SelectValue placeholder="Does not repeat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Does not repeat</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="selected_weekdays">Selected weekdays</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {recurrencePattern !== "none" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="recurrence-end" className="text-xs">
                      End date *
                    </Label>
                    <Input
                      id="recurrence-end"
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      disabled={isSubmitting}
                      required={recurrencePattern !== "none"}
                    />
                  </div>
                ) : null}
              </div>

              {recurrencePattern === "selected_weekdays" ? (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs">Select repeating weekdays:</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((day) => {
                      const selected = selectedWeekdays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleWeekday(day.value)}
                          className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : sessionToEdit?.recurrence_id ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-primary">Recurring Series Detected</p>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateSeries}
                  onChange={(e) => setUpdateSeries(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                Apply changes to all recurring sessions in this series
              </label>
            </div>
          ) : null}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Save changes"
              ) : (
                "Create study session"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

