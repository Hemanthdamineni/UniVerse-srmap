import { describe, expect, it, afterEach } from "vitest";
import {
  getBreadcrumbs,
  getMergedMainNav,
  getRouteCatalog,
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

    const labels = getMergedMainNav().map((i) => i.label);
    expect(labels).toContain("Test Section");
  });

  it("resolves longest catalog route for nested LMS paths", () => {
    const hit = resolveCatalogRoute("/resources/browse");
    expect(hit?.route).toBe("/resources/browse");
  });

  it("includes supplemental and blueprint routes in catalog", () => {
    const routes = new Set(getRouteCatalog().map((r) => r.route));
    expect(routes.has("/resources/browse")).toBe(true);
    expect(routes.has("/dashboard")).toBe(true);
  });

  it("builds breadcrumbs for dashboard only", () => {
    expect(getBreadcrumbs("/dashboard")).toEqual([{ label: "Dashboard" }]);
  });

  it("builds breadcrumbs with domain for career paths", () => {
    const crumbs = getBreadcrumbs("/career/jobs");
    expect(crumbs[0].label).toBe("Dashboard");
    expect(crumbs.some((c) => c.label.toLowerCase().includes("career"))).toBe(true);
  });
});
