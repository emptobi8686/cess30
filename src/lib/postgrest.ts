/**
 * Helpers for building PostgREST filter strings from user input (audit finding BP-041).
 *
 * In `.or("col.ilike.<value>,...")` the value is parsed by PostgREST: commas and
 * parentheses split or nest conditions. Double-quoting the value makes them literal;
 * inside quotes, `\` and `"` must be backslash-escaped.
 */

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function quoteForPostgrest(value: string): string {
  return `"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
}

/** Literal (wildcard-free) ilike operand, quoted for PostgREST. */
export function escapeIlikeValue(value: string): string {
  return quoteForPostgrest(escapeLikePattern(value));
}

const MAX_SEARCH_LENGTH = 60;

/** "contains" search over name and matric number; null when there is nothing to search. */
export function buildVerificationSearchFilter(query: string): string | null {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length > MAX_SEARCH_LENGTH) return null;
  const operand = quoteForPostgrest(`%${escapeLikePattern(trimmed)}%`);
  return `full_name.ilike.${operand},matric_number.ilike.${operand}`;
}
