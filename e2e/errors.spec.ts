import { expect, test } from "@playwright/test";

test("unknown routes show the BLUEPRINT not-found page (BP-031)", async ({ page }) => {
  const response = await page.goto("/this-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to your dashboard" })).toBeVisible();
});
