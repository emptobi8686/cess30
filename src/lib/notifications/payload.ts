import { getSafeActionUrl } from "@/lib/notifications/validation";
import type { AppNotification } from "@/types";

const PUSH_TITLES: Record<AppNotification["notification_type"], string> = {
  lecture_reminder: "Lecture reminder",
  study_reminder: "Study session reminder",
  announcement: "New announcement",
  system: "BLUEPRINT update",
};

export type PushPayload = { notificationId: string; title: string; body: string; actionUrl: string };

export function buildPushPayload(
  notification: Pick<AppNotification, "id" | "notification_type" | "title" | "action_url">
): PushPayload {
  return {
    notificationId: notification.id,
    title: PUSH_TITLES[notification.notification_type] ?? "BLUEPRINT update",
    body: notification.title.slice(0, 120),
    actionUrl: getSafeActionUrl(notification.action_url),
  };
}
