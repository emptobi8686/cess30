import type { NotificationPreferences } from "@/types";

/** Mirrors the column defaults of public.notification_preferences (013_notifications.sql). */
export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<
  NotificationPreferences,
  "user_id" | "created_at" | "updated_at"
> = {
  push_enabled: false,
  lecture_reminders_enabled: true,
  study_reminders_enabled: true,
  announcement_notifications_enabled: true,
  lecture_reminder_minutes: 30,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
};
