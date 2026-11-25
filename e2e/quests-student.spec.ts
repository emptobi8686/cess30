import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

test.describe("student quest submission and cancellation (BP-009, BP-029)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");
  test.describe.configure({ mode: "serial" });

  const title = `E2E open quest ${Date.now()}`;

  test("admin publishes a quest", async ({ page }) => {
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin/quests");
    await page.getByLabel("Title", { exact: true }).first().fill(title);
    await page.getByLabel("Description").first().fill("Upload a link to your drawing sheet.");
    // E4: choose who sees the quest (admin picker defaults to the whole department).
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await page.getByRole("button", { name: "Create quest" }).click();
    await expect(page.getByRole("status").first()).toContainText("created");
  });

  test("verified student submits, sees pending, cancels and can resubmit", async ({ page }) => {
    await signIn(page, "verified@e2e.test");
    await page.goto("/quests");
    const card = page.locator("div", { hasText: title }).filter({ has: page.getByRole("button", { name: "Submit evidence" }) }).last();
    await card.getByRole("button", { name: "Submit evidence" }).click();
    await page.getByLabel("Or paste a link").fill("https://drive.google.com/e2e-evidence");
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByRole("status").first()).toContainText("Evidence submitted");

    await page.reload();
    await page.getByRole("button", { name: "Cancel submission" }).first().click();
    await expect(page.getByRole("status").first()).toHaveText("Submission cancelled.");
    await page.reload();
    await expect(page.getByRole("button", { name: "Submit evidence" }).first()).toBeVisible();
  });
});
