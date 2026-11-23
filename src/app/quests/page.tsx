import { DashboardShell } from "@/components/shared/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUserSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getActiveQuests,
  getMyQuestSubmissions,
  getUserXpSummary,
} from "@/features/quests/queries";
import { submitQuestAction } from "@/features/quests/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trophy, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

export const dynamic = "force-dynamic";

async function handleSubmitQuest(formData: FormData): Promise<void> {
  const result = await submitQuestAction(formData);
  if (!result.ok) {
    console.error(result.error);
  }
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

export default async function QuestsPage() {
  const user = await requireUserSession();
  const supabase = await createServerSupabaseClient();

  const [quests, submissions, xpSummary] = await Promise.all([
    getActiveQuests(),
    getMyQuestSubmissions(),
    getUserXpSummary(user.id),
  ]);

  const submissionByQuest = new Map(
    (submissions ?? []).map((s) => [s.quest_id, s])
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const totalXp = xpSummary.total_xp;
  const questsCompleted = xpSummary.quests_completed;

  return (
    <DashboardShell
      currentLabel="Quests"
      displayName={profile?.full_name}
      avatarUrl={profile?.avatar_url ?? null}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <PageHeader
              eyebrow="Quests"
              title="Participation and submissions"
              description="Complete verified academic quests and submit evidence to earn XP."
            />
          </div>
          <div className="flex items-center gap-3">
            <Card className="p-3">
              <CardContent className="p-0">
                <div className="flex flex-col items-center gap-1">
                  <Trophy className="h-5 w-5 text-primary" />
                  <p className="text-xs font-semibold text-foreground">{totalXp}</p>
                  <p className="text-[10px] text-muted-foreground">Total XP</p>
                </div>
              </CardContent>
            </Card>
            <Card className="p-3">
              <CardContent className="p-0">
                <div className="flex flex-col items-center gap-1">
                  <span className="h-5 w-5 text-emerald-600">&#10003;</span>
                  <p className="text-xs font-semibold text-foreground">{questsCompleted}</p>
                  <p className="text-[10px] text-muted-foreground">Quests completed</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {quests.length === 0 ? (
          <EmptyState
            title="No active quests"
            description="There are no active quests available right now. Check back later."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quests.map((quest) => {
              const submission = submissionByQuest.get(quest.id);
              const alreadySubmitted = !!submission;
              const isOverdue = Boolean(quest.due_date && new Date(quest.due_date) < new Date());

              return (
                <Card key={quest.id} className="border-border/80 bg-card hover:border-primary/40 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                    <CardTitle className="text-base font-semibold">{quest.title}</CardTitle>
                    {isOverdue && (
                      <Badge variant="destructive" className="text-[10px]">
                        Expired
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {quest.description}
                    </p>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold text-foreground">
                          +{quest.xp_reward} XP
                        </span>
                      </div>
                      {quest.due_date && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className={cn(
                            "text-muted-foreground",
                            isOverdue ? "text-rose-600" : ""
                          )}>
                            {new Date(quest.due_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {alreadySubmitted ? (
                      <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                        <span className="text-xs font-medium text-muted-foreground">
                          Your submission:
                        </span>
                        {statusBadge(submission!.status)}
                        {submission!.status === "rejected" && submission!.rejection_reason && (
                          <p className="text-xs text-rose-600 mt-1">
                            {submission!.rejection_reason}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Dialog>
                        <DialogTrigger
                          render={
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isOverdue}
                              className="w-full"
                            />
                          }
                        >
                          {isOverdue ? "Expired" : "Submit evidence"}
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Submit evidence for &quot;{quest.title}&quot;</DialogTitle>
                            <DialogDescription>
                              Provide a link to your evidence of completion.
                            </DialogDescription>
                          </DialogHeader>
                          <form action={handleSubmitQuest} className="space-y-4 mt-4">
                            <input type="hidden" name="quest_id" value={quest.id} />
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground">
                                Evidence URL
                              </label>
                              <Input
                                name="evidence_url"
                                placeholder="https://..."
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-medium text-muted-foreground">
                                Notes (optional)
                              </label>
                              <Textarea
                                name="notes"
                                rows={2}
                                placeholder="Any additional context for reviewers..."
                              />
                            </div>
                            <DialogFooter>
                              <Button type="button" variant="outline" size="sm" className="ml-auto">
                                Cancel
                              </Button>
                              <Button type="submit" size="sm" disabled={isOverdue}>
                                Submit
                              </Button>
                            </DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}