import type { LeaderboardPeriod } from "@/types";

export const LEADERBOARD_PERIODS: ReadonlyArray<{ value: LeaderboardPeriod; label: string }> = [
  { value: "all-time", label: "All time" },
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
];

/** Reads ?period= safely; anything unsupported means all-time. */
export function parseLeaderboardPeriod(value: string | string[] | undefined): LeaderboardPeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  return LEADERBOARD_PERIODS.some((p) => p.value === raw) ? (raw as LeaderboardPeriod) : "all-time";
}
