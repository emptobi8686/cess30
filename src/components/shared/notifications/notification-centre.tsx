"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/actions";
import { addDays, formatTimestamp, getLagosDateString } from "@/lib/dates";
import { getSafeActionUrl } from "@/lib/notifications/validation";
import type { AppNotification } from "@/types";

type Filter = "all" | "unread" | "read";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "read", label: "Read" },
];

const CATEGORY_LABELS: Record<AppNotification["notification_type"], string> = {
  lecture_reminder: "Lecture reminder",
  study_reminder: "Study reminder",
  announcement: "Announcement",
  system: "System",
};

function getDateGroup(createdAt: string) {
  const date = getLagosDateString(new Date(createdAt));
  const today = getLagosDateString();
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(createdAt));
}

export function NotificationCentre({
  initialNotifications,
  filter,
}: {
  initialNotifications: AppNotification[];
  filter: Filter;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const result = new Map<string, AppNotification[]>();
    for (const notification of notifications) {
      const label = getDateGroup(notification.created_at);
      const current = result.get(label) ?? [];
      current.push(notification);
      result.set(label, current);
    }
    return [...result.entries()];
  }, [notifications]);
  const hasUnread = notifications.some((notification) => !notification.is_read);

  function openNotification(notification: AppNotification) {
    setError(null);
    startTransition(async () => {
      if (!notification.is_read) {
        const result = await markNotificationRead(notification.id);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setNotifications((items) =>
          filter === "unread"
            ? items.filter((item) => item.id !== notification.id)
            : items.map((item) =>
                item.id === notification.id ? { ...item, is_read: true } : item
              )
        );
      }
      router.push(getSafeActionUrl(notification.action_url));
    });
  }

  function markAllRead() {
    setError(null);
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotifications((items) =>
        filter === "unread" ? [] : items.map((item) => ({ ...item, is_read: true }))
      );
    });
  }

  function removeNotification(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteNotification(id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotifications((items) => items.filter((item) => item.id !== id));
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Notification filters" className="flex gap-2">
          {FILTERS.map(({ key, label }) => (
            <Link
              key={key}
              href={key === "all" ? "/notifications" : `/notifications?filter=${key}`}
              aria-current={filter === key ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                filter === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={markAllRead}
          disabled={!hasUnread || isPending}
        >
          <CheckCheck className="mr-2 size-4" />
          Mark all as read
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {notifications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Bell className="size-8 text-muted-foreground" />
            <p className="font-medium">You’re all caught up</p>
            <p className="text-sm text-muted-foreground">
              {filter === "unread"
                ? "There are no unread notifications."
                : "Notifications about your academic activities will appear here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, items]) => (
            <section key={label} aria-labelledby={`notifications-${label}`}>
              <h2
                id={`notifications-${label}`}
                className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {label}
              </h2>
              <ul className="space-y-2">
                {items.map((notification) => (
                  <li key={notification.id}>
                    <Card className={notification.is_read ? "opacity-85" : "border-primary/30"}>
                      <CardContent className="flex items-start gap-3 py-3">
                        <span
                          aria-hidden="true"
                          className={`mt-2 size-2 shrink-0 rounded-full ${
                            notification.is_read ? "bg-muted-foreground/30" : "bg-primary"
                          }`}
                        />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openNotification(notification)}
                          disabled={isPending}
                        >
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{notification.title}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              {CATEGORY_LABELS[notification.notification_type]}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {notification.message}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {formatTimestamp(notification.created_at)}
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          {!notification.is_read && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Mark as read"
                              onClick={() => {
                                startTransition(async () => {
                                  const result = await markNotificationRead(notification.id);
                                  if (!result.ok) {
                                    setError(result.error);
                                    return;
                                  }
                                  setNotifications((items) =>
                                    items.map((item) =>
                                      item.id === notification.id
                                        ? { ...item, is_read: true }
                                        : item
                                    )
                                  );
                                });
                              }}
                              disabled={isPending}
                            >
                              <Check className="size-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete notification"
                            onClick={() => removeNotification(notification.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
