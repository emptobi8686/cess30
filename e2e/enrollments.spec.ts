import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

// Seed: Paula Placed is confirmed at 200, Carl Carryover at 300, GET209 is offered to 200.
test.describe("enrolments (E3)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("admin enrols level 200 and adds a level-300 carry-over student to GET209", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-desktop", "state-changing journey runs on one project");
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin/academic/enrollments");
    await page.getByRole("button", { name: "Enrol all confirmed level 200 students" }).click();
    await expect(page.getByRole("status").first()).toContainText("level 200");

    await page.getByRole("link", { name: "GET209 · Level 200" }).click();
    const enrolled = page.getByRole("region", { name: "Enrolled students" });
    await expect(enrolled.getByText("Paula Placed")).toBeVisible();

    await page.getByLabel("Find a student (name or matric)").fill("900000007");
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("button", { name: "Enrol Carl Carryover" }).click();
    await expect(page.getByText("Student enrolled (carryover).")).toBeVisible();

    await page.reload();
    const row = enrolled.getByRole("listitem").filter({ hasText: "Carl Carryover" });
    await expect(row.getByText("Carry-over")).toBeVisible();
  });
});
