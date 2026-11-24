import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

// Confirming a placement is one-way for the student, so the journey runs once.
test.describe("student placement (E3)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");
  test.describe.configure({ mode: "serial" });

  test("verified student requests a level and an admin confirms it", async ({ browser }, info) => {
    test.skip(info.project.name !== "chromium-desktop", "state-changing journey runs on one project");

    const student = await browser.newPage();
    await signIn(student, "verified@e2e.test");
    await student.goto("/dashboard");
    await expect(student.getByText("Select your level for 2026/2027")).toBeVisible();
    await student.goto("/settings/profile");
    await student.getByLabel("Level", { exact: true }).selectOption("200");
    await student.getByRole("button", { name: "Request level" }).click();
    await expect(student.getByRole("status").last()).toHaveText("Level 200 requested. Awaiting confirmation.");

    const admin = await browser.newPage();
    await signIn(admin, "admin@e2e.test");
    await admin.goto("/admin/academic/placements?status=claimed&level=200");
    await admin.getByRole("checkbox", { name: "Select Vera Verified" }).check();
    await admin.getByRole("button", { name: "Confirm selected" }).click();
    await expect(admin.getByRole("status").last()).toHaveText("1 placement confirmed.");

    await student.goto("/dashboard");
    await expect(student.getByText("Select your level for 2026/2027")).toHaveCount(0);
  });
});
