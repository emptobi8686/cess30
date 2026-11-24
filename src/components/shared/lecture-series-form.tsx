"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOfferingOptions } from "@/components/shared/audience-picker";
import { cancelLectureSeriesAction, createLectureSeriesAction, type SeriesResult } from "@/features/timetable/actions";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

/** "Repeat weekly this semester": one class, chosen weekdays, same time and venue. */
export function LectureSeriesForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const offerings = useOfferingOptions();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SeriesResult | null>(null);

  function submit(formData: FormData) {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const response = await createLectureSeriesAction(formData);
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setResult(response.data);
      router.refresh();
      if (response.data.skipped.length === 0) onDone?.();
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="series-offering">Class (this semester)</Label>
        <select id="series-offering" name="offering_id" required defaultValue="" className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm">
          <option value="" disabled>Choose a class…</option>
          {offerings.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Weekdays</legend>
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((d) => (
            <label key={d.value} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="weekdays" value={d.value} /> {d.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="series-start">Start time</Label>
          <Input id="series-start" name="start_time" type="time" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="series-end">End time</Label>
          <Input id="series-end" name="end_time" type="time" required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="series-venue">Venue</Label>
        <Input id="series-venue" name="venue" required maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="series-lecturer">Lecturer name (optional)</Label>
        <Input id="series-lecturer" name="lecturer_name" maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="series-skip">Skip dates (optional)</Label>
        <Input id="series-skip" name="skip_dates" placeholder="e.g. 2026-12-25, 2027-01-01" />
        <p className="text-xs text-muted-foreground">Public holidays or test weeks, as YYYY-MM-DD separated by commas.</p>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Scheduling…" : "Schedule series"}</Button>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {result ? (
        <div role="status" className="space-y-1 text-sm">
          <p>{result.created} lecture{result.created === 1 ? "" : "s"} scheduled.</p>
          {result.skipped.length > 0 ? (
            <ul className="list-disc pl-5 text-xs text-muted-foreground">
              {result.skipped.map((s) => <li key={s.date}>Skipped {s.date}: {s.reason}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

/** Cancels the remaining (future) lectures of a series. */
export function CancelSeriesButton({ seriesId }: { seriesId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const response = await cancelLectureSeriesAction(seriesId);
            setMessage(response.ok ? `${response.data.cancelled} cancelled` : response.error);
            router.refresh();
          })
        }
      >
        Cancel future in series
      </Button>
      {message ? <span role="status" className="text-xs text-muted-foreground">{message}</span> : null}
    </span>
  );
}
