import { expect, test } from "@playwright/test";

/**
 * Submitter status stays visible on /career/submit. The review queue lives at
 * /admin/career-opportunities behind the admin gate; the static prototype
 * never grants admin, so students are redirected to the dashboard.
 */
test.describe("career opportunity governance", () => {
  test("shows submitter status and keeps the review queue student-proof", async ({ page }) => {
    await page.goto("/career/submit");

    await expect(page.getByRole("heading", { name: "Submit an Opportunity" })).toBeVisible();
    await expect(page.getByText("Your Submission Status")).toBeVisible();

    await page.goto("/admin/career-opportunities");
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  });
});
