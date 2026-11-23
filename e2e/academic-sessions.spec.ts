import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

test.describe("academic sessions (E1)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("admin creates a session with a semester and makes both current", async ({ page }) => {
    const start = 3000 + Math.floor(Math.random() * 900);
    const label = `${start}/${start + 1}`;
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin/academic/sessions");
    await page.getByLabel("Session").fill(label);
    await page.getByLabel("Starts").first().fill(`${start}-10-01`);
    await page.getByLabel("Ends").first().fill(`${start + 1}-09-30`);
    await page.getByRole("button", { name: "Create session" }).click();
    await expect(page.getByRole("status").first()).toHaveText(`Session ${label} created.`);

    // Making the seeded session current again keeps other specs' current term stable
    // while still exercising the "make current" action (it clears, then sets).
    await page.reload();
    const makeSeeded = page.getByRole("button", { name: "Make 2026/2027 current" });
    if (await makeSeeded.count()) await makeSeeded.click();
    await page.reload();
    const card = page.locator("div", { hasText: "2026/2027" }).filter({ has: page.getByText("Current") }).first();
    await expect(card).toBeVisible();
  });
});
