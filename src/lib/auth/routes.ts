import { studentAccessLevel, type AccessContext } from "@/lib/auth/access";

/**
 * Route-level access policy (audit spec Part 3.3, decision 0004 default):
 *   pending / rejected → read-only routes (dashboard, timetable, announcements,
 *                        notifications, settings incl. profile/verification)
 *   suspended          → only /suspended (plus public pages and sign-out)
 *   verified           → every student route
 *   admin              → /admin/*, plus student routes per their own verification status
 *
 * This is coarse navigation control. Server actions, route handlers and RLS
 * enforce access independently.
 */

export type RouteLevel = "public" | "read" | "full" | "admin" | "suspended-page";

export type RouteDecision =
  | { action: "allow" }
  | { action: "redirect"; to: "/suspended" | "/access-denied" | "/dashboard" };

const READ_ROUTES = [
  "/dashboard",
  "/timetable",
  "/announcements",
  "/notifications",
  "/settings",
] as const;

const FULL_ROUTES = ["/study-planner", "/quests", "/leaderboard"] as const;

function matches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function routeAccessLevel(pathname: string): RouteLevel {
  if (matches(pathname, "/admin")) return "admin";
  if (matches(pathname, "/suspended")) return "suspended-page";
  if (FULL_ROUTES.some((base) => matches(pathname, base))) return "full";
  if (READ_ROUTES.some((base) => matches(pathname, base))) return "read";
  return "public";
}

export function routeDecision(ctx: AccessContext, pathname: string): RouteDecision {
  const level = routeAccessLevel(pathname);
  const studentLevel = studentAccessLevel(ctx);

  switch (level) {
    case "public":
      return { action: "allow" };
    case "admin":
      return ctx.isAdmin ? { action: "allow" } : { action: "redirect", to: "/access-denied" };
    case "suspended-page":
      return studentLevel === "none"
        ? { action: "allow" }
        : { action: "redirect", to: "/dashboard" };
    case "read":
      return studentLevel === "none"
        ? { action: "redirect", to: "/suspended" }
        : { action: "allow" };
    case "full":
      if (studentLevel === "none") return { action: "redirect", to: "/suspended" };
      return studentLevel === "full" ? { action: "allow" } : { action: "redirect", to: "/dashboard" };
  }
}

/** Paths the proxy must run on (static so Next can analyse the matcher). */
export const PROTECTED_PREFIXES = [...READ_ROUTES, ...FULL_ROUTES, "/admin", "/suspended"] as const;
