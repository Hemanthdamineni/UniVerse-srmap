import { expect, test } from "@playwright/test";

/**
 * The content-lifecycle console lives at /admin/content-management behind the
 * admin gate; the static prototype never grants admin, so students are
 * redirected to the dashboard. The lifecycle workflow itself (preview, bulk
 * execution, audit history) is covered by AdminContentManagementPage.test.tsx.
 */
test.describe("admin content lifecycle readiness", () => {
  test("keeps the content console admin-gated", async ({ page }) => {
    await page.goto("/admin/content-management");
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  });
});
