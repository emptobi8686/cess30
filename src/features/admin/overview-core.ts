/** Extracts a row count from a PostgREST `{ count, head: true }` response (or a plain number). */
export function countOf(result: { count: number | null } | number | null | undefined): number {
  if (typeof result === "number") return result;
  return result?.count ?? 0;
}
