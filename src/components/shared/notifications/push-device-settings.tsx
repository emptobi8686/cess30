"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff, Loader2, Smartphone, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateNotificationPreferences } from "@/features/notifications/actions";
import { formatTimestamp } from "@/lib/dates";
import type { NotificationPreferences, PushDevice } from "@/types";

function getApplicationServerKey(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const decoded = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function getDeviceLabel() {
  const userAgent = navigator.userAgent;
  if (/iPad|iPhone|iPod/i.test(userAgent)) return "Apple device";
  if (/Android/i.test(userAgent)) return "Android device";
  return "Web browser";
}

async function readApiError(response: Response) {
  const result = await response.json();
  return typeof result.error === "string" ? result.error : "The request could not be completed.";
}

export function PushDeviceSettings({
  devices,
  preferences,
}: {
  devices: PushDevice[];
  preferences: NotificationPreferences;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function enableOnThisDevice() {
    setError(null);
    setMessage(null);

    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setError("This browser does not support web push notifications.");
      return;
    }

    const isIos =
      /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isIos && !isStandalone) {
      setError("On iPhone or iPad, add BLUEPRINT to your Home Screen before enabling push.");
      return;
    }

    if (Notification.permission === "denied") {
      setError(
        "Notifications are blocked. Open this site’s controls in the address bar, allow Notifications, then return and try again."
      );
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setError("Push notifications are not configured for this deployment.");
      return;
    }

    try {
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      if (permission !== "granted") {
        setError(
          permission === "denied"
            ? "Notifications are blocked. Open this site’s controls in the address bar, allow Notifications, then try again."
            : "Notification permission was not granted."
        );
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: getApplicationServerKey(publicKey),
        }));
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          deviceLabel: getDeviceLabel(),
        }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setMessage("Push notifications are enabled on this device.");
      router.refresh();
    } catch {
      setError("Push notifications could not be enabled. Check your connection and try again.");
    }
  }

  async function disableOnThisDevice() {
    setError(null);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setMessage("This browser has no active push subscription.");
        return;
      }

      const response = await fetch("/api/push/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      await subscription.unsubscribe();
      setMessage("Push notifications were disabled on this device.");
      router.refresh();
    } catch {
      setError("This device could not be removed. Try again.");
    }
  }

  function removeDevice(deviceId: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const registration =
          "serviceWorker" in navigator
            ? await navigator.serviceWorker.getRegistration("/sw.js")
            : undefined;
        const subscription = await registration?.pushManager.getSubscription();
        const response = await fetch(`/api/push/subscriptions/${deviceId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentEndpoint: subscription?.endpoint ?? null }),
        });
        if (!response.ok) {
          setError(await readApiError(response));
          return;
        }
        const result = await response.json();
        if (result.removedCurrentDevice && subscription) {
          try {
            await subscription.unsubscribe();
          } catch {
            setError(
              "The device was removed from BLUEPRINT, but its browser subscription could not be cleared. Remove it in your browser’s site settings."
            );
            router.refresh();
            return;
          }
        }
        setMessage("Device removed.");
        router.refresh();
      } catch {
        setError("Device could not be removed. Check your connection and try again.");
      }
    });
  }

  function pauseAllPush() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updateNotificationPreferences({
        push_enabled: false,
        lecture_reminders_enabled: preferences.lecture_reminders_enabled,
        study_reminders_enabled: preferences.study_reminders_enabled,
        announcement_notifications_enabled: preferences.announcement_notifications_enabled,
        lecture_reminder_minutes: preferences.lecture_reminder_minutes,
        quiet_hours_enabled: preferences.quiet_hours_enabled,
        quiet_hours_start: preferences.quiet_hours_start.slice(0, 5),
        quiet_hours_end: preferences.quiet_hours_end.slice(0, 5),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Push notifications are paused on all devices. In-app notifications are unchanged.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="size-4 text-primary" />
          Browser push notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Push notifications appear outside BLUEPRINT. In-app notifications remain available in your notification centre, independent of browser permission.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={enableOnThisDevice} disabled={isPending}>
            <Bell className="mr-2 size-4" />
            Enable on this device
          </Button>
          <Button type="button" variant="outline" onClick={disableOnThisDevice} disabled={isPending}>
            <BellOff className="mr-2 size-4" />
            Disable on this device
          </Button>
          {preferences.push_enabled && (
            <Button type="button" variant="outline" onClick={pauseAllPush} disabled={isPending}>
              Pause all devices
            </Button>
          )}
        </div>

        <section aria-labelledby="registered-devices-heading" className="space-y-2">
          <h3 id="registered-devices-heading" className="text-sm font-medium">
            Registered devices
          </h3>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No devices are registered for push notifications.</p>
          ) : (
            <ul className="space-y-2">
              {devices.map((device) => (
                <li
                  key={device.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Smartphone className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{device.device_label}</p>
                      <p className="text-xs text-muted-foreground">
                        Last active {formatTimestamp(device.last_used_at)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${device.device_label}`}
                    onClick={() => removeDevice(device.id)}
                    disabled={isPending}
                  >
                    {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="text-sm text-primary">{message}</p>}
      </CardContent>
    </Card>
  );
}
