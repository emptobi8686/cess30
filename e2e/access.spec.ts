import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

test.describe("verification-state route enforcement (BP-005)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("pending student is sent from a full route to the dashboard", async ({ page }) => {
    await signIn(page, "pending@e2e.test");
    await page.goto("/study-planner");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("suspended student lands on /suspended", async ({ page }) => {
    await signIn(page, "suspended@e2e.test");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/suspended$/);
    await expect(page.getByRole("heading", { name: "Account suspended" })).toBeVisible();
  });

  test("verified student reaches the study planner", async ({ page }) => {
    await signIn(page, "verified@e2e.test");
    await page.goto("/study-planner");
    await expect(page).toHaveURL(/\/study-planner$/);
  });

  test("admin with student and admin roles reaches /admin (BP-006)", async ({ page }) => {
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin$/);
  });
});
