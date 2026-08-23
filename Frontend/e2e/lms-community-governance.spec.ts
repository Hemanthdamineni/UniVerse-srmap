import { expect, test } from "@playwright/test";

/**
 * The LMS home surfaces recommendation and request sections. Publisher-trust
 * badges moved into resource cards; the moderation queue is admin-gated and
 * the static prototype never grants admin (adminApi.ts), so /admin/lms-moderation
 * redirects students to the dashboard.
 */
test.describe("lms community governance", () => {
  test("shows community sections on LMS home and keeps moderation student-proof", async ({ page }) => {
    await page.goto("/resources");

    await expect(page.getByRole("heading", { name: "LMS Home" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recommended for you" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Open Requests" })).toBeVisible();

    await page.goto("/admin/lms-moderation");
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  });
});
