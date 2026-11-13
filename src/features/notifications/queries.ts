import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUserSession } from "@/lib/supabase/auth";
import { getCurrentUserRole } from "@/lib/supabase/role";
import type {
  AppNotification,
  NotificationPreferences,
  PushDevice,
} from "@/types";

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const user = await requireUserSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("Notification preferences have not been initialized for this account.");
  }
  return data as NotificationPreferences;
}

export async function getNotificationDevices(): Promise<PushDevice[]> {
  const user = await requireUserSession();
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, device_label, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PushDevice[];
}

export async function getNotifications(
  filter: "all" | "unread" | "read" = "all"
): Promise<AppNotification[]> {
  const user = await requireUserSession();
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (filter === "unread") query = query.eq("is_read", false);
  if (filter === "read") query = query.eq("is_read", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AppNotification[];
}

export async function getNotificationDeliveryStats() {
  const role = await getCurrentUserRole();
  if (role !== "admin") throw new Error("Administrator access required.");

  const admin = createAdminSupabaseClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [total, pending, sent, failed, failedAttempts] = await Promise.all([
    admin.from("notifications").select("id", { count: "exact", head: true }).gte("created_at", since),
    admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .in("push_status", ["pending", "sending"]),
    admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .eq("push_status", "sent"),
    admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since)
      .eq("push_status", "failed"),
    admin
      .from("notifications")
      .select("id, notification_type, created_at, push_error_code, push_attempt_count")
      .gte("created_at", since)
      .eq("push_status", "failed")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const error =
    total.error ??
    pending.error ??
    sent.error ??
    failed.error ??
    failedAttempts.error;
  if (error) throw new Error(error.message);

  return {
    total: total.count ?? 0,
    pending: pending.count ?? 0,
    sent: sent.count ?? 0,
    failed: failed.count ?? 0,
    failedAttempts: failedAttempts.data ?? [],
  };
}
