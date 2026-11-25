import { engineerRank } from "@/features/quests/ranks";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/types";

/**
 * The top three as building piers rising from a ground line; height follows XP.
 * Decorative: the rankings table below carries the same data for screen readers.
 */
export function LeaderboardPodium({
  entries,
  currentUserId,
  showTitles,
}: {
  entries: LeaderboardEntry[];
  currentUserId: string;
  /** Titles follow all-time XP, so they are hidden for weekly and monthly rankings. */
  showTitles: boolean;
}) {
  const top = entries.slice(0, 3);
  if (top.length === 0) return null;
  const max = Math.max(...top.map((e) => e.total_xp), 1);
  // Second, first, third, so the leader stands in the middle.
  const order = [top[1], top[0], top[2]].filter((e): e is LeaderboardEntry => Boolean(e));
  const delay: Record<number, number> = { 1: 250, 2: 100, 3: 0 };

  return (
    <div aria-hidden className="rounded-xl border border-border/80 bg-card px-4 pt-6" data-testid="podium">
      <div className="mx-auto flex max-w-md items-end justify-center gap-3 sm:gap-6">
        {order.map((entry) => {
          const isMe = entry.user_id === currentUserId;
          const height = 48 + Math.round((entry.total_xp / max) * 112);
          return (
            <div key={entry.user_id} className="flex w-24 flex-col items-center gap-1 sm:w-28">
              <p className={cn("w-full truncate text-center text-sm font-medium", isMe && "text-primary")}>
                {entry.full_name.split(" ")[0]}
              </p>
              {showTitles ? (
                <p className="text-[11px] text-muted-foreground">{engineerRank(entry.total_xp).title}</p>
              ) : null}
              <div
                className={cn(
                  "pier-rise flex w-full flex-col items-center justify-start rounded-t-md border-2 border-b-0 pt-2",
                  entry.rank === 1
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-primary/50 bg-primary/10 text-foreground"
                )}
                style={{ height, animationDelay: `${delay[entry.rank] ?? 0}ms` }}
              >
                <span className="text-2xl font-semibold tabular-nums">{entry.rank}</span>
                <span className="text-xs tabular-nums opacity-80">{entry.total_xp} XP</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="h-px bg-primary/40" />
    </div>
  );
}
