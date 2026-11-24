import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngOfSize = (bytes: number) => Buffer.concat([PNG_HEADER, Buffer.alloc(bytes - PNG_HEADER.length)]);

test.describe("avatar upload (BP-026)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("4.5 MB picture uploads directly (beyond the 1 MB server-action limit)", async ({ page }) => {
    await signIn(page, "verified@e2e.test");
    await page.goto("/settings/profile");
    await page.getByLabel("Choose a profile picture").setInputFiles({
      name: "me.png",
      mimeType: "image/png",
      buffer: pngOfSize(4.5 * 1024 * 1024),
    });
    await expect(page.getByRole("status").filter({ hasText: "Profile picture updated." })).toBeVisible();
  });

  test("6 MB picture is rejected before upload", async ({ page }) => {
    await signIn(page, "verified@e2e.test");
    await page.goto("/settings/profile");
    await page.getByLabel("Choose a profile picture").setInputFiles({
      name: "big.png",
      mimeType: "image/png",
      buffer: pngOfSize(6 * 1024 * 1024),
    });
    await expect(page.getByRole("status").filter({ hasText: "smaller than 5 MB" })).toBeVisible();
  });
});
