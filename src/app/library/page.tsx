import Link from "next/link";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAcademicContext } from "@/features/academic/context";
import { LEVEL_CODES } from "@/features/academic/validation";
import { RESOURCE_TYPE_LABELS, RESOURCE_TYPES } from "@/features/library/schema";
import { getMyBookmarks, recentlyAdded, searchLibrary, type LibraryCard } from "@/features/library/student-queries";
import { requireUserSession } from "@/lib/supabase/auth";
import { formatTimestamp } from "@/lib/dates";

export const dynamic = "force-dynamic";

function ResourceList({ items, empty }: { items: LibraryCard[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y divide-border/60 rounded-xl border">
      {items.map((r) => (
        <li key={r.id} className="px-4 py-3">
          <Link href={`/library/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
          <p className="text-xs text-muted-foreground">
            {RESOURCE_TYPE_LABELS[r.resource_type as keyof typeof RESOURCE_TYPE_LABELS] ?? r.resource_type}
            {r.courses ? ` · ${r.courses.course_code}` : ""}
            {r.level_code ? ` · Level ${r.level_code}` : ""}
            {r.published_at ? ` · ${formatTimestamp(r.published_at, { day: "numeric", month: "short", year: "numeric" })}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default async function LibraryPage(props: PageProps<"/library">) {
  const user = await requireUserSession();
  const params = await props.searchParams;
  const academic = await getAcademicContext();
  const str = (k: string) => (typeof params[k] === "string" ? (params[k] as string) : "");
  const q = str("q").slice(0, 100);
  const type = (RESOURCE_TYPES as readonly string[]).includes(str("type")) ? str("type") : null;
  // Defaults to the student's level; "all" shows everything they can access.
  const levelParam = str("level");
  const level = levelParam === "all" ? null : (LEVEL_CODES as readonly string[]).includes(levelParam) ? levelParam : academic.levelCode;

  const [results, bookmarks] = await Promise.all([
    searchLibrary({ q, type, level, courseId: null }),
    q || type ? Promise.resolve([]) : getMyBookmarks(user.id),
  ]);
  const recent = q || type ? [] : recentlyAdded(results);

  return (
    <DashboardShell currentLabel="Library" academic={academic}>
      <div className="space-y-6">
        <PageHeader eyebrow="Library" title="Course materials"
          description="Slides, notes, tutorial sheets and approved past questions shared with your level and courses." />
        <Card>
          <CardContent className="py-4">
            <form className="flex flex-wrap items-end gap-3" action="/library" role="search">
              <div className="min-w-48 flex-1 space-y-1">
                <label htmlFor="library-q" className="text-sm font-medium">Search</label>
                <Input id="library-q" name="q" defaultValue={q} maxLength={100} placeholder="e.g. beam deflection" />
              </div>
              <div className="space-y-1">
                <label htmlFor="library-type" className="text-sm font-medium">Type</label>
                <select id="library-type" name="type" defaultValue={type ?? ""} className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
                  <option value="">Any type</option>
                  {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{RESOURCE_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="library-level" className="text-sm font-medium">Level</label>
                <select id="library-level" name="level" defaultValue={levelParam === "all" ? "all" : level ?? "all"} className="h-9 rounded-lg border border-input bg-background px-2 text-sm">
                  <option value="all">Everything I can access</option>
                  {LEVEL_CODES.map((l) => <option key={l} value={l}>Level {l}</option>)}
                </select>
              </div>
              <Button type="submit">Search</Button>
            </form>
          </CardContent>
        </Card>

        {q || type ? (
          <section aria-label="Results" className="space-y-2">
            <h2 className="text-base font-semibold">{results.length} result{results.length === 1 ? "" : "s"}</h2>
            <ResourceList items={results} empty="Nothing matches. Try fewer words or “Everything I can access”." />
          </section>
        ) : (
          <>
            <section aria-label="Recently added" className="space-y-2">
              <h2 className="text-base font-semibold">Recently added</h2>
              <ResourceList items={recent} empty="Nothing new in the last two weeks." />
            </section>
            <section aria-label="Bookmarked" className="space-y-2">
              <h2 className="text-base font-semibold">Bookmarked</h2>
              <ResourceList items={bookmarks} empty="Bookmark resources to find them here quickly." />
            </section>
            <section aria-label="All materials" className="space-y-2">
              <h2 className="text-base font-semibold">All materials{level ? ` for Level ${level}` : ""}</h2>
              <ResourceList items={results} empty="No materials have been shared with you yet." />
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
