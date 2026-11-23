import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

test.describe("admin quest management (BP-008, BP-009, BP-028)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("admin creates, then deactivates a quest", async ({ page }) => {
    const title = `E2E quest ${Date.now()}`;
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin/quests");

    await page.getByLabel("Title", { exact: true }).first().fill(title);
    await page.getByLabel("Description").first().fill("Write up the surveying field exercise.");
    // E4: choose who sees the quest (admin picker defaults to the whole department).
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await page.getByRole("button", { name: "Create quest" }).click();
    await expect(page.getByRole("status").first()).toHaveText(`Quest "${title}" created.`);

    const quest = page.locator("details", { hasText: title });
    await quest.locator("summary").click();
    await quest.getByLabel("Active").uncheck();
    await quest.getByRole("button", { name: "Save changes" }).click();
    await expect(quest.getByRole("status")).toHaveText("Quest saved.");
    await page.reload();
    await expect(page.locator("details", { hasText: title }).getByText("Inactive")).toBeVisible();
  });
});
