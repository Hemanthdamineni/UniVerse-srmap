import { expect, test } from "@playwright/test";

/**
 * Responsive shell guarantees: the sidebar collapses to a rail on phones and
 * expands as an overlay drawer, and key routes never leak horizontally.
 */

const RAIL_MAX_PX = 68; // collapsed rail is w-16 (64px)
const DRAWER_MIN_PX = 200; // expanded drawer is w-64 (256px)

async function sidebarWidth(page: import("@playwright/test").Page): Promise<number> {
  const box = await page.locator("div.sidebar").boundingBox();
  return box?.width ?? -1;
}

async function horizontalOverflow(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const docOverflow = Math.max(doc.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth;
    const main = document.querySelector("main");
    const mainOverflow = main ? main.scrollWidth - main.clientWidth : 0;
    return Math.max(docOverflow, mainOverflow);
  });
}

test.describe("responsive shell — mobile drawer", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("rail collapses by default and expands as an overlay drawer", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("load");

    // Below 900px the sidebar starts collapsed to an icon rail
    expect(await sidebarWidth(page)).toBeLessThanOrEqual(RAIL_MAX_PX);

    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await page.waitForTimeout(400); // width transition

    expect(await sidebarWidth(page)).toBeGreaterThanOrEqual(DRAWER_MIN_PX);
    await expect(page.getByTestId("sidebar-backdrop")).toBeVisible();

    // The drawer overlays content instead of pushing the page wide
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    // Backdrop click dismisses back to the rail
    await page.mouse.click(345, 600);
    await page.waitForTimeout(400);
    expect(await sidebarWidth(page)).toBeLessThanOrEqual(RAIL_MAX_PX);
    await expect(page.getByTestId("sidebar-backdrop")).toHaveCount(0);
  });

  test("navigating from the drawer auto-dismisses it", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("load");

    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Academics", exact: true }).click();
    await page.waitForTimeout(450);

    await page.locator('div.sidebar a[href="/academic/timetable"]').first().click();
    await page.waitForURL("**/academic/timetable");
    await expect(page.locator("div.sidebar")).toBeVisible();
    // Route chunk load defers the location update in dev; allow the close transition
    await expect
      .poll(async () => sidebarWidth(page), { timeout: 5_000 })
      .toBeLessThanOrEqual(RAIL_MAX_PX + 2);
  });
});

test.describe("responsive shell — no horizontal leaks", () => {
  for (const route of [
    "/dashboard",
    "/academic/timetable",
    "/events",
    "/learn",
    "/career/opportunities",
  ]) {
    test(`fits a 320px viewport without horizontal scroll: ${route}`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 760 });
      await page.goto(route);
      await page.waitForLoadState("load");
      try {
        await page.waitForFunction(() => !document.querySelector(".skeleton-shimmer"), {
          timeout: 6_000,
        });
      } catch {
        // Some pages legitimately keep shimmer widgets while polling
      }
      await page.waitForTimeout(500);
      expect(await horizontalOverflow(page), `${route} overflows at 320px`).toBeLessThanOrEqual(1);
    });
  }
});
