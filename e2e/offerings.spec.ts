import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

test.describe("course offerings (E2)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("offering courses twice is idempotent", async ({ page }) => {
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin/academic/offerings");
    test.skip(await page.getByText("Create a session and a semester first").isVisible(), "no semester configured");
    await page.getByLabel("Offer to level").selectOption("200");
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "Offer selected courses" }).click();
    await expect(page.getByRole("status").first()).toContainText("offering");
    await page.getByRole("checkbox").first().check();
    await page.getByRole("button", { name: "Offer selected courses" }).click();
    await expect(page.getByRole("status").first()).toContainText("already existed");
  });
});
