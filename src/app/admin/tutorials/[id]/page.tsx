import { notFound } from "next/navigation";
import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAudienceOptions } from "@/features/audiences/server";
import { getTutorialAdmin } from "@/features/tutorials/queries";
import { formatTimestamp } from "@/lib/dates";
import { TutorialForm } from "../_components/tutorial-form";
import { ReviewPanel, TutorialStatusControls } from "../_components/review-forms";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminTutorialPage(props: PageProps<"/admin/tutorials/[id]">) {
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const [detail, { courses }] = await Promise.all([getTutorialAdmin(id), getAudienceOptions()]);
  if (!detail) notFound();
  const { tutorial: t, reviewerName, userId } = detail;
  const isCreator = t.created_by === userId;
  return (
    <AdminShell currentLabel="Tutorials">
      <div className="space-y-6">
        <PageHeader eyebrow={`Admin · Tutorials · ${t.status.replace("_", " ")}`} title={t.title}
          description={`Review: ${t.review_status.replace("_", " ")}${reviewerName ? ` by ${reviewerName}` : ""}${t.reviewed_at ? ` on ${formatTimestamp(t.reviewed_at, { day: "numeric", month: "short", year: "numeric" })}` : ""}`} />
        <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3"><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent><TutorialForm tutorial={t} courses={courses} /></CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Review</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {t.review_notes ? <p className="text-muted-foreground">Last notes: {t.review_notes}</p> : null}
                {isCreator ? (
                  <p className="text-muted-foreground">You created this tutorial, so another reviewer must approve it.</p>
                ) : t.status !== "removed" ? <ReviewPanel id={t.id} /> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Status</CardTitle></CardHeader>
              <CardContent><TutorialStatusControls id={t.id} status={t.status} reviewStatus={t.review_status} /></CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
