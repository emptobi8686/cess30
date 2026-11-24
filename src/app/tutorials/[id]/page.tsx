import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { VideoEmbed } from "@/components/shared/video-embed";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_LABEL } from "@/features/tutorials/schema";
import { getMyTutorialState, getTutorialForStudent } from "@/features/tutorials/student-queries";
import { embedUrlFor } from "@/features/tutorials/video-url";
import { formatTimestamp } from "@/lib/dates";
import { requireUserSession } from "@/lib/supabase/auth";
import { AddToPlaylist, CompletionToggle, ReportTutorial, SaveToggle } from "../_components/tutorial-actions";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TutorialPage(props: PageProps<"/tutorials/[id]">) {
  const user = await requireUserSession();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const [detail, mine] = await Promise.all([getTutorialForStudent(id), getMyTutorialState(user.id)]);
  if (!detail) notFound();
  const { tutorial: t, reviewer } = detail;
  const embed = t.embed_allowed && t.provider !== "other_allowlisted" && t.provider_video_id
    ? embedUrlFor(t.provider === "youtube" ? { provider: "youtube", id: t.provider_video_id } : { provider: "vimeo", id: t.provider_video_id })
    : null;
  const providerLabel = t.provider === "youtube" ? "YouTube" : t.provider === "vimeo" ? "Vimeo" : t.provider_name ?? "the provider";

  return (
    <DashboardShell currentLabel="Tutorials">
      <div className="space-y-6">
        <PageHeader eyebrow={`Tutorials · ${t.topic}`} title={t.title} description={t.description ?? ""} />
        {t.is_ai_generated ? (
          <p role="note" className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            {AI_LABEL(reviewer ?? "a department reviewer", t.reviewed_at ? formatTimestamp(t.reviewed_at, { day: "numeric", month: "long", year: "numeric" }) : "—")}
          </p>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {embed ? <VideoEmbed embedUrl={embed} title={t.title} /> : null}
            <Button variant={embed ? "ghost" : "default"} nativeButton={false}
              render={<a href={t.external_url} target="_blank" rel="noopener noreferrer" />}>
              <ExternalLink className="mr-2 h-4 w-4" /> Open on {providerLabel}
            </Button>
            <div className="flex flex-wrap items-start gap-3">
              <CompletionToggle tutorialId={t.id} initial={mine.progress.get(t.id)?.status === "completed"} />
              <SaveToggle tutorialId={t.id} initial={mine.saved.has(t.id)} />
              <ReportTutorial tutorialId={t.id} />
            </div>
            <AddToPlaylist tutorialId={t.id} playlists={mine.playlists.filter((p) => !p.is_official && p.owner_id === user.id)} />
          </div>
          <Card className="h-fit">
            <CardHeader className="pb-2"><CardTitle className="text-base">You will learn to</CardTitle></CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm">{t.learning_objectives.map((o) => <li key={o}>{o}</li>)}</ul>
              {t.creator_name ? <p className="mt-3 text-xs text-muted-foreground">By {t.creator_name}</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
