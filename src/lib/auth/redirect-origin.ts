/**
 * Where Supabase should send the browser back to after Google (or an email link).
 * The page the student is on wins, so sign-in works the same on localhost, Vercel
 * previews and production without per-environment settings; NEXT_PUBLIC_SITE_URL
 * is only the fallback for server-side callers. Every origin used here must also be
 * listed in Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export function authRedirectOrigin(windowOrigin?: string | null, siteUrl?: string | null): string {
  const pick = windowOrigin || siteUrl || "http://localhost:3000";
  return pick.replace(/\/+$/, "");
}

/** The OAuth callback URL, carrying a relative `next` path (validated again server-side). */
export function authCallbackUrl(origin: string, next: string): string {
  return `${origin}/auth/confirm?next=${encodeURIComponent(next)}`;
}

/** Profiles without a matric number finish setting up before entering the app. */
export function postSignInPath(next: string, profile: { matric_number: string | null } | null): string {
  if (profile && !profile.matric_number) return `/welcome?next=${encodeURIComponent(next)}`;
  return next;
}
