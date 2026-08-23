import { expect, test } from "@playwright/test";

/**
 * The registration hub was retired: the page now explains that registration
 * lives in each event's details page and links back to the dashboard. The old
 * deep links (/events, /events/my-activity) remain the native workflows.
 */
test.describe("events registration productization", () => {
  test("registration module points students to the per-event workflows", async ({ page }) => {
    await page.goto("/registration/events-registration");

    await expect(page.getByRole("heading", { name: "Events Registration" })).toBeVisible();
    await expect(page.getByText("This page is not available yet")).toBeVisible();
    await expect(
      page.getByText(/event registration is available from each event's details page/)
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to dashboard" })).toBeVisible();
  });
});
