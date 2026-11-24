import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getAudienceOptions } from "@/features/audiences/server";
import { ResourceForm } from "../_components/resource-form";

export const dynamic = "force-dynamic";

export default async function NewLibraryResourcePage() {
  const { courses } = await getAudienceOptions();
  return (
    <AdminShell currentLabel="Library">
      <div className="space-y-6">
        <PageHeader eyebrow="Admin · Library" title="New resource" description="Step 1: details, audience and copyright. You upload the file and publish on the next page." />
        <Card><CardContent className="py-6"><ResourceForm courses={courses} /></CardContent></Card>
      </div>
    </AdminShell>
  );
}
