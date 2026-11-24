import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

test.describe("verification lifecycle (BP-007)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");
  test.describe.configure({ mode: "serial" });

  const reason = "Matric number does not match the class list";

  test("admin rejects a pending student with a reason", async ({ page }) => {
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin/verifications?status=pending");
    const row = page.getByRole("row", { name: /Peter Pending/ });
    await row.getByLabel("Reason for rejection").fill(reason);
    await row.getByLabel("Confirm rejection").check();
    await row.getByRole("button", { name: "Reject" }).click();
    await expect(row.getByRole("status")).toHaveText("Verification rejected.");
  });

  test("student sees the reason and resubmits", async ({ page }) => {
    await signIn(page, "pending@e2e.test");
    await page.goto("/dashboard");
    await expect(page.getByText(reason)).toBeVisible();
    await page.getByRole("button", { name: "Resubmit for review" }).click();
    await expect(page.getByRole("status")).toContainText("pending administrator review");
  });

  test("admin approves and the student reaches full features", async ({ page, browser }) => {
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin/verifications?status=pending");
    const row = page.getByRole("row", { name: /Peter Pending/ });
    await row.getByLabel("Confirm approval").check();
    await row.getByRole("button", { name: "Approve" }).click();
    await expect(row.getByRole("status")).toHaveText("Student verified.");

    const student = await browser.newPage();
    await signIn(student, "pending@e2e.test");
    await student.goto("/study-planner");
    await expect(student).toHaveURL(/\/study-planner$/);
  });
});
