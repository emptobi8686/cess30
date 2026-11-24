import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

test.describe("leaderboard periods (BP-027)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("selected period is marked current; invalid period falls back", async ({ page }) => {
    await signIn(page, "verified@e2e.test");
    await page.goto("/leaderboard?period=weekly");
    await expect(page.getByRole("link", { name: "This week" })).toHaveAttribute("aria-current", "page");
    await page.goto("/leaderboard?period=garbage");
    await expect(page.getByRole("link", { name: "All time" })).toHaveAttribute("aria-current", "page");
  });
});
