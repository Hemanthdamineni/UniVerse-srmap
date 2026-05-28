import { expect, test } from "@playwright/test";

test.describe("academic tracker career readiness", () => {
  test("renders persisted analytics trace and recommendation event trace", async ({ page }) => {
    await page.goto("/academic-tracker/progress-overview");

    await expect(page.getByRole("heading", { name: "Progress Overview" })).toBeVisible();
    await expect(page.getByText("Career Readiness")).toBeVisible();
    await expect(page.getByText("Analytics Trace")).toBeVisible();
    await expect(page.getByText("Node.js").first()).toBeVisible();
    await expect(page.getByText(/Snapshot saved/i)).toBeVisible();

    await page.evaluate(() => {
      window.history.pushState({}, "", "/academic-tracker/academic-insights");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await expect(page.getByRole("heading", { name: "Academic Insights" })).toBeVisible();
    await expect(page.getByText("Career-Aware Action Plan")).toBeVisible();
    await expect(page.getByText("Frontend Engineering Intern").first()).toBeVisible();
    await expect(page.getByText("Recommendation Trace")).toBeVisible();
    await expect(page.getByText("career_readiness")).toBeVisible();
  });
});
