import { describe, expect, it } from "vitest";

import { baseRoutes } from "./baseRoutes";
import { eventRoutes } from "./eventRoutes";
import { lmsRoutes } from "./lmsRoutes";
import { erpRoutes, DOMAIN_PAGE_MAP } from "./erpRoutes";
import { adminRoutes } from "./adminRoutes";
import { getRouteCatalog } from "../config/navigationRegistry";
import { PAGE_BLUEPRINTS, isPageVisible } from "../config/erpBlueprints";

/**
 * Backlog T8.4 — nothing a user can navigate to may fall through to the `*`
 * NotFoundPage.
 *
 * These run render-free: they compare the set of routes the nav / command
 * palette / blueprints expose against the set of `{ path }` entries actually
 * registered on the router. `isPageVisible` keys off `import.meta.env.DEV`,
 * which is true under Vitest, so both sides see the same (dev) visibility —
 * an apples-to-apples comparison.
 */

type RouteDef = { path?: string; children?: RouteDef[] };

function collectPaths(routes: RouteDef[], prefix = ""): string[] {
  const out: string[] = [];
  for (const r of routes) {
    if (r.path == null) {
      if (r.children) out.push(...collectPaths(r.children, prefix));
      continue;
    }
    const full = r.path.startsWith("/")
      ? r.path
      : `${prefix.replace(/\/$/, "")}/${r.path}`;
    out.push(full);
    if (r.children) out.push(...collectPaths(r.children, full));
  }
  return out;
}

const REGISTERED = [
  ...collectPaths(baseRoutes as RouteDef[]),
  ...collectPaths(eventRoutes as RouteDef[]),
  ...collectPaths(lmsRoutes as RouteDef[]),
  ...collectPaths(erpRoutes as RouteDef[]),
  ...collectPaths(adminRoutes as RouteDef[]),
].filter((p) => p && p !== "*");

/** Turn a route pattern (`/learn/r/:id`) into a matcher against a concrete path. */
function patternToRegExp(pattern: string): RegExp {
  const body = pattern
    .split("/")
    .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${body}/?$`);
}

const MATCHERS = REGISTERED.map(patternToRegExp);

function isReachable(route: string): boolean {
  return MATCHERS.some((re) => re.test(route));
}

describe("route reachability", () => {
  it("registers at least the well-known core routes", () => {
    for (const core of ["/dashboard", "/profile", "/settings", "/events", "/learn"]) {
      expect(isReachable(core), `${core} should be routed`).toBe(true);
    }
  });

  it("every nav / command-palette / blueprint route resolves to a real route", () => {
    const linkable = getRouteCatalog()
      .map((entry) => entry.route)
      .filter((route) => route.startsWith("/") && !route.includes(":"));

    const unreachable = [...new Set(linkable)].filter((route) => !isReachable(route));
    expect(unreachable, `these nav destinations hit NotFoundPage:\n${unreachable.join("\n")}`).toEqual([]);
  });

  it("every visible ERP blueprint route is registered", () => {
    const visibleBlueprintRoutes = Object.values(PAGE_BLUEPRINTS)
      .filter(isPageVisible)
      .map((bp) => bp.route)
      // Non-ERP route arrays own these prefixes.
      .filter((route) => route !== "/dashboard" && route !== "/profile" && !route.startsWith("/events"));

    const unreachable = visibleBlueprintRoutes.filter((route) => !isReachable(route));
    expect(unreachable, `visible blueprints with no route:\n${unreachable.join("\n")}`).toEqual([]);
  });

  it("every DOMAIN_PAGE_MAP key is backed by a visible blueprint", () => {
    const visibleRoutes = new Set(
      Object.values(PAGE_BLUEPRINTS).filter(isPageVisible).map((bp) => bp.route),
    );
    const orphans = Object.keys(DOMAIN_PAGE_MAP).filter((route) => !visibleRoutes.has(route));
    expect(
      orphans,
      `DOMAIN_PAGE_MAP keys with no visible blueprint (bespoke page can never mount):\n${orphans.join("\n")}`,
    ).toEqual([]);
  });
});
