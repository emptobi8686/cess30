import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

// Spec 5.4: a weekly series fills the semester for one class.
test.describe("weekly lecture series", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("admin schedules a weekly GET209 series", async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-desktop", "state-changing journey runs on one project");
    await signIn(page, "admin@e2e.test");
    await page.goto("/admin/timetable");
    await page.getByRole("button", { name: "Add weekly series" }).click();
    await page.getByLabel("Class (this semester)").selectOption({ label: "GET209 · Level 200" });
    await page.getByLabel("Tue").check();
    await page.getByLabel("Start time").fill("14:00");
    await page.getByLabel("End time").fill("16:00");
    await page.getByLabel("Venue").fill("E2E Series Hall");
    await page.getByRole("button", { name: "Schedule series" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("E2E Series Hall").first()).toBeVisible();
  });
});
