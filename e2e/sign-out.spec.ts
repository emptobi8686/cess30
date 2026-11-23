import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

test.describe("sign-out (BP-010)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("account menu signs the student out", async ({ page }) => {
    await signIn(page, "verified@e2e.test");
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Vera Verified/ }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("settings page signs the student out", async ({ page }) => {
    await signIn(page, "verified@e2e.test");
    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("admin menu signs the admin out", async ({ page }) => {
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin");
    await page.getByRole("button", { name: /Ada Admin|Admin/ }).first().click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
