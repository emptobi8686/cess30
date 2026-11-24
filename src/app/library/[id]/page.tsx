import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { audienceBadge } from "@/features/audiences/schema";
import { COPYRIGHT_LABELS, RESOURCE_TYPE_LABELS } from "@/features/library/schema";
import { getLibraryResourceForStudent } from "@/features/library/student-queries";
import { requireUserSession } from "@/lib/supabase/auth";
import { BookmarkToggle, ReportForm } from "../_components/resource-actions";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function LibraryResourcePage(props: PageProps<"/library/[id]">) {
  const user = await requireUserSession();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const detail = await getLibraryResourceForStudent(id, user.id);
  if (!detail) notFound();
  const { resource: r, bookmarked, related } = detail;
  const isPdf = r.mime_type === "application/pdf";

  return (
    <DashboardShell currentLabel="Library">
      <div className="space-y-6">
        <PageHeader eyebrow={`Library · ${RESOURCE_TYPE_LABELS[r.resource_type as keyof typeof RESOURCE_TYPE_LABELS] ?? r.resource_type}`}
          title={r.title} description={r.description ?? ""} />
        <div className="flex flex-wrap items-start gap-3">
          {r.current_file_id ? (
            <Button nativeButton={false} render={<a href={`/api/library/${r.id}/file?mode=download`} />}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
          ) : null}
          <BookmarkToggle resourceId={r.id} initial={bookmarked} />
          <ReportForm resourceId={r.id} />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {isPdf ? (
              <iframe title={`Preview of ${r.title}`} src={`/api/library/${r.id}/file?mode=preview`}
                className="h-[70vh] w-full rounded-xl border" />
            ) : (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Preview is available for PDFs. Download to open this file.</p>
            )}
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">About</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {r.courses ? <p>Course: {r.courses.course_code} — {r.courses.course_title}</p> : null}
                <p>For: {audienceBadge(r.library_resource_audiences)}</p>
                <p>Shared as: {COPYRIGHT_LABELS[r.copyright_basis as keyof typeof COPYRIGHT_LABELS] ?? r.copyright_basis}</p>
                {r.licence_note ? <p>{r.licence_note}</p> : null}
                {r.tags.length ? <p>Tags: {r.tags.join(", ")}</p> : null}
              </CardContent>
            </Card>
            {related.length ? (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Related</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1 text-sm">
                    {related.map((x) => <li key={x.id}><Link href={`/library/${x.id}`} className="hover:underline">{x.title}</Link></li>)}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
