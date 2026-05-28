import { expect, test } from "@playwright/test";

test.describe("lms community governance", () => {
  test("shows publisher trust, recommendation reasons, and moderation queue evidence", async ({ page }) => {
    await page.goto("/resources");

    await expect(page.getByRole("heading", { name: "LMS Home" })).toBeVisible();
    await expect(page.getByText("Why this is recommended").first()).toBeVisible();
    await expect(page.getByText("Trust 91").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "AP23110010234" }).first()).toHaveAttribute(
      "href",
      "/resources/contributors/AP23110010234"
    );

    await page.goto("/admin/lms-moderation");

    await expect(page.getByRole("heading", { name: "LMS Moderation" })).toBeVisible();
    await expect(page.getByText("Community Health")).toBeVisible();
    await expect(page.getByText("Normalization checklist")).toBeVisible();
    await expect(page.getByText("Latest report: Needs citation review by AP23110010001")).toBeVisible();
    await expect(page.getByLabel("Decision reason for lms-res-normalization")).toBeVisible();
  });
});
