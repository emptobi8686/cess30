import Link from "next/link";
import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { audienceBadge } from "@/features/audiences/schema";
import { getOpenTutorialReports, getTutorialAdminList } from "@/features/tutorials/queries";
import { ResolveTutorialReport } from "./_components/review-forms";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "draft", label: "Drafts" },
  { key: "in_review", label: "In review" },
  { key: "published", label: "Published" },
  { key: "reported", label: "Reported" },
  { key: "links", label: "Link problems" },
] as const;

export default async function AdminTutorialsPage(props: PageProps<"/admin/tutorials">) {
  const params = await props.searchParams;
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? "draft";
  const [rows, reports] = await Promise.all([tab === "reported" ? Promise.resolve([]) : getTutorialAdminList(tab), getOpenTutorialReports()]);
  return (
    <AdminShell currentLabel="Tutorials">
      <div className="space-y-6">
        <PageHeader eyebrow="Admin · Tutorials" title="Tutorials"
          description="Curated videos for each level. Someone other than the creator reviews each one before students see it." />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Tutorial queues" className="flex flex-wrap gap-2 text-sm">
            {TABS.map((t) => (
              <Link key={t.key} href={`/admin/tutorials?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined}
                className={t.key === tab ? "rounded-lg bg-primary px-3 py-1.5 text-primary-foreground" : "rounded-lg border px-3 py-1.5 hover:bg-muted"}>
                {t.label}{t.key === "reported" && reports.length ? ` (${reports.length})` : ""}
              </Link>
            ))}
          </nav>
          <Button nativeButton={false} render={<Link href="/admin/tutorials/new" />}>New tutorial</Button>
        </div>
        {tab === "reported" ? (
          reports.length === 0 ? <p className="text-sm text-muted-foreground">No open reports.</p> : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li key={r.id}><Card><CardContent className="space-y-2 py-4 text-sm">
                  <p><Link href={`/admin/tutorials/${r.tutorial_id}`} className="font-medium hover:underline">{r.tutorials?.title ?? "Tutorial"}</Link>
                    <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">{r.reason.replace("_", " ")}</span></p>
                  {r.details ? <p className="text-muted-foreground">{r.details}</p> : null}
                  <ResolveTutorialReport reportId={r.id} />
                </CardContent></Card></li>
              ))}
            </ul>
          )
        ) : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nothing here.</p> : (
          <ul className="divide-y divide-border/60 rounded-xl border text-sm">
            {rows.map((t) => (
              <li key={t.id} className="px-4 py-3">
                <Link href={`/admin/tutorials/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                <p className="text-xs text-muted-foreground">
                  {t.topic} · {audienceBadge(t.tutorial_audiences)} · review: {t.review_status.replace("_", " ")}
{t.link_status !== "ok" && t.link_status !== "unchecked" ? ` · link: ${t.link_status.replace("_", " ")}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
