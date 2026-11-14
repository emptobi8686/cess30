import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { AdminShell } from "@/components/shared/admin-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import {
  createQuestAction,
  updateQuestAction,
  reviewQuestSubmissionAction,
} from "@/features/quests/actions";
import {
  getAllQuestsAdmin,
  getAllQuestSubmissionsAdmin,
  getPendingQuestSubmissionsCount,
  getActiveQuestsCountAdmin,
} from "@/features/quests/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function handleCreateQuest(formData: FormData): Promise<void> {
  const result = await createQuestAction(formData);
  if (!result.ok) {
    console.error(result.error);
  }
}

async function handleUpdateQuest(formData: FormData): Promise<void> {
  const result = await updateQuestAction(formData);
  if (!result.ok) {
    console.error(result.error);
  }
}

async function handleReviewQuestSubmission(formData: FormData): Promise<void> {
  const result = await reviewQuestSubmissionAction(formData);
  if (!result.ok) {
    console.error(result.error);
  }
}

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
  const { data: studentProfiles } = await createServerSupabaseClient()
    .from("profiles")
    .select("id, full_name")
    .in("id", studentIds);
  const studentNameById = new Map(
    (studentProfiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown"])
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
            <form action={handleCreateQuest} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input name="title" placeholder="e.g. Submit lecture notes" required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Description</label>
                <Textarea name="description" placeholder="Describe what the student must do..." required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">XP reward</label>
                <Input type="number" name="xp_reward" min="1" max="10000" defaultValue="50" required />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Due date (optional)</label>
                <Input type="datetime-local" name="due_date" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  <input type="checkbox" name="is_active" defaultChecked /> Active
                </label>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Create quest</Button>
              </div>
            </form>
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
                  <div
                    key={quest.id}
                    className="flex items-center justify-between gap-3 p-3 border-b border-border/60 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">{quest.title}</div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {quest.description}
                      </p>
                      <div className="flex items-center gap-3 text-xs mt-1">
                        <span className="text-muted-foreground">+{quest.xp_reward} XP</span>
                        <span className="text-muted-foreground">
                          {quest.due_date ? new Date(quest.due_date).toLocaleDateString() : "No deadline"}
                        </span>
                        {quest.is_active ? (
                          <Badge variant="secondary" className="text-[10px]">Active</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                        )}
                      </div>
                    </div>
                    <form action={handleUpdateQuest} className="space-y-2">
                      <input type="hidden" name="questId" value={quest.id} />
                      <Input name="title" defaultValue={quest.title} className="w-40 text-xs" />
                      <Input
                        type="number"
                        name="xp_reward"
                        defaultValue={String(quest.xp_reward)}
                        min="1"
                        max="10000"
                        className="w-24 text-xs"
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          name="is_active"
                          defaultChecked={quest.is_active ?? false}
                        />
                        Active
                      </label>
                      <Button type="submit" variant="outline" size="sm">
                        Save
                      </Button>
                    </form>
                  </div>
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
                          <td className="px-2 py-3">
                            {statusBadge(submission.status)}
                          </td>
                          <td className="px-2 py-3 text-muted-foreground">
                            {new Date(submission.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-2 py-3">
                            {submission.status === "pending" ? (
                              <div className="flex flex-col gap-2">
                                <form action={handleReviewQuestSubmission} className="space-y-2">
                                  <input type="hidden" name="submissionId" value={submission.id} />
                                  <input type="hidden" name="new_status" value="approved" />
                                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <input type="checkbox" name="confirmed" required />
                                    Confirm approval
                                  </label>
                                  <Button type="submit" variant="default" size="sm" className="gap-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Approve
                                  </Button>
                                </form>
                                <form action={handleReviewQuestSubmission} className="space-y-2">
                                  <input type="hidden" name="submissionId" value={submission.id} />
                                  <input type="hidden" name="new_status" value="rejected" />
                                  <Textarea
                                    name="rejection_reason"
                                    rows={1}
                                    placeholder="Reason (12+ chars)"
                                    required
                                    className="h-10 text-xs"
                                  />
                                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <input type="checkbox" name="confirmed" required />
                                    Confirm rejection
                                  </label>
                                  <Button type="submit" variant="destructive" size="sm" className="gap-2">
                                    <XCircle className="h-4 w-4" />
                                    Reject
                                  </Button>
                                </form>
                              </div>
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