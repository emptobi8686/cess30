import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

// E5: students see their own level's lectures; the dashboard names their level.
// Seed: Paula Placed is confirmed at 200; Carl Carryover at 300; GET209 is offered to 200.
test.describe("level isolation (E5)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("a level-200 student sees level-200 lectures and their level on the dashboard", async ({ browser }, info) => {
    test.skip(info.project.name !== "chromium-desktop", "state-changing journey runs on one project");

    const admin = await browser.newPage();
    await signIn(admin, "admin@e2e.test");
    await admin.goto("/admin/timetable");
    await admin.getByRole("button", { name: "Add session" }).click();
    await admin.getByLabel("Class (this semester)").selectOption({ label: "GET209 · Level 200" });
    const date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    await admin.getByLabel("Date").fill(date);
    await admin.getByLabel("Start time").fill("09:00");
    await admin.getByLabel("End time").fill("11:00");
    await admin.getByLabel("Venue").fill("E2E Hall 200");
    await admin.getByRole("button", { name: "Create session" }).click();
    await expect(admin.getByRole("dialog")).toHaveCount(0);

    const student = await browser.newPage();
    await signIn(student, "placed@e2e.test");
    await student.goto("/dashboard");
    await expect(student.getByText(/Level 200 · /).first()).toBeVisible();
    // The lecture is two days out, so it is in this week's or next week's agenda.
    const seen = async (page: typeof student) => {
      for (const week of [0, 1]) {
        await page.goto(`/timetable?view=agenda&week=${week}`);
        if (await page.getByText("E2E Hall 200").count()) return true;
      }
      return false;
    };
    expect(await seen(student)).toBe(true);

    const other = await browser.newPage();
    await signIn(other, "verified@e2e.test");
    expect(await seen(other)).toBe(false);
  });
});
