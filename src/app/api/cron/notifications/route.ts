import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  createDueReminderNotifications,
} from "@/lib/notifications/delivery";
import { dispatchPendingPushNotifications } from "@/lib/notifications/push";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization) return false;

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
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
