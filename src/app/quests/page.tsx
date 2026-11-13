import { DashboardShell } from "@/components/shared/dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireUserSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function QuestsPage() {
  await requireUserSession();
  return (
    <DashboardShell currentLabel="Quests">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Quests"
          title="Participation and submissions"
          description="This section will hold verified academic quests and evidence-based tasks when the feature is ready."
        />
        <EmptyState
          title="No quests available right now"
          description="There are no active quests or submissions to display yet."
        />
      </div>
    </DashboardShell>
  );
}
