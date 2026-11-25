/** Titles earned with XP. Thresholds are total XP from approved quests. */
export const ENGINEER_RANKS = [
  { title: "Site Trainee", min: 0 },
  { title: "Surveyor", min: 100 },
  { title: "Site Engineer", min: 300 },
  { title: "Design Engineer", min: 700 },
  { title: "Structural Engineer", min: 1500 },
  { title: "Chief Engineer", min: 3000 },
] as const;

export type EngineerRank = {
  title: string;
  level: number;
  next: { title: string; min: number } | null;
  /** 0–1 through the current rank. */
  progress: number;
  /** XP still needed for the next rank (0 at the top). */
  toNext: number;
};

export function engineerRank(totalXp: number): EngineerRank {
  const xp = Number.isFinite(totalXp) && totalXp > 0 ? totalXp : 0;
  let index = 0;
  for (let i = 0; i < ENGINEER_RANKS.length; i++) if (xp >= ENGINEER_RANKS[i].min) index = i;
  const current = ENGINEER_RANKS[index];
  const next = ENGINEER_RANKS[index + 1] ?? null;
  if (!next) return { title: current.title, level: index + 1, next: null, progress: 1, toNext: 0 };
  return {
    title: current.title,
    level: index + 1,
    next: { title: next.title, min: next.min },
    progress: (xp - current.min) / (next.min - current.min),
    toNext: next.min - xp,
  };
}
