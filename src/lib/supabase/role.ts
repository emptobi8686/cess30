import { getAccessContext } from "@/lib/auth/access-server";

/**
 * @deprecated Use getAccessContext() / guards in "@/lib/auth/guards".
 * Kept for backwards compatibility; resolves multi-role users correctly.
 */
export async function getCurrentUserRole(): Promise<"admin" | "student" | null> {
  const ctx = await getAccessContext();
  if (!ctx) return null;
  return ctx.isAdmin ? "admin" : "student";
}
