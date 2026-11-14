import Link from "next/link";
import { ArrowLeft, CheckCircle2, Search, XCircle } from "lucide-react";
import { AdminShell } from "@/components/shared/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  approveVerificationAction,
  rejectVerificationAction,
} from "@/features/verification/actions";
import { getVerificationQueue } from "@/features/verification/queries";
import { getVerificationStatusLabel } from "@/lib/verification";

function toString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const activeStatus = toString(params.status) || "pending";
  const query = toString(params.q) || "";

  const queue = await getVerificationQueue({
    status: activeStatus,
    search: query,
  });

  return (
    <AdminShell currentLabel="Verifications" displayName={undefined}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Verification queue
            </p>
            <h2 className="mt-1 text-2xl font-semibold">Student matriculation review</h2>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to overview
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{queue.counts.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Verified</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{queue.counts.verified}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Rejected</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{queue.counts.rejected}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-base">Review submissions</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row">
                <form method="get" className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="q"
                      defaultValue={query}
                      placeholder="Search student or matric number"
                      className="pl-8 md:w-72"
                    />
                  </div>
                  <Button type="submit" size="sm">Search</Button>
                </form>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(["pending", "verified", "rejected", "all"] as const).map((status) => {
                const isActive = activeStatus === status;
                const href = status === "all" ? "/admin/verifications" : `/admin/verifications?status=${status}`;
                const queryString = query ? `&q=${encodeURIComponent(query)}` : "";

                return (
                  <Link key={status} href={`${href}${queryString}`}>
                    <Button type="button" variant={isActive ? "default" : "outline"} size="sm" className="capitalize">
                      {status === "all" ? "All" : getVerificationStatusLabel(status)}
                    </Button>
                  </Link>
                );
              })}
            </div>

            {queue.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                No verification submissions match the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-3 font-medium">Student</th>
                      <th className="px-2 py-3 font-medium">Matric</th>
                      <th className="px-2 py-3 font-medium">Status</th>
                      <th className="px-2 py-3 font-medium">Submitted</th>
                      <th className="px-2 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.items.map((submission) => (
                      <tr key={submission.id} className="border-b border-border/60 align-top">
                        <td className="px-2 py-3">
                          <div className="font-medium">{submission.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {submission.department} · {submission.level}
                          </div>
                        </td>
                        <td className="px-2 py-3 font-mono text-xs text-muted-foreground">
                          {submission.matric_number ?? "Not submitted"}
                        </td>
                        <td className="px-2 py-3">
                          <Badge variant={submission.verification_status === "rejected" ? "destructive" : "secondary"}>
                            {getVerificationStatusLabel(submission.verification_status)}
                          </Badge>
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          {new Date(submission.created_at).toLocaleDateString()} 
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex flex-col gap-3">
                            <form action={approveVerificationAction} className="space-y-2">
                              <input type="hidden" name="profileId" value={submission.id} />
                              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <input type="checkbox" name="confirmed" required />
                                Confirm approval
                              </label>
                              <Button type="submit" size="sm" className="gap-2">
                                <CheckCircle2 className="h-4 w-4" />
                                Approve
                              </Button>
                            </form>

                            <form action={rejectVerificationAction} className="space-y-2">
                              <input type="hidden" name="profileId" value={submission.id} />
                              <Textarea
                                name="reason"
                                rows={2}
                                placeholder="Reason for rejection (minimum 12 characters)"
                                required
                              />
                              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                <input type="checkbox" name="confirmed" required />
                                Confirm rejection
                              </label>
                              <Button type="submit" variant="destructive" size="sm" className="gap-2">
                                <XCircle className="h-4 w-4" />
                                Reject
                              </Button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
