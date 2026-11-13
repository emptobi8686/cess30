"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUserSession } from "@/lib/supabase/auth";
import type { ActionResult, NotificationPreferences } from "@/types";

const notificationIdSchema = z.string().uuid();

const preferencesSchema = z.object({
  push_enabled: z.boolean(),
  lecture_reminders_enabled: z.boolean(),
  study_reminders_enabled: z.boolean(),
  announcement_notifications_enabled: z.boolean(),
  lecture_reminder_minutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  quiet_hours_enabled: z.boolean(),
  quiet_hours_start: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  quiet_hours_end: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
}).refine(
  (preferences) =>
    !preferences.quiet_hours_enabled ||
    preferences.quiet_hours_start !== preferences.quiet_hours_end,
  { message: "Quiet hours must have different start and end times." }
);

function revalidateNotificationViews() {
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  revalidatePath("/settings/notifications");
}

export async function updateNotificationPreferences(
  input: Omit<NotificationPreferences, "user_id" | "created_at" | "updated_at">
): Promise<ActionResult> {
  const user = await requireUserSession();
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid notification settings." };
  }

  const admin = createAdminSupabaseClient();
  if (parsed.data.push_enabled) {
    const { count, error: devicesError } = await admin
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (devicesError) {
      console.error("Could not verify push devices.", { code: devicesError.code });
      return { ok: false, error: "We couldn’t verify your registered push devices." };
    }
    if (count === 0) {
      return { ok: false, error: "Enable push on at least one device before turning it on here." };
    }
  }

  const { error } = await admin
    .from("notification_preferences")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
  if (error) {
    console.error("Could not save notification preferences.", { code: error.code });
    return { ok: false, error: "We couldn’t save your notification settings." };
  }

  revalidateNotificationViews();
  return { ok: true, data: undefined };
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  const user = await requireUserSession();
  if (!notificationIdSchema.safeParse(id).success) {
    return { ok: false, error: "Invalid notification." };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Could not mark notification as read.", { code: error.code });
    return { ok: false, error: "We couldn’t update this notification." };
  }
  if (!data) return { ok: false, error: "Notification not found." };
  revalidateNotificationViews();
  return { ok: true, data: undefined };
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const user = await requireUserSession();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) {
    console.error("Could not mark all notifications as read.", { code: error.code });
    return { ok: false, error: "We couldn’t update your notifications." };
  }
  revalidateNotificationViews();
  return { ok: true, data: undefined };
}

export async function deleteNotification(id: string): Promise<ActionResult> {
  const user = await requireUserSession();
  if (!notificationIdSchema.safeParse(id).success) {
    return { ok: false, error: "Invalid notification." };
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Could not delete notification.", { code: error.code });
    return { ok: false, error: "We couldn’t delete this notification." };
  }
  if (!data) return { ok: false, error: "Notification not found." };
  revalidateNotificationViews();
  return { ok: true, data: undefined };
}
