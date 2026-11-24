import { notFound } from "next/navigation";
import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAudienceOptions } from "@/features/audiences/server";
import { getLibraryResourceAdmin } from "@/features/library/queries";
import { formatTimestamp } from "@/lib/dates";
import { ResourceForm } from "../_components/resource-form";
import { StatusControls } from "../_components/status-forms";
import { UploadFile } from "../_components/upload-file";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

export default async function LibraryResourceAdminPage(props: PageProps<"/admin/library/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const [detail, { courses }] = await Promise.all([getLibraryResourceAdmin(id), getAudienceOptions()]);
  if (!detail) notFound();
  const { resource, files } = detail;

  return (
    <AdminShell currentLabel="Library">
      <div className="space-y-6">
        <PageHeader eyebrow={`Admin · Library · ${resource.status}`} title={resource.title}
          description={resource.removal_reason ? `Removed: ${resource.removal_reason}` : "Upload the file, check the audience, then publish."} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">File</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {resource.status !== "removed" ? <UploadFile resourceId={resource.id} /> : null}
                {files.length === 0 ? <p className="text-sm text-muted-foreground">No file uploaded yet.</p> : (
                  <ul className="divide-y divide-border/60 text-sm" aria-label="Versions">
                    {files.map((f) => (
                      <li key={f.id} className="flex flex-wrap justify-between gap-2 py-2">
                        <span>v{f.version} · {f.original_filename} {f.id === resource.current_file_id ? <strong className="ml-1 text-primary">current</strong> : null}</span>
                        <span className="text-xs text-muted-foreground">{formatSize(f.size_bytes)} · {formatTimestamp(f.created_at, { day: "numeric", month: "short", year: "numeric" })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Details</CardTitle></CardHeader>
              <CardContent><ResourceForm resource={resource} courses={courses} /></CardContent>
            </Card>
          </div>
          <Card className="h-fit">
            <CardHeader className="pb-3"><CardTitle className="text-base">Status</CardTitle></CardHeader>
            <CardContent><StatusControls id={resource.id} status={resource.status} /></CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
