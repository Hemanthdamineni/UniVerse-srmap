import { expect, test } from "@playwright/test";

/**
 * The standalone insights surfaces were consolidated into the Academic Hub:
 * UnifiedInsights and ProgressOverview no longer have their own routes. This
 * guards the hub's core sections and the intentional retirement of the
 * legacy routes.
 */
test.describe("unified insights readiness", () => {
  test("renders the consolidated academic hub and retires legacy insight routes", async ({ page }) => {
    await page.goto("/academic-tracker/academic-insights");

    await expect(page.getByRole("heading", { name: "Academic Hub" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Attendance Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Semester Performance" })).toBeVisible();

    for (const legacyRoute of [
      "/academic-tracker/unified-insights",
      "/academic-tracker/progress-overview",
    ]) {
      await page.goto(legacyRoute);
      await expect(page.getByText("Page not found")).toBeVisible();
    }
  });
});
