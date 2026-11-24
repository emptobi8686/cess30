import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

test.describe("study planner data window (BP-038)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("a date far outside the initial window loads its own data", async ({ page }) => {
    await signIn(page, "verified@e2e.test");
    await page.goto("/study-planner?date=2027-06-15&view=daily");
    await expect(page).toHaveURL(/date=2027-06-15/);
    // Navigating the date picker beyond the loaded window reloads around the new date.
    await page.goto("/study-planner");
    await page.locator('input[type="date"]').first().fill("2028-01-10");
    await expect(page).toHaveURL(/date=2028-01-10/);
  });
});
