import { createClient } from "@/lib/supabase/client";
import { authCallbackUrl, authRedirectOrigin } from "@/lib/auth/redirect-origin";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function signInWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured()) {
    return {
      error: { message: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to continue." },
    };
  }

  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogle(options?: { redirectTo?: string }) {
  if (!isSupabaseConfigured()) {
    return {
      error: { message: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to continue." },
    };
  }

  const supabase = createClient();
  const siteUrl = authRedirectOrigin(
    typeof window !== "undefined" ? window.location.origin : null,
    process.env.NEXT_PUBLIC_SITE_URL
  );

  const next = options?.redirectTo ?? "/dashboard";

  // Sign-in and sign-up are the same with Google: a first sign-in creates the account.
  // Only basic profile scopes are requested (no offline access), and the account chooser
  // is always shown so students on shared phones/lab PCs pick the right Google account.
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authCallbackUrl(siteUrl, next),
      queryParams: { prompt: "select_account" },
    },
  });
}

export async function signUpWithEmail(
  email: string,
  password: string,
  metadata: Record<string, string>
) {
  if (!isSupabaseConfigured()) {
    return {
      error: { message: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to continue." },
    };
  }

  const supabase = createClient();
  const siteUrl = authRedirectOrigin(
    typeof window !== "undefined" ? window.location.origin : null,
    process.env.NEXT_PUBLIC_SITE_URL
  );

  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
      data: metadata,
    },
  });
}

export async function resetPassword(email: string) {
  if (!isSupabaseConfigured()) {
    return {
      error: { message: "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to continue." },
    };
  }

  const supabase = createClient();
  const siteUrl = authRedirectOrigin(
    typeof window !== "undefined" ? window.location.origin : null,
    process.env.NEXT_PUBLIC_SITE_URL
  );

  return supabase.auth.resetPasswordForEmail(email, {
    // The confirmation route verifies the recovery token and then forwards to
    // the set-password page. Keeping `next` relative also prevents open redirects.
    redirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent("/reset-password/update")}`,
  });
}

export async function signOutUser() {
  if (!isSupabaseConfigured()) {
    return { error: { message: "Supabase is not configured yet." } };
  }

  const supabase = createClient();
  return supabase.auth.signOut();
}
