/**
 * Maps database/auth errors to user-safe messages (audit findings BP-021, BP-022).
 * Raw driver messages are never returned to users; log them with logServerError.
 */

export type ErrorContext = "matric" | "course" | "announcement" | "lecture" | "study" | "quest" | "profile" | "generic";

const GENERIC = "Something went wrong. Please try again.";

const UNIQUE_BY_CONTEXT: Partial<Record<ErrorContext, string>> = {
  matric: "This matriculation number is already registered. Contact your course representative.",
  course: "A course with this code already exists.",
  lecture: "An identical session already exists for this course, date and time.",
};

const BY_CODE: Record<string, string> = {
  "23503": "This item is referenced elsewhere and cannot be removed.",
  "42501": "You do not have permission to perform this action.",
  "22P02": "The request contained an invalid identifier.",
  "23514": "Some values are outside the allowed limits.",
};

function codeOf(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : null;
  }
  return null;
}

export function toUserError(error: unknown, context: ErrorContext): string {
  const code = codeOf(error);
  if (code === "23505") return UNIQUE_BY_CONTEXT[context] ?? "This item already exists.";
  if (code && BY_CODE[code]) return BY_CODE[code];
  return GENERIC;
}

/** Logs the full error server-side and returns a short reference for support. */
export function logServerError(scope: string, error: unknown): string {
  const ref = `err_${Math.random().toString(36).slice(2, 8).padEnd(6, "0")}`;
  const message = error instanceof Error ? error.message : (error as { message?: string } | null)?.message;
  console.error("Server action failed.", { scope, ref, code: codeOf(error), message: message?.slice(0, 300) });
  return ref;
}

/** For ActionResult-returning actions: logs the error and returns a safe failure. */
export function actionError(scope: string, error: unknown, context: ErrorContext): { ok: false; error: string } {
  logServerError(scope, error);
  return { ok: false, error: toUserError(error, context) };
}
