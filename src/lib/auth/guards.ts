import { studentAccessLevel, type AccessContext } from "@/lib/auth/access";

/**
 * Authorization guards for server actions, route handlers and server components.
 *
 * This file is NOT a "use server" module on purpose: every export of a
 * "use server" module becomes a publicly callable server action, which must
 * never include test hooks.
 */

export const ACCESS_DENIED_MESSAGE = "You do not have access to this action.";

export type AccessNeed = "admin" | "read" | "full";

export class AccessDeniedError extends Error {
  readonly code: "unauthenticated" | "forbidden" | "suspended";

  constructor(code: "unauthenticated" | "forbidden" | "suspended") {
    super(ACCESS_DENIED_MESSAGE);
    this.name = "AccessDeniedError";
    this.code = code;
  }
}

/** Pure decision: returns the context when allowed, otherwise throws AccessDeniedError. */
export function assertAccess(ctx: AccessContext | null, need: AccessNeed): AccessContext {
  if (!ctx) throw new AccessDeniedError("unauthenticated");

  if (need === "admin") {
    if (!ctx.isAdmin) throw new AccessDeniedError("forbidden");
    return ctx;
  }

  const level = studentAccessLevel(ctx);
  if (level === "none") throw new AccessDeniedError("suspended");
  if (need === "full" && level !== "full") throw new AccessDeniedError("forbidden");
  return ctx;
}

type AccessResolver = () => Promise<AccessContext | null>;
let resolverOverride: AccessResolver | null = null;

/** Test-only hook. Throws outside NODE_ENV=test. */
export function setAccessResolverForTests(fn: AccessResolver | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("setAccessResolverForTests is only available in tests.");
  }
  resolverOverride = fn;
}

async function loadAccessContext(): Promise<AccessContext | null> {
  if (resolverOverride) return resolverOverride();
  // Imported lazily so this module stays importable from pure unit tests;
  // access-server is "server-only".
  const { getAccessContext } = await import("@/lib/auth/access-server");
  return getAccessContext();
}

export async function requireAdmin(): Promise<AccessContext> {
  return assertAccess(await loadAccessContext(), "admin");
}

export async function requireStudentAccess(need: "read" | "full"): Promise<AccessContext> {
  return assertAccess(await loadAccessContext(), need);
}

/** Maps any thrown error to an action-safe message (never leaks internals for access errors). */
export function accessErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AccessDeniedError) return ACCESS_DENIED_MESSAGE;
  return error instanceof Error ? error.message : fallback;
}
