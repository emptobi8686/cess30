import { expect, test } from "@playwright/test";

test.describe("service worker (BP-011)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "service worker checks run in Chromium");

  test("registers, activates and serves the offline page", async ({ page, context }) => {
    await page.goto("/");
    const active = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active);
    });
    expect(active).toBe(true);

    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    await page.goto("/").catch(() => undefined);
    await expect(page.locator("body")).toContainText(/offline/i);
    await context.setOffline(false);
  });
});
