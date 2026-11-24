import { expect, type Page } from "@playwright/test";

export const E2E_PASSWORD = "Blueprint-e2e-2026!";

/** True when the CI Supabase stack is running and supabase/tests/e2e_seed.sql was applied. */
export const hasSeededSupabase = process.env.E2E_SUPABASE === "1";

export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login(\?|$)/);
}
