import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { getPlaylist } from "@/features/tutorials/student-queries";
import { requireUserSession } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlaylistPage(props: PageProps<"/tutorials/playlists/[id]">) {
  await requireUserSession();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const data = await getPlaylist(id);
  if (!data) notFound();
  return (
    <DashboardShell currentLabel="Tutorials">
      <div className="space-y-6">
        <PageHeader eyebrow={data.playlist.is_official ? "Official playlist" : "My playlist"} title={data.playlist.title} description={data.playlist.description ?? ""} />
        {data.items.length === 0 ? <p className="text-sm text-muted-foreground">No tutorials here yet. Add them from a tutorial page.</p> : (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {data.items.map((i) => <li key={i.tutorials!.id}><Link href={`/tutorials/${i.tutorials!.id}`} className="hover:underline">{i.tutorials!.title}</Link></li>)}
          </ol>
        )}
      </div>
    </DashboardShell>
  );
}
