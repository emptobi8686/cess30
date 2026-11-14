import Link from "next/link";
import { Bell, User } from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { PwaInstallCard } from "@/components/shared/pwa-install-card";
import { Button } from "@/components/ui/button";
import { requireUserSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireUserSession();
  return (
    <DashboardShell currentLabel="Settings">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Settings"
          title="Student preferences"
          description="Manage your profile, notifications, and install BLUEPRINT on your device."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <section className="rounded-xl border border-border/80 bg-card p-5">
            <div className="flex items-start gap-3">
              <User className="mt-1 size-5 text-primary" />
              <div className="flex-1 space-y-2">
                <h2 className="font-semibold">Profile &amp; settings</h2>
                <p className="text-sm text-muted-foreground">
                  Update your nickname, profile picture, and view your verification status.
                </p>
              </div>
            </div>
            <Button render={<Link href="/settings/profile" />}>
              Open profile settings
            </Button>
          </section>
          <PwaInstallCard />
          <section className="rounded-xl border border-border/80 bg-card p-5">
            <div className="flex items-start gap-3">
              <Bell className="mt-1 size-5 text-primary" />
              <div className="flex-1 space-y-2">
                <h2 className="font-semibold">Notification settings</h2>
                <p className="text-sm text-muted-foreground">
                  Choose which academic updates you receive and manage your registered devices.
                </p>
              </div>
            </div>
            <Button render={<Link href="/settings/notifications" />}>
              Manage notifications
            </Button>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
