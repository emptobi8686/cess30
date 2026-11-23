import Link from "next/link";
import { Bell, LogOut, User } from "lucide-react";
import { signOut } from "@/app/actions/auth";
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
            <Button nativeButton={false} render={<Link href="/settings/profile" />}>
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
            <Button nativeButton={false} render={<Link href="/settings/notifications" />}>
              Manage notifications
            </Button>
          </section>

          <section className="space-y-4 rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <LogOut className="mt-1 size-5 text-primary" aria-hidden />
              <div className="flex-1 space-y-2">
                <h2 className="font-semibold">Sign out</h2>
                <p className="text-sm text-muted-foreground">
                  End your session on this device. Always sign out on shared or lab computers.
                </p>
              </div>
            </div>
            <form action={signOut}>
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
