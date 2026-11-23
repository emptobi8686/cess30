import "server-only";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveAccess, type AccessContext, type CapabilityRow } from "@/lib/auth/access";
import { logServerError } from "@/lib/errors";

/**
 * Loads the current user's access context. Returns null when unauthenticated.
 * Roles are read as a list (never .maybeSingle()) so multi-role users resolve
 * correctly (audit finding BP-006).
 */
/** For admin-only pages inside the staff area (verification, staff, academic calendar). */
export async function requireAdminPage(): Promise<AccessContext> {
  const access = await getAccessContext();
  if (!access) redirect("/login");
  if (!access.isAdmin) redirect("/access-denied");
  return access;
}

export async function getAccessContext(): Promise<AccessContext | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const [
    { data: roleRows, error: rolesError },
    { data: profile, error: profileError },
    { data: capabilityRows, error: capabilityError },
  ] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("verification_status").eq("id", user.id).maybeSingle(),
    supabase.rpc("my_capabilities"),
  ]);

  if (rolesError) throw new Error("Could not load account roles.");
  if (profileError) throw new Error("Could not load account profile.");
  // Capabilities only widen navigation; failing closed (none) keeps students and admins working.
  if (capabilityError) logServerError("auth.myCapabilities", capabilityError);

  return resolveAccess(user.id, roleRows ?? [], profile ?? null, (capabilityRows ?? []) as CapabilityRow[]);
}
