import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Verifies the authenticated user via a secure server-to-Supabase request.
 * Uses getUser() (not getSession()) so the JWT is validated against the auth server,
 * not read from a potentially stale cookie.
 */
export async function requireUserSession() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return user;
}
