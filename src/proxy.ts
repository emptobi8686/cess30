import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolveAccess } from "@/lib/auth/access";
import { routeAccessLevel, routeDecision } from "@/lib/auth/routes";

const COOKIE_NAME = "blueprint-auth";

/**
 * Coarse route guard (Next.js 16 `proxy` convention; `middleware` is deprecated).
 * Refreshes the Supabase session cookie, sends anonymous users to /login, and
 * applies the verification-state route policy from src/lib/auth/routes.ts.
 * Server actions, route handlers and RLS enforce access independently.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (routeAccessLevel(pathname) === "public") {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/access-denied", request.url));
  }

  const response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: {
      name: COOKIE_NAME,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("verification_status").eq("id", user.id).maybeSingle(),
  ]);

  const decision = routeDecision(resolveAccess(user.id, roleRows ?? [], profile ?? null), pathname);

  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/timetable/:path*",
    "/study-planner/:path*",
    "/announcements/:path*",
    "/quests/:path*",
    "/leaderboard/:path*",
    "/settings/:path*",
    "/notifications/:path*",
    "/admin/:path*",
    "/suspended/:path*",
  ],
};
