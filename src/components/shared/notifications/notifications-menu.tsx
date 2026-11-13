"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markNotificationRead } from "@/features/notifications/actions";
import { createClient } from "@/lib/supabase/client";
import { formatTimestamp } from "@/lib/dates";
import { getSafeActionUrl } from "@/lib/notifications/validation";
import type { AppNotification } from "@/types";

type NotificationSnapshot = {
  userId: string | null;
  unreadCount: number;
  notifications: AppNotification[];
  error: string | null;
};

export function NotificationsMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async (): Promise<NotificationSnapshot> => {
    const supabase = createClient();
    const [authResult, countResult, notificationsResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false),
      supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (authResult.error) {
      console.error("Could not load notification menu.", { code: authResult.error.status });
      return {
        userId: null,
        unreadCount: 0,
        notifications: [],
        error: "Notifications could not be loaded.",
      };
    }
    if (!authResult.data.user) {
      return {
        userId: null,
        unreadCount: 0,
        notifications: [],
        error: "Sign in to view notifications.",
      };
    }
    if (countResult.error || notificationsResult.error) {
      console.error("Could not load notification menu.", {
        code: countResult.error?.code ?? notificationsResult.error?.code,
      });
      return {
        userId: authResult.data.user.id,
        unreadCount: 0,
        notifications: [],
        error: "Notifications could not be loaded.",
      };
    }

    return {
      userId: authResult.data.user.id,
      unreadCount: countResult.count ?? 0,
      notifications: (notificationsResult.data ?? []) as AppNotification[],
      error: null,
    };
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

    const applySnapshot = (snapshot: NotificationSnapshot) => {
      setUnreadCount(snapshot.unreadCount);
      setNotifications(snapshot.notifications);
      setError(snapshot.error);
      setLoading(false);
    };
    const refresh = () => {
      void loadNotifications().then((snapshot) => {
        if (active) applySnapshot(snapshot);
      });
    };

    void loadNotifications().then((snapshot) => {
      if (!active) return;
      applySnapshot(snapshot);
      if (!snapshot.userId || snapshot.error) return;

      const supabase = createClient();
      channel = supabase
        .channel(`notifications-${snapshot.userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${snapshot.userId}`,
          },
          refresh
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setError("Live notification updates are temporarily unavailable.");
          }
        });
    });

    return () => {
      active = false;
      if (channel) void createClient().removeChannel(channel);
    };
  }, [loadNotifications]);

  async function openNotification(notification: AppNotification) {
    if (!notification.is_read) {
      const result = await markNotificationRead(notification.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setUnreadCount((count) => Math.max(0, count - 1));
      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id ? { ...item, is_read: true } : item
        )
      );
    }
    setOpen(false);
    router.push(getSafeActionUrl(notification.action_url));
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        {error ? (
          <p role="status" className="px-4 py-5 text-sm text-destructive">{error}</p>
        ) : loading ? (
          <p role="status" className="px-4 py-5 text-sm text-muted-foreground">
            Loading notifications…
          </p>
        ) : notifications.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted-foreground">You’re all caught up.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <li key={notification.id} className="border-b border-border/50 last:border-0">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start whitespace-normal rounded-none px-4 py-3 text-left"
                  onClick={() => void openNotification(notification)}
                >
                  <span className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        notification.is_read ? "bg-transparent" : "bg-primary"
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{notification.title}</span>
                      <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                        {notification.message}
                      </span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {formatTimestamp(notification.created_at)}
                      </span>
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
