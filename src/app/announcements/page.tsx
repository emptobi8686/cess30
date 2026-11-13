import { DashboardShell } from "@/components/shared/dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserSession } from "@/lib/supabase/auth";
import { formatTimestamp } from "@/lib/dates";
import { getPublishedAnnouncements } from "@/features/announcements/queries";
import type { Announcement } from "@/types";

export const dynamic = "force-dynamic";

const SCOPE_LABELS: Record<Announcement["scope"], string> = {
  all: "General",
  department: "Department",
  level: "200 Level",
  course: "Course",
};

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const date = formatTimestamp(announcement.published_at, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Card className="border-border/80 bg-card shadow-none transition-colors hover:border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base leading-snug">{announcement.title}</CardTitle>
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            {SCOPE_LABELS[announcement.scope]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{date}</p>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
          {announcement.content}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function AnnouncementsPage() {
  await requireUserSession();

  let announcements: Announcement[] = [];
  let fetchError: string | null = null;

  try {
    announcements = await getPublishedAnnouncements(50);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Unable to load announcements.";
  }

  return (
    <DashboardShell currentLabel="Announcements">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Announcements"
          title="Course updates"
          description="Published notices from the department and course representative."
        />

        {fetchError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {fetchError}
          </div>
        )}

        {!fetchError && announcements.length === 0 ? (
          <EmptyState
            title="No announcements available"
            description="There are no published announcements right now. Check back when the department or course representative posts an update."
          />
        ) : (
          <div className="space-y-4">
            {announcements.map((a) => (
              <AnnouncementCard key={a.id} announcement={a} />
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
