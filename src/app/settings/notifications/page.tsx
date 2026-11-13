import Link from "next/link";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { NotificationPreferencesForm } from "@/components/shared/notifications/notification-preferences-form";
import { PushDeviceSettings } from "@/components/shared/notifications/push-device-settings";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  getNotificationDevices,
  getNotificationPreferences,
} from "@/features/notifications/queries";
import { requireUserSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  await requireUserSession();
  const [preferences, devices] = await Promise.all([
    getNotificationPreferences(),
    getNotificationDevices(),
  ]);

  return (
    <DashboardShell currentLabel="Settings">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Notification settings"
          title="Choose your updates"
          description="Control in-app reminders, browser push, quiet hours, and registered devices."
          action={
            <Button variant="outline" render={<Link href="/notifications" />}>
              Open notification centre
            </Button>
          }
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <NotificationPreferencesForm preferences={preferences} />
          <PushDeviceSettings devices={devices} preferences={preferences} />
        </div>
      </div>
    </DashboardShell>
  );
}
