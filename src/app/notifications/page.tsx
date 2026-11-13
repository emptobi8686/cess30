import { DashboardShell } from "@/components/shared/dashboard-shell";
import { NotificationCentre } from "@/components/shared/notifications/notification-centre";
import { PageHeader } from "@/components/shared/page-header";
import { getNotifications } from "@/features/notifications/queries";
import { requireUserSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type Filter = "all" | "unread" | "read";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireUserSession();
  const params = await searchParams;
  const filter: Filter =
    params.filter === "unread" || params.filter === "read" ? params.filter : "all";
  const notifications = await getNotifications(filter);

  return (
    <DashboardShell currentLabel="Notifications">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Your updates"
          title="Notifications"
          description="Reminders and academic announcements for your account."
        />
        <NotificationCentre initialNotifications={notifications} filter={filter} />
      </div>
    </DashboardShell>
  );
}
