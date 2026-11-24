import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

test.describe("course management (BP-030)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("admin adds, edits and archives a course", async ({ page }) => {
    const code = `CEE${String(Date.now()).slice(-3)}`;
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin/courses");
    await page.getByLabel("Code").first().fill(code);
    await page.getByLabel("Title").first().fill("Structural Analysis I");
    await page.getByRole("button", { name: "Add course" }).click();
    await expect(page.getByRole("status").first()).toHaveText(`${code} added.`);

    await page.reload();
    const row = page.locator("details", { hasText: code });
    await row.locator("summary").click();
    await row.getByLabel("Title").fill("Structural Analysis I (revised)");
    await row.getByRole("button", { name: "Save changes" }).click();
    await expect(row.getByRole("status").first()).toHaveText("Course saved.");
    await row.getByRole("button", { name: "Archive" }).click();
    await expect(row.getByRole("status").first()).toHaveText("Course archived.");
  });
});
