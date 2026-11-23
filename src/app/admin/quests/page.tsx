import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AdminShell } from "@/components/shared/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { formatTimestamp } from "@/lib/dates";
import { toSafeExternalHref } from "@/lib/safe-links";
import { QuestCreateForm } from "./_components/quest-create-form";
import { QuestEditForm } from "./_components/quest-edit-form";
import { SubmissionReview } from "./_components/submission-review";
import {
  getAllQuestsAdmin,
  getAllQuestSubmissionsAdmin,
  getPendingQuestSubmissionsCount,
  getActiveQuestsCountAdmin,
} from "@/features/quests/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function toString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <Badge variant="outline" className={variants[status] ?? "border-border text-muted-foreground"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default async function AdminQuestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const activeStatus = toString(params.status) || "all";

  const [quests, submissions, pendingCount, activeCount] = await Promise.all([
    getAllQuestsAdmin(),
    getAllQuestSubmissionsAdmin(
      activeStatus !== "all"
        ? { status: activeStatus as "pending" | "approved" | "rejected" }
        : undefined
    ),
    getPendingQuestSubmissionsCount(),
    getActiveQuestsCountAdmin(),
  ]);

  // Look up student display names for submissions (no direct FK from
  // quest_submissions to profiles, so fetch separately).
  const studentIds = [
    ...new Set(submissions.map((s) => s.student_id)),
  ];
  const supabase = await createServerSupabaseClient();
  const { data: studentProfiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", studentIds);
  const studentNameById = new Map(
    (studentProfiles ?? []).map((p: { id: string; full_name: string | null }) => [
      p.id,
      p.full_name ?? "Unknown",
    ])
  );

  return (
    <AdminShell currentLabel="Quests" displayName={undefined}>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Quest management
            </p>
            <h2 className="mt-1 text-2xl font-semibold">Quests &amp; submissions</h2>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to overview
            </Button>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active quests"
            value={String(activeCount ?? 0)}
            description="Visible to students"
            tone="default"
          />
          <StatCard
            label="Pending submissions"
            value={String(pendingCount ?? 0)}
            description="Awaiting review"
            tone="default"
          />
          <StatCard
            label="Total quests"
            value={String(quests.length)}
            description="All quests"
            tone="muted"
          />
          <StatCard
            label="Total submissions"
            value={String(submissions.length)}
            description="All evidence submissions"
            tone="muted"
          />
        </div>

        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create a new quest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <QuestCreateForm />
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All quests</CardTitle>
          </CardHeader>
          <CardContent>
            {quests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quests created yet.</p>
            ) : (
              <div className="space-y-3">
                {quests.map((quest) => (
                  <details
                    key={quest.id}
                    className="rounded-lg border border-border/60 p-3 open:bg-muted/20"
                  >
                    <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                      <span className="font-medium text-foreground">{quest.title}</span>
                      <span className="text-xs text-muted-foreground">+{quest.xp_reward} XP</span>
                      <span className="text-xs text-muted-foreground">
                        {quest.due_date
                          ? `Due ${formatTimestamp(quest.due_date, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                          : "No deadline"}
                      </span>
                      {quest.is_active ? (
                        <Badge variant="secondary" className="text-[10px]">Active</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                      )}
                    </summary>
                    <div className="mt-3">
                      <QuestEditForm quest={quest} />
                    </div>
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <CardTitle className="text-base">Submission review</CardTitle>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href="/admin/quests">
                  <Button type="button" variant={activeStatus === "all" ? "default" : "outline"} size="sm">
                    All
                  </Button>
                </Link>
                <Link href="/admin/quests?status=pending">
                  <Button type="button" variant={activeStatus === "pending" ? "default" : "outline"} size="sm">
                    Pending
                  </Button>
                </Link>
                <Link href="/admin/quests?status=approved">
                  <Button type="button" variant={activeStatus === "approved" ? "default" : "outline"} size="sm">
                    Approved
                  </Button>
                </Link>
                <Link href="/admin/quests?status=rejected">
                  <Button type="button" variant={activeStatus === "rejected" ? "default" : "outline"} size="sm">
                    Rejected
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {submissions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                No submissions match the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-2 py-3 font-medium">Student</th>
                      <th className="px-2 py-3 font-medium">Quest</th>
                      <th className="px-2 py-3 font-medium">Evidence</th>
                      <th className="px-2 py-3 font-medium">Status</th>
                      <th className="px-2 py-3 font-medium">Submitted</th>
                      <th className="px-2 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 align-top">
                    {submissions.map((submission) => {
                      const quest = submission.quests as { title: string } | null;
                      return (
                        <tr key={submission.id} className="border-b border-border/60">
                          <td className="px-2 py-3">
                            <div className="font-medium">
                              {studentNameById.get(submission.student_id) ||
                                "Unknown student"}
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="font-medium">{quest?.title ?? "Unknown quest"}</div>
                          </td>
                          <td className="px-2 py-3 max-w-xs">
                            {(() => {
                              const href = toSafeExternalHref(submission.evidence_url);
                              return href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 break-all text-primary underline-offset-2 hover:underline"
                                >
                                  {new URL(href).hostname}
                                  <ExternalLink className="h-3 w-3" aria-hidden />
                                  <span className="sr-only">(opens in a new tab)</span>
                                </a>
                              ) : (
                                <span className="text-xs text-muted-foreground">Unsafe link hidden</span>
                              );
                            })()}
                            {submission.notes ? (
                              <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{submission.notes}</p>
                            ) : null}
                          </td>
                          <td className="px-2 py-3">
                            {statusBadge(submission.status)}
                          </td>
                          <td className="px-2 py-3 text-muted-foreground">
                            {formatTimestamp(submission.created_at)}
                          </td>
                          <td className="px-2 py-3">
                            {submission.status === "pending" ? (
                              <SubmissionReview submissionId={submission.id} />
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                {submission.status === "approved" ? "Approved" : "Rejected"}
                                {submission.rejection_reason && (
                                  <span className="text-rose-600 ml-1">({submission.rejection_reason})</span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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