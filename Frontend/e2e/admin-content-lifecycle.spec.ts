import { expect, test } from "@playwright/test";

test.describe("admin content lifecycle readiness", () => {
  test("renders workflow map, previewed bulk lifecycle controls, and audit history", async ({ page }) => {
    await page.goto("/admin/content-management");

    await expect(page.getByRole("heading", { name: "Learning Materials" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin Workflow Map" })).toBeVisible();
    await expect(page.getByText("Bulk execution runs in one transaction after preview validation.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Admin Resource Queue" })).toBeVisible();
    await expect(page.getByText("Operating Systems Revision Notes").first()).toBeVisible();

    await page.getByLabel("Select Operating Systems Revision Notes").check();
    await page.getByLabel("Bulk action").selectOption("archive");
    await page.getByRole("button", { name: "Preview Bulk Action" }).click();
    await expect(page.getByText(/published to archived/i).last()).toBeVisible();
    await page.getByRole("button", { name: "Execute Preview" }).click();
    await expect(page.getByText(/Bulk action updated/i)).toBeVisible();

    await page.getByRole("button", { name: "History" }).first().click();
    await expect(page.getByText("Change history and diff")).toBeVisible();
    await expect(page.getByText("Title clarified")).toBeVisible();
  });
});
