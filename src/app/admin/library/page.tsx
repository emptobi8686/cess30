import Link from "next/link";
import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { audienceBadge } from "@/features/audiences/schema";
import { getLibraryAdminList, getOpenLibraryReports } from "@/features/library/queries";
import { RESOURCE_TYPE_LABELS } from "@/features/library/schema";
import { ResolveReportForm } from "./_components/report-forms";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "draft", label: "Drafts" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
  { key: "reported", label: "Reported" },
] as const;

export default async function AdminLibraryPage(props: PageProps<"/admin/library">) {
  const params = await props.searchParams;
  const tab = TABS.find((t) => t.key === params.tab)?.key ?? "draft";
  const [rows, reports] = await Promise.all([
    tab === "reported" ? Promise.resolve([]) : getLibraryAdminList(tab),
    getOpenLibraryReports(),
  ]);

  return (
    <AdminShell currentLabel="Library">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin · Library"
          title="Library"
          description="Course materials for students. Files are private; students only see what is published to their audience."
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Library status" className="flex flex-wrap gap-2 text-sm">
            {TABS.map((t) => (
              <Link key={t.key} href={`/admin/library?tab=${t.key}`} aria-current={t.key === tab ? "page" : undefined}
                className={t.key === tab ? "rounded-lg bg-primary px-3 py-1.5 text-primary-foreground" : "rounded-lg border px-3 py-1.5 hover:bg-muted"}>
                {t.label}{t.key === "reported" && reports.length ? ` (${reports.length})` : ""}
              </Link>
            ))}
          </nav>
          <Button nativeButton={false} render={<Link href="/admin/library/new" />}>New resource</Button>
        </div>

        {tab === "reported" ? (
          reports.length === 0 ? <p className="text-sm text-muted-foreground">No open reports.</p> : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li key={r.id}>
                  <Card><CardContent className="space-y-2 py-4 text-sm">
                    <p><Link href={`/admin/library/${r.resource_id}`} className="font-medium hover:underline">{r.library_resources?.title ?? "Resource"}</Link>
                      <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">{r.reason.replace("_", " ")}</span></p>
                    {r.details ? <p className="text-muted-foreground">{r.details}</p> : null}
                    <ResolveReportForm reportId={r.id} resourceId={r.resource_id} />
                  </CardContent></Card>
                </li>
              ))}
            </ul>
          )
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border text-sm">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <Link href={`/admin/library/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                  <p className="text-xs text-muted-foreground">
                    {RESOURCE_TYPE_LABELS[r.resource_type as keyof typeof RESOURCE_TYPE_LABELS] ?? r.resource_type}
                    {r.courses ? ` · ${r.courses.course_code}` : ""} · {audienceBadge(r.library_resource_audiences)}
                    {r.current_file_id ? "" : " · no file yet"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
