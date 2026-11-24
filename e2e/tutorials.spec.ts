import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

// P9: Paula Placed (level 200) sees the seeded level-200 tutorials.
test.describe("tutorials (P9)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");
  test.skip(process.env.NEXT_PUBLIC_FEATURE_TUTORIALS !== "true", "Tutorials are switched off (NEXT_PUBLIC_FEATURE_TUTORIALS)");

  test("embeds use the privacy-enhanced player", async ({ page }) => {
    await signIn(page, "placed@e2e.test");
    await page.goto("/tutorials/00000000-0000-0000-0000-0000000e2e12");
    await expect(page.locator("iframe")).toHaveAttribute("src", /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    await expect(page.getByRole("note")).toHaveCount(0);
  });

  test("non-embeddable videos link out safely", async ({ page }) => {
    await signIn(page, "placed@e2e.test");
    await page.goto("/tutorials/00000000-0000-0000-0000-0000000e2e13");
    await expect(page.locator("iframe")).toHaveCount(0);
    const link = page.getByRole("link", { name: "Open on YouTube" });
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("mark as completed persists", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-desktop", "state-changing journey runs on one project");
    await signIn(page, "placed@e2e.test");
    await page.goto("/tutorials/00000000-0000-0000-0000-0000000e2e11");
    await page.getByRole("button", { name: "Mark as completed" }).click();
    await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();
  });
});
