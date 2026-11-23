import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

const WCAG = ["wcag2a", "wcag2aa"];

test.describe("accessibility: public pages (BP-036)", () => {
  for (const path of ["/", "/login", "/register", "/reset-password", "/this-does-not-exist"]) {
    test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }
});

test.describe("accessibility: authenticated pages (BP-036)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  const pages: Array<[string, string]> = [
    ["verified@e2e.test", "/dashboard"],
    ["verified@e2e.test", "/timetable"],
    ["verified@e2e.test", "/study-planner"],
    ["verified@e2e.test", "/quests"],
    ["verified@e2e.test", "/leaderboard"],
    ["verified@e2e.test", "/settings/profile"],
    ["admin@e2e.test", "/admin"],
    ["admin@e2e.test", "/admin/quests"],
    ["admin@e2e.test", "/admin/verifications"],
    ["admin@e2e.test", "/admin/courses"],
  ];
  for (const [account, path] of pages) {
    test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
      await signIn(page, account);
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }
});
