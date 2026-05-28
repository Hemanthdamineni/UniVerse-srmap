import { expect, test } from "@playwright/test";

test.describe("events registration productization", () => {
  test("registration module points to native event registration and submission workflows", async ({ page }) => {
    await page.goto("/registration/events-registration");

    await expect(page.getByRole("heading", { name: "Events Registration" })).toBeVisible();
    await expect(page.getByText("Internal events platform", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open events" })).toHaveAttribute("href", "/events");
    await expect(page.getByRole("link", { name: "View registrations" })).toHaveAttribute(
      "href",
      "/events/my-activity?tab=registered"
    );
    await expect(page.getByRole("link", { name: "View submissions" })).toHaveAttribute(
      "href",
      "/events/my-activity?tab=submissions"
    );
    await expect(page.getByText(/Platform registrations and submissions are managed through/)).toBeVisible();
  });
});
