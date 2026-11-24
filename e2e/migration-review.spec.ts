import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

// E4: a legacy "level" announcement stays hidden until an admin chooses its level.
test.describe("migration review (E4)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("admin resolves a legacy level announcement", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-desktop", "state-changing journey runs on one project");
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin/academic/review");
    await page.getByLabel("Level for Legacy level notice").selectOption("200");
    await page.getByRole("button", { name: "Resolve Legacy level notice" }).click();
    await expect(page.getByText("Resolved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Level for Legacy level notice")).toHaveCount(0);
    await page.goto("/admin/announcements");
    await expect(page.getByText("Level 200").first()).toBeVisible();
  });
});
