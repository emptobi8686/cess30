import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REVIEW_ITEM_LABELS } from "@/features/academic/review-dispatch";
import { requireAdminPage } from "@/lib/auth/access-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { RerunBackfillForm, ReviewItemForm } from "../_components/review-item-form";

export const dynamic = "force-dynamic";

type ReviewRow = { id: string; item_type: string; entity_id: string; label: string | null; details: Record<string, string> | null };

export default async function MigrationReviewPage() {
  await requireAdminPage();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("admin_migration_review")
    .select("id, item_type, entity_id, label, details")
    .order("created_at");
  const rows = (data ?? []) as ReviewRow[];
  const groups = Object.keys(REVIEW_ITEM_LABELS)
    .map((type) => ({ type, items: rows.filter((r) => r.item_type === type) }))
    .filter((g) => g.items.length > 0);

  return (
    <AdminShell currentLabel="Academic">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin · Academic"
          title="Migration review"
          description="Old content that could not be matched to a level or class automatically. Hidden items stay hidden from students until you resolve them."
        />
        <RerunBackfillForm />
        {error ? <p className="text-sm text-destructive">The review queue could not be loaded.</p> : null}
        {groups.length === 0 && !error ? <p className="text-sm text-muted-foreground">Nothing to review.</p> : null}
        {groups.map((group) => (
          <Card key={group.type}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{REVIEW_ITEM_LABELS[group.type]} · {group.items.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border/60 text-sm">
                {group.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <span>{item.label ?? "Unknown item"}</span>
                    <ReviewItemForm item={{ id: item.id, item_type: item.item_type, label: item.label ?? "", suggested_level: item.details?.suggested_level }} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
