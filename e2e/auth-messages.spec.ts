import { expect, test } from "@playwright/test";

test.describe("auth page messages (BP-040)", () => {
  test("known codes render fixed copy", async ({ page }) => {
    await page.goto("/login?message=password_updated");
    await expect(page.getByText("Password updated successfully. Sign in with your new password.")).toBeVisible();
  });

  test("arbitrary query text is not rendered", async ({ page }) => {
    await page.goto("/login?error=Your%20account%20is%20locked.%20Call%20%2B2340000");
    await expect(page.getByText("Your account is locked")).toHaveCount(0);
  });
});
