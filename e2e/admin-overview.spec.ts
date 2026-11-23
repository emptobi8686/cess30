import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

test.describe("admin overview (BP-025)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("statistics render as numbers, never [object Object]", async ({ page }) => {
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin");
    await expect(page.getByText("[object Object]")).toHaveCount(0);
    await expect(page.getByText("Matric reviews awaiting decision")).toBeVisible();
  });
});
