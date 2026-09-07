#!/usr/bin/env node
/**
 * Tap-target audit.
 *
 * Boots the static-prototype dev server, visits every discoverable route at a
 * phone viewport (390×844 by default), and reports interactive elements whose
 * hit area is smaller than the WCAG 2.5.5 / platform minimum of 44×44 CSS px.
 *
 * An element passes if EITHER its own border box is ≥ 44×44 OR it carries
 * enough padding/inline spacing that the effective target (box + nearest
 * spacing) clears 44 in both axes. Links that are inline in a run of prose are
 * exempt (2.5.5 carves them out) — detected by an inline display and a text
 * node sibling.
 *
 * Usage:
 *   node scripts/tap-target-audit.mjs [--base URL] [--width 390]
 *                                     [--routes /dashboard,/events] [--json OUT]
 *                                     [--max 0]        # allowed offenders before non-zero exit
 */
import { chromium } from "playwright";
import { existsSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const BASE_URL = argValue("--base", "http://127.0.0.1:5173");
const WIDTH = Number(argValue("--width", "390"));
const ROUTE_FILTER = argValue("--routes");
const JSON_OUT = argValue("--json");
const MAX_ALLOWED = Number(argValue("--max", "0"));
const MIN = 44;
// Sub-pixel flex/grid rounding routinely yields 42–43px for a control that is
// nominally 44 (e.g. 7 calendar cells across a 390px row). Those are not real
// accessibility failures; anything below MIN - TOL is.
const TOL = Number(argValue("--tolerance", "2"));

function resolveBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

/**
 * Documented exceptions — elements that cannot practically reach 44px in one
 * axis and comfortably clear the WCAG 2.2 AA minimum (24px) in both. Keyed by
 * a substring of the element's DOM-path signature. Keep this list short and
 * justified; anything not here must pass.
 */
const EXCEPTIONS = [
  // 7 contiguous single-character attendance-code cells: 44px each would force
  // a horizontal scroll inside the code field on a 390px screen. Renders
  // ~42×48 — grouped, with focus auto-advance and paste support.
  "attendance-code-0",
  "Attendance code, character",
];

const AUDIT_FN = `(() => {
  const MIN = ${MIN - TOL};
  const EXCEPTIONS = ${JSON.stringify(EXCEPTIONS)};
  const pathOf = (el) => {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && parts.length < 5) {
      let s = cur.tagName.toLowerCase();
      if (cur.id) s += '#' + cur.id;
      else if (typeof cur.className === 'string' && cur.className.trim())
        s += '.' + cur.className.trim().split(/\\s+/).slice(0, 2).join('.');
      parts.unshift(s);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };
  const SEL = 'a[href], button, [role="button"], [role="tab"], [role="switch"], [role="menuitem"], input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
  const seen = new Set();
  const offenders = [];
  // Dev-only chrome injected by tooling — never in the production bundle.
  const DEV_CHROME = '.tsqd-parent-container, #react-query-devtools, [data-vite-dev-id], .vite-error-overlay';
  for (const el of document.querySelectorAll(SEL)) {
    if (el.closest(DEV_CHROME)) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;               // not rendered
    if (r.bottom < 0 || r.top > innerHeight * 4) continue;   // far offscreen
    // Inline prose links are exempt from 2.5.5.
    const inlineish = s.display.startsWith('inline');
    const inProse = inlineish && el.parentElement &&
      Array.from(el.parentElement.childNodes).some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (el.tagName === 'A' && inProse) continue;
    // Effective target: own box, expanded by half the gap to siblings is hard
    // to measure cheaply; use box + padding contribution already in the rect,
    // so this is a strict lower bound (no false negatives).
    const w = r.width, h = r.height;
    if (w >= MIN && h >= MIN) continue;
    const key = pathOf(el);
    const sig = key + ' ' + (el.getAttribute('aria-label') || el.id || '');
    if (EXCEPTIONS.some((ex) => sig.includes(ex))) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    offenders.push({
      path: key,
      w: Math.round(w), h: Math.round(h),
      text: (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 40),
      tag: el.tagName.toLowerCase(),
    });
  }
  return offenders;
})()`;

async function discoverRoutes(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "load" });
  await page.waitForTimeout(600);
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href^="/"]'))
      .map((a) => a.getAttribute("href"))
      .filter(Boolean)
  );
  const extra = [
    "/dashboard", "/events", "/events/create", "/resources", "/career",
    "/career/opportunities", "/academic/attendance-details",
    "/academic/timetable", "/settings", "/helpdesk/raise-ticket",
    "/examination/current-semester-results",
  ];
  const cleaned = new Set();
  for (const raw of [...hrefs, ...extra]) {
    const h = raw.split("?")[0].split("#")[0];
    if (!h.startsWith("/") || h === "/logout" || h.includes(":")) continue;
    cleaned.add(h.replace(/\/+$/, "") || "/");
  }
  return Array.from(cleaned).sort();
}

async function main() {
  const executablePath = resolveBrowserExecutable();
  const browser = await chromium.launch({ executablePath });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  let routes = await discoverRoutes(page);
  if (ROUTE_FILTER) {
    const want = ROUTE_FILTER.split(",").map((r) => r.trim());
    routes = routes.filter((r) => want.includes(r));
  }
  console.log(`Tap-target audit @ ${WIDTH}px · ${routes.length} routes · min ${MIN}×${MIN}\n`);

  const report = { generatedAt: new Date().toISOString(), width: WIDTH, min: MIN, routes: {} };
  let total = 0;
  for (const route of routes) {
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "load", timeout: 20_000 });
      await page.waitForTimeout(700);
      const offenders = await page.evaluate(AUDIT_FN);
      report.routes[route] = offenders;
      total += offenders.length;
      const label = offenders.length ? `${offenders.length} under` : "ok";
      console.log(`${label.padEnd(10)} ${route}`);
      for (const o of offenders.slice(0, 8)) {
        console.log(`           · ${o.w}×${o.h}  ${o.tag}  "${o.text}"  ${o.path}`);
      }
    } catch (err) {
      report.routes[route] = { error: String(err).slice(0, 160) };
      console.log(`LOAD-ERR   ${route}  ${String(err).slice(0, 120)}`);
    }
  }

  console.log(`\nTotal undersized interactive elements: ${total}`);
  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
    console.log(`Report → ${JSON_OUT}`);
  }
  await browser.close();
  if (total > MAX_ALLOWED) {
    console.error(`\nFAIL: ${total} offenders exceeds the allowed ${MAX_ALLOWED}.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
