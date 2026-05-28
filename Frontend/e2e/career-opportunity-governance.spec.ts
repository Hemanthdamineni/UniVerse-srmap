import { expect, test } from "@playwright/test";

test.describe("career opportunity governance", () => {
  test("shows submitter status and admin review queue", async ({ page }) => {
    await page.goto("/career/submit");

    await expect(page.getByRole("heading", { name: "Submit an Opportunity" })).toBeVisible();
    await expect(page.getByText("Your Submission Status")).toBeVisible();
    await expect(page.getByText("Review reason: Company posting could not be verified.")).toBeVisible();

    await page.goto("/admin/career-opportunities");

    await expect(page.getByRole("heading", { name: "Opportunities", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Publish Opportunity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Submission Review Queue" })).toBeVisible();
    await expect(page.getByText("Cloud Platform Workshop")).toBeVisible();
    await expect(page.getByLabel("Review reason for sub-static-pending")).toBeVisible();
  });
});
