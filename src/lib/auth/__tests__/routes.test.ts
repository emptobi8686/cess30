import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolveAccess } from "@/lib/auth/access";
import { routeAccessLevel, routeDecision } from "@/lib/auth/routes";

const ctx = (status: string, roles: string[] = []) =>
  resolveAccess("u1", roles.map((role) => ({ role })), { verification_status: status });

describe("routeAccessLevel", () => {
  const cases: Array<[string, ReturnType<typeof routeAccessLevel>]> = [
    ["/", "public"],
    ["/login", "public"],
    ["/dashboard", "read"],
    ["/timetable", "read"],
    ["/announcements", "read"],
    ["/notifications", "read"],
    ["/settings", "read"],
    ["/settings/profile", "read"],
    ["/settings/notifications", "read"],
    ["/welcome", "read"],
    ["/study-planner", "full"],
    ["/quests", "full"],
    ["/leaderboard", "full"],
    ["/library", "full"],
    ["/tutorials", "full"],
    ["/admin", "staff"],
    ["/admin/quests", "staff"],
    ["/admin/verifications", "admin"],
    ["/admin/staff", "admin"],
    ["/admin/academic/sessions", "admin"],
    ["/admin/academic/review", "admin"],
    ["/admin/academic/placements", "staff"],
    ["/suspended", "suspended-page"],
    ["/dashboardx", "public"],
  ];
  for (const [path, level] of cases) {
    test(`${path} → ${level}`, () => assert.equal(routeAccessLevel(path), level));
  }
});

describe("routeDecision", () => {
  const allow = { action: "allow" } as const;
  const to = (path: string) => ({ action: "redirect", to: path });

  test("verified student may use full routes", () => {
    assert.deepEqual(routeDecision(ctx("verified"), "/study-planner"), allow);
  });
  test("pending student on a full route goes to the dashboard", () => {
    assert.deepEqual(routeDecision(ctx("pending"), "/study-planner"), to("/dashboard"));
  });
  test("rejected student may read the profile page", () => {
    assert.deepEqual(routeDecision(ctx("rejected"), "/settings/profile"), allow);
  });
  test("rejected student on quests goes to the dashboard", () => {
    assert.deepEqual(routeDecision(ctx("rejected"), "/quests"), to("/dashboard"));
  });
  test("suspended student on any protected route goes to /suspended", () => {
    for (const path of ["/dashboard", "/timetable", "/study-planner", "/settings"]) {
      assert.deepEqual(routeDecision(ctx("suspended"), path), to("/suspended"), path);
    }
  });
  test("suspended student may view /suspended", () => {
    assert.deepEqual(routeDecision(ctx("suspended"), "/suspended"), allow);
  });
  test("non-suspended user visiting /suspended goes to the dashboard", () => {
    assert.deepEqual(routeDecision(ctx("verified"), "/suspended"), to("/dashboard"));
  });
  test("non-admin on admin routes is denied", () => {
    assert.deepEqual(routeDecision(ctx("verified"), "/admin"), to("/access-denied"));
  });
  test("admin who is pending as a student may use admin routes", () => {
    assert.deepEqual(routeDecision(ctx("pending", ["student", "admin"]), "/admin/quests"), allow);
  });
  test("admin who is suspended as a student keeps admin access but not student routes", () => {
    const admin = ctx("suspended", ["admin"]);
    assert.deepEqual(routeDecision(admin, "/admin"), allow);
    assert.deepEqual(routeDecision(admin, "/dashboard"), to("/suspended"));
  });
  test("public routes are always allowed", () => {
    assert.deepEqual(routeDecision(ctx("suspended"), "/"), allow);
  });
});

describe("course representative routes (decision 0004)", () => {
  const rep = resolveAccess("u2", [{ role: "student" }], { verification_status: "verified" }, [
    { capability: "level_coordinator", level_code: "200" },
  ]);

  test("lets a course rep into the scoped admin area", () => {
    for (const path of ["/admin", "/admin/timetable", "/admin/courses", "/admin/academic/placements", "/admin/quests"]) {
      assert.deepEqual(routeDecision(rep, path), { action: "allow" }, path);
    }
  });

  test("keeps verification, staff and the calendar admin-only", () => {
    for (const path of ["/admin/verifications", "/admin/staff", "/admin/academic/sessions"]) {
      assert.deepEqual(routeDecision(rep, path), { action: "redirect", to: "/access-denied" }, path);
      assert.deepEqual(routeDecision(ctx("verified", ["admin"]), path), { action: "allow" }, path);
    }
  });

  test("a student with no capability still cannot reach /admin", () => {
    assert.deepEqual(routeDecision(ctx("verified"), "/admin/timetable"), { action: "redirect", to: "/access-denied" });
  });
});
