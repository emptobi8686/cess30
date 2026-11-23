import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveAccess, type AccessContext } from "@/lib/auth/access";

/**
 * Loads the current user's access context. Returns null when unauthenticated.
 * Roles are read as a list (never .maybeSingle()) so multi-role users resolve
 * correctly (audit finding BP-006).
 */
export async function getAccessContext(): Promise<AccessContext | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const [{ data: roleRows, error: rolesError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("profiles").select("verification_status").eq("id", user.id).maybeSingle(),
    ]);

  if (rolesError) throw new Error("Could not load account roles.");
  if (profileError) throw new Error("Could not load account profile.");

  return resolveAccess(user.id, roleRows ?? [], profile ?? null);
}
