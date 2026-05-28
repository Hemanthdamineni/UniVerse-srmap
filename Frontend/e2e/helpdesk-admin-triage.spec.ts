import { expect, test } from "@playwright/test";

test.describe("helpdesk admin triage workflow", () => {
  test("admin can see breached queue, resolve with summary, add internal note, and bulk triage", async ({ page }) => {
    await page.goto("/admin/helpdesk-tickets");

    await expect(page.getByRole("heading", { name: "Track & Escalate" })).toBeVisible();
    await expect(page.getByText("Breached SLA")).toBeVisible();
    await expect(page.getByText("Asha Rao: 1 active, 1 breached")).toBeVisible();
    await expect(page.getByText("ERP login blocked")).toBeVisible();
    await expect(page.getByText("Latest audit: created by Student One")).toBeVisible();

    await page.getByPlaceholder("Resolution summary").fill("Reset account lock and verified login.");
    await page.getByRole("button", { name: "Resolve", exact: true }).click();
    await expect(page.getByText("Ticket HD-STATIC-001 resolved.")).toBeVisible();

    await page.getByPlaceholder("Add admin reply or resolution note").fill("Internal root-cause note.");
    await page.getByRole("button", { name: "Internal Note" }).click();
    await expect(page.getByText("Internal note added to HD-STATIC-001.")).toBeVisible();

    await page.getByLabel("Select ticket HD-STATIC-001").check();
    await page.getByRole("button", { name: /Bulk: mark in progress/ }).click();
    await expect(page.getByText(/1 selected ticket.*moved to in progress/)).toBeVisible();
  });
});
