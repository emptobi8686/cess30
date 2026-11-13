"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateNotificationPreferences } from "@/features/notifications/actions";
import type { NotificationPreferences } from "@/types";

function isLectureReminderMinutes(value: number): value is 15 | 30 | 60 {
  return value === 15 || value === 30 || value === 60;
}

export function NotificationPreferencesForm({
  preferences,
}: {
  preferences: NotificationPreferences;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lectureReminders, setLectureReminders] = useState(
    preferences.lecture_reminders_enabled
  );
  const [studyReminders, setStudyReminders] = useState(
    preferences.study_reminders_enabled
  );
  const [announcementNotifications, setAnnouncementNotifications] = useState(
    preferences.announcement_notifications_enabled
  );
  const [quietHours, setQuietHours] = useState(preferences.quiet_hours_enabled);

  function handleSubmit(formData: FormData) {
    setError(null);
    setMessage(null);
    const lectureReminderMinutes = Number(formData.get("lecture_reminder_minutes"));
    if (!isLectureReminderMinutes(lectureReminderMinutes)) {
      setError("Choose a valid lecture reminder interval.");
      return;
    }

    startTransition(async () => {
      const result = await updateNotificationPreferences({
        push_enabled: preferences.push_enabled,
        lecture_reminders_enabled: lectureReminders,
        study_reminders_enabled: studyReminders,
        announcement_notifications_enabled: announcementNotifications,
        lecture_reminder_minutes: lectureReminderMinutes,
        quiet_hours_enabled: quietHours,
        quiet_hours_start: String(formData.get("quiet_hours_start") ?? ""),
        quiet_hours_end: String(formData.get("quiet_hours_end") ?? ""),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Notification preferences saved.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">In-app notification preferences</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Notification categories</legend>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={lectureReminders}
                onChange={(event) => setLectureReminders(event.target.checked)}
                className="size-4 accent-primary"
              />
              Upcoming lecture reminders
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={studyReminders}
                onChange={(event) => setStudyReminders(event.target.checked)}
                className="size-4 accent-primary"
              />
              Personal study session reminders
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={announcementNotifications}
                onChange={(event) => setAnnouncementNotifications(event.target.checked)}
                className="size-4 accent-primary"
              />
              Announcement notifications
            </label>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="lecture_reminder_minutes">Lecture reminder lead time</Label>
            <select
              id="lecture_reminder_minutes"
              name="lecture_reminder_minutes"
              defaultValue={preferences.lecture_reminder_minutes}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm sm:w-56"
            >
              <option value="15">15 minutes before</option>
              <option value="30">30 minutes before</option>
              <option value="60">1 hour before</option>
            </select>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Quiet hours (Africa/Lagos)</legend>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={quietHours}
                onChange={(event) => setQuietHours(event.target.checked)}
                className="size-4 accent-primary"
              />
              Pause browser push during quiet hours
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quiet_hours_start">Start</Label>
                <Input
                  id="quiet_hours_start"
                  name="quiet_hours_start"
                  type="time"
                  defaultValue={preferences.quiet_hours_start.slice(0, 5)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quiet_hours_end">End</Label>
                <Input
                  id="quiet_hours_end"
                  name="quiet_hours_end"
                  type="time"
                  defaultValue={preferences.quiet_hours_end.slice(0, 5)}
                  required
                />
              </div>
            </div>
          </fieldset>

          <p className="text-xs text-muted-foreground">
            Quiet hours delay browser push only. In-app notification history is kept.
          </p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {message && <p role="status" className="text-sm text-primary">{message}</p>}
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Save preferences
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
