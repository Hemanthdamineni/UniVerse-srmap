import { expect, test } from "@playwright/test";

/**
 * Career-readiness content was folded into the Academic Hub; the dedicated
 * progress-overview route no longer exists. This guards the hub's core
 * sections that replaced it.
 */
test.describe("academic tracker career readiness", () => {
  test("renders the hub overview sections that replaced progress-overview", async ({ page }) => {
    await page.goto("/academic-tracker/academic-insights");

    await expect(page.getByRole("heading", { name: "Academic Hub" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quick Actions" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Key Highlights" })).toBeVisible();
    await expect(page.getByText("Current: Sem 3")).toBeVisible();
  });
});
