import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

const RESOURCE = "00000000-0000-0000-0000-0000000e2e01";

// P8: Paula Placed (level 200) can find the seeded resource; Carl Carryover (level 300) cannot.
test.describe("library (P8)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("a level-200 student searches, bookmarks and reports", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-desktop", "state-changing journey runs on one project");
    await signIn(page, "placed@e2e.test");
    await page.goto("/library?q=beam");
    await page.getByRole("link", { name: "Beam Theory Notes" }).click();
    await page.getByRole("button", { name: "Bookmark" }).click();
    await expect(page.getByRole("button", { name: "Bookmarked" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Bookmarked" })).toBeVisible();
    await page.getByRole("button", { name: "Report a problem" }).click();
    await page.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByText("Thanks, a library manager will review this.")).toBeVisible();
  });

  test("other levels and anonymous users get 404 for the file", async ({ page, request }) => {
    const anonymous = await request.get(`/api/library/${RESOURCE}/file`, { maxRedirects: 0 });
    expect(anonymous.status()).toBe(404);
    await signIn(page, "carry@e2e.test");
    const response = await page.request.get(`/api/library/${RESOURCE}/file`, { maxRedirects: 0 });
    expect(response.status()).toBe(404);
    await page.goto(`/library/${RESOURCE}`);
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  });
});
