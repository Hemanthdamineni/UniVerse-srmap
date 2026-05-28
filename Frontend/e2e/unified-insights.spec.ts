import { expect, test } from "@playwright/test";

test.describe("unified insights readiness", () => {
  test("renders explainable cross-domain recommendations and feedback monitoring", async ({ page }) => {
    await page.goto("/academic-tracker/unified-insights");

    await expect(page.getByRole("heading", { name: "Unified Insights" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profile Graph" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ATS Rubric" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Build Node.js" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Frontend Engineering Intern" }).first()).toBeVisible();
    await expect(page.getByText("eligible").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quality Monitoring" })).toBeVisible();

    await page.getByRole("button", { name: /Applied/i }).click();
    await expect(page.getByText(/Feedback saved/i)).toBeVisible();

    await page.evaluate(() => {
      window.history.pushState({}, "", "/career");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.getByRole("link", { name: /Unified Insights/i })).toBeVisible();

    await page.evaluate(() => {
      window.history.pushState({}, "", "/dashboard");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.getByText("Unified Insights").first()).toBeVisible();
  });
});
