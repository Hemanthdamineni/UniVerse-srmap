import { expect, test } from "@playwright/test";

test.describe("campus feedback governance split", () => {
  test("student submits unofficial feedback and admin moderates it separately from official ERP feedback", async ({ page }) => {
    await page.goto("/feedback/events-feedback");

    await expect(page.getByRole("heading", { name: "Events Feedback", exact: true })).toBeVisible();
    await expect(page.getByText("Unofficial campus feedback")).toBeVisible();
    await expect(page.getByText("/api/campus-feedback")).toBeVisible();
    await expect(page.getByText("/api/feedback/end-semester")).toBeVisible();

    await page.getByLabel("Event", { exact: true }).selectOption("demo-event");
    await page.getByRole("radio", { name: "5 star" }).first().click();
    await page.getByLabel("Comments").fill("Useful event flow with clear coordination.");
    await page.getByRole("button", { name: "Submit Feedback" }).click();

    await expect(page.getByText("Feedback submitted for moderation.")).toBeVisible();
    await expect(page.getByText("pending").first()).toBeVisible();

    await page.evaluate(() => {
      window.history.pushState({}, "", "/admin/campus-feedback");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.getByRole("heading", { name: "Campus Feedback Moderation" })).toBeVisible();
    await expect(page.getByText("Unofficial feedback only")).toBeVisible();
    await expect(page.getByText("Campus Tech Showcase").first()).toBeVisible();

    await page.getByPlaceholder("Moderation reason").fill("Constructive and policy compliant.");
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Feedback approved.")).toBeVisible();
  });
});
