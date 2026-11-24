import Link from "next/link";
import { Medal } from "lucide-react";
import { DashboardShell } from "@/components/shared/dashboard-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeaderboard, getUserXpSummary } from "@/features/quests/queries";
import { LEADERBOARD_PERIODS, parseLeaderboardPeriod } from "@/features/quests/leaderboard";
import { requireUserSession } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage(props: PageProps<"/leaderboard">) {
  const user = await requireUserSession();
  const searchParams = await props.searchParams;
  const period = parseLeaderboardPeriod(searchParams.period);
  const periodLabel = LEADERBOARD_PERIODS.find((p) => p.value === period)?.label ?? "All time";

  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  let entries: LeaderboardEntry[] | null = null;
  try {
    entries = await getLeaderboard(period);
  } catch (error) {
    console.error("Leaderboard unavailable.", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }

  const mySummary = await getUserXpSummary(user.id).catch(() => null);
  const myEntry = entries?.find((entry) => entry.user_id === user.id) ?? null;

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
          description="XP earned from approved quests by verified students."
        />

        <nav aria-label="Ranking period" className="flex flex-wrap gap-2">
          {LEADERBOARD_PERIODS.map((p) => {
            const active = p.value === period;
            return (
              <Link
                key={p.value}
                href={p.value === "all-time" ? "/leaderboard" : `/leaderboard?period=${p.value}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {p.label}
              </Link>
            );
          })}
        </nav>

        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-base">Your progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Rank ({periodLabel.toLowerCase()})</p>
              <p className="text-2xl font-semibold">{myEntry ? `#${myEntry.rank}` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total XP (all time)</p>
              <p className="text-2xl font-semibold">{mySummary?.total_xp ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Quests completed</p>
              <p className="text-2xl font-semibold">{mySummary?.quests_completed ?? 0}</p>
            </div>
          </CardContent>
        </Card>

        {entries === null ? (
          <div role="status" className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
            Rankings are temporarily unavailable. Your own XP is shown above.
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            title="No XP earned yet"
            description="The leaderboard fills up when quest submissions are approved. Complete a quest, and you will appear here once a rep or admin approves it."
          />
        ) : (
          <Card className="border-border/80 bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Medal className="h-4 w-4 text-primary" aria-hidden />
                {periodLabel} rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th scope="col" className="px-2 py-3 font-medium">#</th>
                      <th scope="col" className="px-2 py-3 font-medium">Student</th>
                      <th scope="col" className="px-2 py-3 text-right font-medium">XP</th>
                      <th scope="col" className="px-2 py-3 text-right font-medium">Quests</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {entries.map((entry) => {
                      const isMe = entry.user_id === user.id;
                      return (
                        <tr key={entry.user_id} className={cn(isMe && "bg-primary/5")}>
                          <td className="px-2 py-3 font-mono">{entry.rank}</td>
                          <td className="px-2 py-3">
                            {entry.full_name}
                            {isMe ? <span className="ml-2 text-xs text-primary">(you)</span> : null}
                          </td>
                          <td className="px-2 py-3 text-right font-semibold">{entry.total_xp}</td>
                          <td className="px-2 py-3 text-right">{entry.quests_completed}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
