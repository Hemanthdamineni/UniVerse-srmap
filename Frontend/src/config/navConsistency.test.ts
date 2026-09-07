import { describe, expect, it } from "vitest";
import { PAGE_BLUEPRINTS, isPageVisible } from "./erpBlueprints";
import { getRouteCatalog } from "./navigationRegistry";

/**
 * Backlog T5.2 — "one place has one name". A route's nav label, its breadcrumb
 * leaf, and its page `<h1>` should agree.
 *
 * Breadcrumb leaf == nav label by construction (both come from
 * `getRouteCatalog`). This test covers the other axis render-free: the ERP
 * blueprint `heading` (which feeds `ErpPageShell`'s `<h1>` on the generic
 * pages) vs the catalog label.
 *
 * `KNOWN_MISMATCHES` is the frozen list of today's disagreements — each is a
 * deliberate nav-vs-page-title choice that predates this guard. The test fails
 * if a NEW mismatch appears, or if one on the list is silently resolved
 * (remove it from the list in the same change that fixes it). Drive this list
 * to empty as T5.2.1 / T5.2.2 land.
 */

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// route -> [navLabel, blueprintHeading] as they stand now.
const KNOWN_MISMATCHES: Record<string, [string, string]> = {
  // Deliberate: the nav uses a terse label, the page a fuller title. Both
  // live entirely inside the Learn section, so there is no cross-surface
  // confusion. Revisit if the Learn IA is reworked.
  "/learn/materials": ["Official materials", "Learning Materials"],
};

describe("navigation naming consistency", () => {
  it("blueprint heading matches the nav label (except the frozen known set)", () => {
    const catalog = new Map(getRouteCatalog().map((e) => [e.route, e.label]));
    const found: Record<string, [string, string]> = {};

    for (const bp of Object.values(PAGE_BLUEPRINTS)) {
      if (!isPageVisible(bp)) continue;
      const navLabel = catalog.get(bp.route);
      if (!navLabel) continue;
      if (norm(navLabel) !== norm(String(bp.heading))) {
        found[bp.route] = [navLabel, String(bp.heading)];
      }
    }

    // New mismatches — fail with the specifics.
    const unexpected = Object.keys(found).filter((r) => !(r in KNOWN_MISMATCHES));
    expect(
      unexpected.map((r) => `${r}: nav="${found[r][0]}" heading="${found[r][1]}"`),
    ).toEqual([]);

    // Frozen mismatches that no longer exist — the list is stale.
    const resolved = Object.keys(KNOWN_MISMATCHES).filter((r) => !(r in found));
    expect(resolved, `these are fixed — drop them from KNOWN_MISMATCHES: ${resolved.join(", ")}`).toEqual([]);
  });

  it('no student-facing nav label says "LMS"', () => {
    const offenders = getRouteCatalog()
      .filter((e) => /\blms\b/i.test(e.label))
      .map((e) => `${e.route}: "${e.label}"`);
    expect(offenders).toEqual([]);
  });
});
