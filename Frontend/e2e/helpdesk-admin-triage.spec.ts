import { expect, test } from "@playwright/test";

/**
 /admin/helpdesk-tickets is admin-gated and the static prototype never grants
 * admin, so students land back on the dashboard. The student-facing tracker
 * keeps SLA visibility (breached counts) on /helpdesk/track-escalate. The full
 * triage workflow (resolve/notes/bulk) is covered by TrackEscalate.test.tsx.
 */
test.describe("helpdesk admin triage workflow", () => {
  test("keeps the admin queue gated while students retain SLA visibility", async ({ page }) => {
    await page.goto("/admin/helpdesk-tickets");
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();

    await page.goto("/helpdesk/track-escalate");
    await expect(page.getByRole("heading", { name: "Track & Escalate" })).toBeVisible();
    await expect(page.getByText("Breached SLA")).toBeVisible();
  });
});
