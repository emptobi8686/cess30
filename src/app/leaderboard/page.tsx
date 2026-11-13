import { DashboardShell } from "@/components/shared/dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireUserSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  await requireUserSession();
  return (
    <DashboardShell currentLabel="Leaderboard">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Leaderboard"
          title="Participation overview"
          description="This page is reserved for verified student activity and participation rankings. No scores are shown in this preview."
        />
        <EmptyState
          title="No leaderboard data yet"
          description="Participation data has not been added to this build yet."
        />
      </div>
    </DashboardShell>
  );
}
