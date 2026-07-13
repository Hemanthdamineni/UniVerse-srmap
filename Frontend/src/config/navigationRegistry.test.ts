import { describe, expect, it, afterEach } from "vitest";
import {
  getCommandPaletteGroupOrder,
  getBreadcrumbs,
  getMainNavSections,
  getRouteCatalog,
  getSidebarNav,
  resolveCatalogRoute,
} from "./navigationRegistry";
import { clearNavigationExtensionsForTests, registerNavigationExtension } from "./navigationExtensions";

afterEach(() => {
  clearNavigationExtensionsForTests();
});

describe("navigationRegistry", () => {
  it("merges registered extensions into main nav", () => {
    registerNavigationExtension({
      id: "test-ext",
      mainNavAppend: [
        {
          label: "Test Section",
          icon: "/src/assets/Icons/Dashboard.png",
          domain: "erp",
          route: "/test-extension-route",
          type: "B",
        },
      ],
    });

    const labels = getCommandPaletteGroupOrder();
    expect(labels).toContain("Test Section");
  });

  it("resolves longest catalog route for nested LMS paths", () => {
    const hit = resolveCatalogRoute("/resources/browse");
    expect(hit?.route).toBe("/resources/browse");
  });

  it("includes supplemental and blueprint routes in catalog", () => {
    const routes = new Set(getRouteCatalog({ isAdmin: true }).map((r) => r.route));
    expect(routes.has("/resources/browse")).toBe(true);
    expect(routes.has("/dashboard")).toBe(true);
    expect(routes.has("/events/:eventId/manage")).toBe(true);
    expect(routes.has("/admin/events-management/:eventId")).toBe(true);
  });

  it("builds breadcrumbs for dashboard only", () => {
    expect(getBreadcrumbs("/dashboard")).toEqual([{ label: "Dashboard" }]);
  });

  it("builds breadcrumbs with domain for career paths", () => {
    const crumbs = getBreadcrumbs("/career/jobs");
    expect(crumbs[0].label).toBe("Dashboard");
    expect(crumbs.some((c) => c.label.toLowerCase().includes("career"))).toBe(true);
  });

  it("resolves dynamic route patterns for deep links", () => {
    const hit = resolveCatalogRoute("/events/evt-1/manage/rounds/r2/submissions");
    expect(hit?.route).toBe("/events/:eventId/manage/rounds/:roundId/submissions");
  });

  it("includes complete admin navigation when admin mode is enabled", () => {
    const adminSections = getMainNavSections({ isAdmin: true });
    const adminRoutes = adminSections
      .flatMap((section) => section.items)
      .flatMap((item) => (item.type === "group" ? item.children.map((child) => child.route) : [item.route]));

    expect(adminRoutes).toContain("/admin/event-approvals");
    expect(adminRoutes).toContain("/admin/companion-analytics");
    expect(adminRoutes).toContain("/admin/certificate-templates");
    expect(adminRoutes).toContain("/admin/audit-logs");
  });

  it("keeps command palette groups aligned with sidebar groups", () => {
    const sidebarGroups = getSidebarNav().map((item) => item.label);
    const paletteGroups = getCommandPaletteGroupOrder();
    expect(paletteGroups).toEqual(sidebarGroups);
  });

  it("hides admin catalog routes for non-admin users", () => {
    const routes = new Set(getRouteCatalog().map((r) => r.route));
    expect(routes.has("/admin/events-management")).toBe(false);
  });
});
