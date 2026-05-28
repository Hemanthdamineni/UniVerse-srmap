import { expect, test } from "@playwright/test";

test.describe("fee-paid source integrity", () => {
  test("renders per-section tables, source trace, and warnings", async ({ page }) => {
    await page.goto("/finance/fee-paid");

    await expect(page.getByRole("heading", { name: "Fees Paid" })).toBeVisible();
    await expect(page.getByText("Partial finance data warning")).toBeVisible();
    await expect(page.getByText("Source extraction trace")).toBeVisible();

    await expect(page.getByText("Fee Paid Details").first()).toBeVisible();
    await expect(page.getByText("Payment Acknowledgment").first()).toBeVisible();
    await expect(page.getByText("Online Payment Verification").first()).toBeVisible();
    await expect(page.getByText(/65 rows across 3 sources/)).toBeVisible();

    // Each section renders as its own table with a heading
    const sections = page.locator("section.dashboard-card");
    await expect(sections.filter({ hasText: "Fee Paid Details" }).first()).toBeVisible();
    await expect(sections.filter({ hasText: "Payment Acknowledgment" }).first()).toBeVisible();
    await expect(sections.filter({ hasText: "Online Payment Verification" }).first()).toBeVisible();
  });
});
