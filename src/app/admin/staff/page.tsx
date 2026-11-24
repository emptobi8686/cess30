import { AdminShell } from "@/components/shared/admin-shell";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchStudents } from "@/features/academic/queries";
import { assignmentStatusLabel, CAPABILITY_LABELS } from "@/features/staff/messages";
import { getStaffAssignments } from "@/features/staff/queries";
import { requireAdminPage } from "@/lib/auth/access-server";
import { formatTimestamp } from "@/lib/dates";
import { ApproveForm, GrantForm, RevokeForm } from "./_components/staff-forms";

export const dynamic = "force-dynamic";

export default async function StaffPage(props: PageProps<"/admin/staff">) {
  const access = await requireAdminPage();
  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const [assignments, results] = await Promise.all([getStaffAssignments(), q ? searchStudents(q) : Promise.resolve([])]);

  return (
    <AdminShell currentLabel="Staff">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Admin · Staff"
          title="Course representatives and administrators"
          description="Each level is run by its course representative. Appointments expire with the academic session and every change is logged. Nobody can grant a role to themselves."
        />

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Current roles</CardTitle></CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments yet. Existing administrators keep full access.</p>
            ) : (
              <ul className="divide-y divide-border/60 text-sm">
                {assignments.map((row) => {
                  const name = row.profiles?.full_name ?? "Unknown";
                  const status = assignmentStatusLabel(row);
                  return (
                    <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium">
                          {name} <span className="font-mono text-xs text-muted-foreground">{row.profiles?.matric_number ?? ""}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {CAPABILITY_LABELS[row.capability] ?? row.capability}
                          {row.level_code ? ` · Level ${row.level_code}` : ""}
                          {row.expires_at ? ` · until ${formatTimestamp(row.expires_at, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                          {" · "}<span data-testid="assignment-status">{status}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{row.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {row.status === "pending_approval" && row.granted_by !== access.userId ? <ApproveForm assignmentId={row.id} name={name} /> : null}
                        {row.user_id !== access.userId ? <RevokeForm assignmentId={row.id} name={name} /> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Appoint someone</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form className="flex flex-wrap items-end gap-2" action="/admin/staff">
              <div className="space-y-1">
                <label htmlFor="staff-search" className="text-sm font-medium">Find a verified student (name or matric)</label>
                <Input id="staff-search" name="q" defaultValue={q} maxLength={80} className="max-w-xs" />
              </div>
              <Button type="submit" variant="outline">Search</Button>
            </form>
            {q && results.length === 0 ? <p className="text-sm text-muted-foreground">No verified students match.</p> : null}
            <div className="space-y-3">
              {results.filter((s) => s.id !== access.userId).map((s) => (
                <GrantForm key={s.id} userId={s.id} name={s.full_name} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
