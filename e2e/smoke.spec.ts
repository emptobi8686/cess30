import { expect, test } from "@playwright/test";

test("landing page states independence from UNILAG", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/not an official University of Lagos/i).first()).toBeVisible();
});

test("protected route redirects anonymous users to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
