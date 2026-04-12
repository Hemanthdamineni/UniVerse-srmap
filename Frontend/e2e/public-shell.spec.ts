import { test, expect } from "@playwright/test";

test.describe("public shell", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});
