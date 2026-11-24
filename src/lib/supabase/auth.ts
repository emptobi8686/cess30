import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * The signed-in user, verified once per request (React cache), so layouts, pages and
 * helpers that all need the user share one Supabase Auth round trip.
 * Uses getUser() (not getSession()) so the JWT is validated against the auth server,
 * not read from a potentially stale cookie.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return error ? null : user;
});

export async function requireUserSession() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
