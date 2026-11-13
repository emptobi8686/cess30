import "server-only";

import * as webPush from "web-push";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getSafeActionUrl, isSafePushEndpoint } from "@/lib/notifications/validation";
import type { AppNotification } from "@/types";

function configureVapid() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Web Push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT."
    );
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
}

function getStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  return null;
}

function updatePushStatus(
  notificationId: string,
  status: "sent" | "failed" | "disabled",
  errorCode: string | null
) {
  const admin = createAdminSupabaseClient();
  return admin
    .from("notifications")
    .update({
      push_status: status,
      push_sent_at: status === "sent" ? new Date().toISOString() : null,
      push_error_code: errorCode,
    })
    .eq("id", notificationId);
}

async function sourceIsStillEligible(notification: AppNotification) {
  const admin = createAdminSupabaseClient();
  if (!notification.source_id) return notification.source_type === "system";

  if (notification.source_type === "lecture") {
    const { data, error } = await admin
      .from("lecture_sessions")
      .select("is_cancelled")
      .eq("id", notification.source_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data !== null && !data.is_cancelled;
  }

  if (notification.source_type === "study_session") {
    const { data, error } = await admin
      .from("study_sessions")
      .select("completed")
      .eq("id", notification.source_id)
      .eq("user_id", notification.user_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data !== null && !data.completed;
  }

  const { data, error } = await admin
    .from("announcements")
    .select("is_published, published_at")
    .eq("id", notification.source_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (
    data !== null &&
    data.is_published &&
    new Date(data.published_at).getTime() <= Date.now()
  );
}

async function sendToNotification(notification: AppNotification) {
  const admin = createAdminSupabaseClient();
  if (!(await sourceIsStillEligible(notification))) {
    const { error } = await updatePushStatus(notification.id, "disabled", null);
    if (error) throw new Error(error.message);
    return { sent: 0, failed: 0, removed: 0 };
  }

  const { data: preferences, error: preferencesError } = await admin
    .from("notification_preferences")
    .select("push_enabled")
    .eq("user_id", notification.user_id)
    .maybeSingle();

  if (preferencesError) throw new Error(preferencesError.message);
  if (!preferences?.push_enabled) {
    const { error } = await updatePushStatus(notification.id, "disabled", null);
    if (error) throw new Error(error.message);
    return { sent: 0, failed: 0, removed: 0 };
  }

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", notification.user_id);

  if (subscriptionsError) throw new Error(subscriptionsError.message);
  if (!subscriptions?.length) {
    const { error } = await updatePushStatus(notification.id, "disabled", null);
    if (error) throw new Error(error.message);
    return { sent: 0, failed: 0, removed: 0 };
  }

  const payload = JSON.stringify({
    notificationId: notification.id,
    title: "BLUEPRINT Reminder",
    body: "You have an upcoming academic activity.",
    actionUrl: getSafeActionUrl(notification.action_url),
  });
  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const subscription of subscriptions) {
    if (!isSafePushEndpoint(subscription.endpoint)) {
      const { error } = await admin
        .from("push_subscriptions")
        .delete()
        .eq("id", subscription.id)
        .eq("user_id", notification.user_id);
      if (error) throw new Error(error.message);
      removed++;
      continue;
    }

    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        { TTL: 3600 }
      );
    } catch (error) {
      const statusCode = getStatusCode(error);
      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await admin
          .from("push_subscriptions")
          .delete()
          .eq("id", subscription.id)
          .eq("user_id", notification.user_id);
        if (deleteError) throw new Error(deleteError.message);
        removed++;
      } else {
        failed++;
        console.error("Web Push delivery failed.", {
          notificationId: notification.id,
          statusCode,
        });
      }
      continue;
    }

    const { error } = await admin
      .from("push_subscriptions")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", subscription.id)
      .eq("user_id", notification.user_id);
    if (error) throw new Error(error.message);
    sent++;
  }

  const status = sent > 0 ? "sent" : failed > 0 ? "failed" : "disabled";
  const errorCode = failed > 0 ? "delivery_failed" : null;
  const { error } = await updatePushStatus(notification.id, status, errorCode);
  if (error) throw new Error(error.message);

  return { sent, failed, removed };
}

export async function dispatchPendingPushNotifications(batchSize = 100) {
  configureVapid();
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.rpc("claim_pending_notification_pushes", {
    batch_size: batchSize,
  });

  if (error) throw new Error(error.message);

  const totals = { notifications: data?.length ?? 0, sent: 0, failed: 0, removed: 0 };
  for (const notification of (data ?? []) as AppNotification[]) {
    const result = await sendToNotification(notification);
    totals.sent += result.sent;
    totals.failed += result.failed;
    totals.removed += result.removed;
  }
  return totals;
}
