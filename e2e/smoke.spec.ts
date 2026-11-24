import { expect, test } from "@playwright/test";

test("landing page states independence from UNILAG", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/not an official University of Lagos/i).first()).toBeVisible();
});

test("protected route redirects anonymous users to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("proxy guards static protected pages (anonymous /suspended → /login)", async ({ page }) => {
  // /suspended is a static page with no auth check of its own, so only the
  // proxy can redirect here. This fails if the proxy is not registered.
  await page.goto("/suspended");
  await expect(page).toHaveURL(/\/login$/);
});
