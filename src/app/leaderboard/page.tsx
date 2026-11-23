import { DashboardShell } from "@/components/shared/dashboard-shell";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUserSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAccessContext } from "@/lib/auth/access-server";
import {
  getLeaderboard,
  getLeaderboardEntry,
  getUserXpSummary,
} from "@/features/quests/queries";
import type { LeaderboardEntry, LeaderboardPeriod } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PERIODS: Array<{ value: LeaderboardPeriod; label: string }> = [
  { value: "all-time", label: "All time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const user = await requireUserSession();
  const access = await getAccessContext();
  const supabase = await createServerSupabaseClient();

  // Fetch profile for display name.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = access?.isAdmin ?? false;

  // Determine the active period from a default (all-time). In a future
  // enhancement this could come from searchParams, but here we render all
  // three periods so students always see comparative data.
  const [allTime, weekly, monthly] = await Promise.all([
    getLeaderboard("all-time"),
    getLeaderboard("weekly"),
    getLeaderboard("monthly"),
  ]);

  const myAllTime = await getLeaderboardEntry(user.id, "all-time");
  const myXpSummary = await getUserXpSummary(user.id);

  // Find the current user's entry in each period.
  const myEntry = allTime.find((e) => e.user_id === user.id) ?? null;
  const myWeekly = weekly.find((e) => e.user_id === user.id) ?? null;
  const myMonthly = monthly.find((e) => e.user_id === user.id) ?? null;

  const hasAnyXp = allTime.length > 0 || weekly.length > 0 || monthly.length > 0;

  return (
    <DashboardShell
      currentLabel="Leaderboard"
      displayName={profile?.full_name}
      avatarUrl={profile?.avatar_url ?? null}
    >
      <div className="space-y-6">
        <PageHeader
          eyebrow="Leaderboard"
          title="Participation overview"
          description={
            isAdmin
              ? "Verified student activity and XP rankings across all quests."
              : "Compare your XP and quest progress with other students."
          }
        />

        {/* Period filter (admin only shows all three; students see their rank in each) */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Ranking period
          </p>
          <div className="flex gap-1">
            {PERIODS.map((p) => {
              const entries =
                p.value === "all-time"
                  ? allTime
                  : p.value === "weekly"
                    ? weekly
                    : monthly;
              const myRank = entries.find((e) => e.user_id === user.id)?.rank;
              return (
                <Button
                  key={p.value}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "text-xs px-3 py-1.5",
                    myRank ? "bg-primary text-primary-foreground" : ""
                  )}
                >
                  {p.label} {myRank ? `(#${myRank})` : ""}
                </Button>
              );
            })}
          </div>
        </div>

        {!hasAnyXp ? (
          <EmptyState
            title="No XP earned yet"
            description={
              isAdmin
                ? "No students have earned XP through quests yet."
                : "Complete quests to start earning XP and appear on the leaderboard."
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {/* All-time leaderboard card */}
            <Card className="border-border/80 bg-card col-span-1 md:col-span-2 lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">All-time XP leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="px-2 py-3 font-medium">#</th>
                        <th className="px-2 py-3 font-medium">Student</th>
                        <th className="px-2 py-3 font-medium text-right">Total XP</th>
                        <th className="px-2 py-3 font-medium text-right">Quests</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {allTime.map((entry) => {
                        const isMe = entry.user_id === user.id;
                        return (
                          <tr
                            key={entry.user_id}
                            className={cn("align-top", isMe ? "bg-primary/5" : "")}
                          >
                            <td className="px-2 py-3 font-mono text-xs font-semibold">
                              {entry.rank}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-2">
                                {entry.avatar_url ? (
                                  <img
                                    src={entry.avatar_url}
                                    alt={entry.full_name}
                                    className="h-6 w-6 rounded-full object-cover border border-border/60"
                                  />
                                ) : (
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Trophy className="h-3 w-3" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium">{entry.full_name}</div>
                                  {isMe && (
                                    <span className="text-[10px] text-muted-foreground ml-1">
                                      (You)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3 text-right">
                              <span className={cn(
                                "font-semibold text-foreground",
                                isMe ? "text-primary" : ""
                              )}>
                                {entry.total_xp}
                              </span>
                            </td>
                            <td className="px-2 py-3 text-right">
                              <span className="text-muted-foreground">
                                {entry.quests_completed}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing {allTime.length} student(s) with XP earned.
                </p>
              </CardContent>
            </Card>

            {/* Personal XP summary card */}
            <Card className="border-border/80 bg-card col-span-1 md:col-span-1 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Your progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col items-center gap-1">
                    <Trophy className="h-6 w-6 text-primary" />
                    <p className="text-xs font-semibold text-foreground">
                      {myXpSummary.total_xp}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Total XP</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="h-6 w-6 text-emerald-600">&#10003;</span>
                    <p className="text-xs font-semibold text-foreground">
                      {myXpSummary.quests_completed}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Quests completed</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="h-6 w-6 text-muted-foreground">#</span>
                    <p className="text-xs font-semibold text-foreground">
                      {myEntry?.rank ?? "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">All-time rank</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="h-6 w-6 text-muted-foreground">#</span>
                    <p className="text-xs font-semibold text-foreground">
                      {myWeekly?.rank ?? "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Weekly rank</p>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="h-6 w-6 text-muted-foreground">#</span>
                    <p className="text-xs font-semibold text-foreground">
                      {myMonthly?.rank ?? "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Monthly rank</p>
                  </div>
                  <div className="sm:col-span-2">
                    {myEntry ? (
                      <div className="rounded-lg bg-muted/50 border border-border/60 p-3">
                        <p className="text-xs text-muted-foreground">
                          Your position in the all-time leaderboard
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          Rank {myEntry.rank} of {allTime.length}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-muted/50 border border-border/60 p-3">
                        <p className="text-xs text-muted-foreground">
                          Complete quests to earn XP and appear on the leaderboard.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weekly and monthly leaderboards (admin: full tables; students: compact)} */}
            {isAdmin && (
              <div className="col-span-1 md:col-span-1 lg:col-span-3">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { label: "Weekly", entries: weekly, period: "weekly" as const },
                    { label: "Monthly", entries: monthly, period: "monthly" as const },
                  ].map(({ label, entries, period }) => (
                    <Card
                      key={period}
                      className="border-border/80 bg-card"
                    >
                      <CardHeader>
                        <CardTitle className="text-sm">{label} XP leaderboard</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {entries.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No XP earned this {label.toLowerCase()}.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-border text-muted-foreground">
                                  <th className="px-2 py-2 font-medium">#</th>
                                  <th className="px-2 py-2 font-medium">Student</th>
                                  <th className="px-2 py-2 font-medium text-right">XP</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {entries.slice(0, 10).map((entry) => {
                                  const isMe = entry.user_id === user.id;
                                  return (
                                    <tr
                                      key={entry.user_id}
                                      className={cn(
                                        "align-top",
                                        isMe ? "bg-primary/5" : ""
                                      )}
                                    >
                                      <td className="px-2 py-2 font-mono text-[10px] font-semibold">
                                        {entry.rank}
                                      </td>
                                      <td className="px-2 py-2">
                                        <div className="font-medium">
                                          {entry.full_name}
                                          {isMe && (
                                            <span className="text-[10px] text-muted-foreground ml-1">
                                              (You)
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-2 py-2 text-right">
                                        <span className="text-muted-foreground">
                                          {entry.total_xp}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          Showing top {Math.min(10, entries.length)} of {entries.length}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}