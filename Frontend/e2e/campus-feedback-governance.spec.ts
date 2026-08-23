import { expect, test } from "@playwright/test";

/**
 * Students submit events feedback through the shared campus feedback form
 * (fixed target: overall events). Submissions queue for moderation; the
 * moderation console is admin-gated and the static prototype never grants
 * admin, so /admin/campus-feedback redirects students to the dashboard.
 */
test.describe("campus feedback governance split", () => {
  test("student submits events feedback and cannot reach the moderation console", async ({ page }) => {
    await page.goto("/feedback/events-feedback");

    await expect(page.getByRole("heading", { name: "Events Feedback", exact: true })).toBeVisible();

    await page.getByRole("radio", { name: "5 star" }).first().click();
    await page.getByLabel("Comments").fill("Useful event flow with clear coordination.");
    await page.getByRole("button", { name: "Submit Feedback" }).click();

    await expect(page.getByText("Feedback submitted for moderation.")).toBeVisible();
    await expect(page.getByText("pending").first()).toBeVisible();

    await page.goto("/admin/campus-feedback");
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  });
});
