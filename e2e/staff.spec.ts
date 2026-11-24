import { expect, test } from "@playwright/test";
import { hasSeededSupabase, signIn } from "./support/auth";

// Decision 0004: an admin appoints a course representative, who then runs level 200 only.
test.describe("course representatives (E6)", () => {
  test.skip(!hasSeededSupabase, "requires the seeded Supabase stack (E2E_SUPABASE=1)");

  test("admin appoints a level-200 rep who sees only their scoped admin area", async ({ browser }, info) => {
    test.skip(info.project.name !== "chromium-desktop", "state-changing journey runs on one project");

    const admin = await browser.newPage();
    await signIn(admin, "admin@e2e.test");
    await admin.goto("/admin/staff?q=900000006");
    await admin.getByLabel("Role for Paula Placed").selectOption("level_coordinator");
    await admin.getByLabel("Level").selectOption("200");
    await admin.getByLabel("Reason").fill("Elected class representative for 2026/2027");
    await admin.getByRole("button", { name: "Grant" }).click();
    await expect(admin.getByText("Course representative for level 200 appointed.")).toBeVisible();

    const rep = await browser.newPage();
    await signIn(rep, "placed@e2e.test");
    await rep.goto("/admin");
    await expect(rep.getByRole("heading", { name: "Run Level 200" })).toBeVisible();
    await expect(rep.getByRole("link", { name: "Verifications" })).toHaveCount(0);
    await rep.goto("/admin/verifications");
    await expect(rep).toHaveURL(/\/access-denied/);
    await rep.goto("/admin/academic/placements");
    await expect(rep.getByRole("link", { name: "All levels" })).toHaveCount(0);
  });
});
