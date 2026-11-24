/** Watch progress: never decreases, capped at 100, completed from 90% (and stays completed). */
export function nextProgress(
  prev: { percent: number; status: string } | null,
  positionSeconds: number,
  durationSeconds: number
): { percent: number; status: "in_progress" | "completed"; lastPosition: number } {
  const position = Math.max(0, Math.floor(positionSeconds));
  const raw = durationSeconds > 0 ? (position / durationSeconds) * 100 : 0;
  const percent = Math.min(100, Math.max(prev?.percent ?? 0, Math.round(raw * 100) / 100));
  const completed = prev?.status === "completed" || percent >= 90;
  return { percent, status: completed ? "completed" : "in_progress", lastPosition: position };
}
