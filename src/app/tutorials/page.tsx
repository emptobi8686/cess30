import Link from "next/link";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAcademicContext } from "@/features/academic/context";
import { LEVEL_CODES } from "@/features/academic/validation";
import { getMyTutorialState, searchTutorials } from "@/features/tutorials/student-queries";
import { requireUserSession } from "@/lib/supabase/auth";
import { NewPlaylist } from "./_components/tutorial-actions";

export const dynamic = "force-dynamic";

function minutes(s: number | null) {
  return s ? ` · ${Math.max(1, Math.round(s / 60))} min` : "";
}

export default async function TutorialsPage(props: PageProps<"/tutorials">) {
  const user = await requireUserSession();
  const params = await props.searchParams;
  const academic = await getAcademicContext();
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const q = str("q").slice(0, 100);
  const levelParam = str("level");
  const level = levelParam === "all" ? null : (LEVEL_CODES as readonly string[]).includes(levelParam) ? levelParam : academic.levelCode;
  const aiOnly = str("ai") === "1";
  const [results, mine] = await Promise.all([
    searchTutorials({ q, level, source: aiOnly ? "ai_generated" : null }),
    getMyTutorialState(user.id),
  ]);
  const saved = results.filter((t) => mine.saved.has(t.id));

  return (
    <DashboardShell currentLabel="Tutorials" academic={academic}>
      <div className="space-y-6">
        <PageHeader eyebrow="Tutorials" title="Video tutorials" description="Short videos picked for your courses. Mark them completed as you go." />
        <Card><CardContent className="py-4">
          <form className="flex flex-wrap items-end gap-3" action="/tutorials" role="search">
            <div className="min-w-48 flex-1 space-y-1">
              <label htmlFor="tu-q" className="text-sm font-medium">Search</label>
              <Input id="tu-q" name="q" defaultValue={q} maxLength={100} placeholder="e.g. shear force" />
            </div>
            <div className="space-y-1">
              <label htmlFor="tu-level-filter" className="text-sm font-medium">Level</label>
              <select id="tu-level-filter" name="level" defaultValue={levelParam === "all" ? "all" : level ?? "all"} className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
                <option value="all">Everything I can access</option>
                {LEVEL_CODES.map((l) => <option key={l} value={l}>Level {l}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="ai" value="1" defaultChecked={aiOnly} /> AI-generated only</label>
            <Button type="submit">Search</Button>
          </form>
        </CardContent></Card>

        <section aria-label="Tutorials" className="space-y-2">
          {results.length === 0 ? <p className="text-sm text-muted-foreground">No tutorials yet for this filter.</p> : (
            <ul className="divide-y divide-border/60 rounded-xl border">
              {results.map((t) => {
                const p = mine.progress.get(t.id);
                return (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <Link href={`/tutorials/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                      <p className="text-xs text-muted-foreground">{t.topic}{minutes(t.duration_seconds)}{t.is_ai_generated ? " · AI-generated" : ""}</p>
                    </div>
                    {p?.status === "completed" ? <span className="text-xs font-medium text-primary">Completed</span> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <section aria-label="Saved" className="space-y-2">
            <h2 className="text-base font-semibold">Saved</h2>
            {saved.length === 0 ? <p className="text-sm text-muted-foreground">Save tutorials to find them here.</p> : (
              <ul className="space-y-1 text-sm">{saved.map((t) => <li key={t.id}><Link href={`/tutorials/${t.id}`} className="hover:underline">{t.title}</Link></li>)}</ul>
            )}
          </section>
          <section aria-label="Playlists" className="space-y-2">
            <h2 className="text-base font-semibold">Playlists</h2>
            <ul className="space-y-1 text-sm">
              {mine.playlists.map((p) => (
                <li key={p.id}><Link href={`/tutorials/playlists/${p.id}`} className="hover:underline">{p.title}</Link>{p.is_official ? <span className="ml-2 text-xs text-muted-foreground">Official</span> : null}</li>
              ))}
            </ul>
            <NewPlaylist />
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
