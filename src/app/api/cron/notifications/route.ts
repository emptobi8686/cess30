import { NextResponse, type NextRequest } from "next/server";
import {
  createDueReminderNotifications,
} from "@/lib/notifications/delivery";
import { dispatchPendingPushNotifications } from "@/lib/notifications/push";
import { isAuthorizedCron } from "@/lib/cron/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const reminders = await createDueReminderNotifications();
    const pushes = await dispatchPendingPushNotifications();
    return NextResponse.json({
      reminders,
      pushes: {
        notifications: pushes.notifications,
        sent: pushes.sent,
        failed: pushes.failed,
        removed: pushes.removed,
      },
    });
  } catch (error) {
    console.error("Notification scheduler run failed.", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "The notification scheduler could not complete this run." },
      { status: 500 }
    );
  }
}
