/**
 * Normalises a PostgREST embedded relation. Many-to-one embeds (e.g.
 * lecture_sessions → courses) arrive as an object; one-to-many as an array.
 */
export function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (relation == null) return null;
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation;
}
