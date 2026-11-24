import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getAudienceOptions } from "@/features/audiences/server";
import { TutorialForm } from "../_components/tutorial-form";

export const dynamic = "force-dynamic";

export default async function NewTutorialPage() {
  const { courses } = await getAudienceOptions();
  return (
    <AdminShell currentLabel="Tutorials">
      <div className="space-y-6">
        <PageHeader eyebrow="Admin · Tutorials" title="New tutorial" description="Paste a link, describe what students will learn and choose who sees it. It starts as a draft." />
        <Card><CardContent className="py-6"><TutorialForm courses={courses} /></CardContent></Card>
      </div>
    </AdminShell>
  );
}
