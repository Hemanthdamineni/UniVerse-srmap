#!/usr/bin/env node
/**
 * Responsive layout audit.
 *
 * Boots against a running Vite dev server (static prototype mode), discovers
 * every internal route from the rendered sidebar/DOM, then sweeps a matrix of
 * viewport widths per route and reports:
 *   - page-level horizontal overflow at each width
 *   - the specific elements poking past the viewport (excluding elements that
 *     legitimately live inside a horizontally-scrollable container)
 *   - console errors per route
 *   - a live-resize pass (viewport stepped without reload) for key routes
 *   - optional full-page screenshots for visual review
 *
 * Usage:
 *   node scripts/responsive-audit.mjs [--base URL] [--out DIR]
 *                                     [--widths 320,768,1440]
 *                                     [--routes /dashboard,/events]
 *                                     [--no-screens]
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}
const hasFlag = (flag) => args.includes(flag);

const BASE_URL = argValue("--base", "http://127.0.0.1:5173");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const OUT_DIR =
  argValue("--out", `/tmp/university-erp-responsive/${STAMP}`);
const ALL_WIDTHS = [320, 375, 768, 1024, 1280, 1920, 2560];
const WIDTHS = argValue("--widths")
  ? argValue("--widths").split(",").map(Number)
  : ALL_WIDTHS;
const ROUTE_FILTER = argValue("--routes");
const TAKE_SCREENS = !hasFlag("--no-screens");
// CI mode: exit non-zero when any route overflows/clips/fails to load.
const FAIL_ON_ISSUES = !hasFlag("--no-fail");

/** Resolve a Chromium executable across dev machines and CI runners. */
function resolveBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (found) return found;
  // Fall back to Playwright's own managed browser, when installed.
  return undefined;
}

/** Launch chromium trying each candidate until one works. */
async function launchBrowser() {
  const primary = resolveBrowserExecutable();
  const attempts = [primary, undefined].filter(
    (value, index, list) => value !== list[index - 1]
  );
  let lastError;
  for (const executablePath of attempts) {
    try {
      return await chromium.launch({ executablePath });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
const RESIZE_ROUTES = [
  "/dashboard",
  "/academic/timetable",
  "/academic/attendance-details",
  "/events",
  "/resources",
  "/career/opportunities",
];
const SETTLE_MS = 700;

/** Wait until loading skeletons have cleared so we measure real content. */
async function waitForContent(page) {
  await page.waitForLoadState("load");
  try {
    await page.waitForLoadState("networkidle", { timeout: 2_500 });
  } catch { /* long-lived connections are fine */ }
  try {
    await page.waitForFunction(
      () => !document.querySelector(".skeleton-shimmer"),
      { timeout: 5_000 }
    );
  } catch { /* page may legitimately retain shimmer widgets */ }
  await page.waitForTimeout(SETTLE_MS);
}

function parseRoutesArg(raw) {
  if (!raw) return null;
  return raw.split(",").map((r) => r.trim()).filter(Boolean);
}

const AUDIT_FN = `(() => {
  const tolerance = 1;
  const pathOf = (el) => {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && parts.length < 5) {
      let s = cur.tagName.toLowerCase();
      if (cur.id) s += '#' + cur.id;
      else if (typeof cur.className === 'string' && cur.className.trim()) {
        s += '.' + cur.className.trim().split(/\\s+/).slice(0, 2).join('.');
      }
      parts.unshift(s);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };
  const insideReachableScroller = (el, limit) => {
    let p = el.parentElement;
    while (p && p !== limit) {
      const s = getComputedStyle(p);
      if ((s.overflowX === "auto" || s.overflowX === "scroll") &&
          p.scrollWidth > p.clientWidth + tolerance) return true;
      p = p.parentElement;
    }
    return false;
  };
  const collectOffenders = (rootEl, limitPx) => {
    const out = [];
    const seen = new Set();
    for (const el of rootEl.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.right <= limitPx + tolerance) continue;
      if (insideReachableScroller(el, rootEl)) continue;
      const key = pathOf(el);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        path: key,
        text: (el.textContent || "").trim().slice(0, 60),
        overBy: Math.round(r.right - limitPx),
      });
      if (out.length >= 6) break;
    }
    return out;
  };

  const doc = document.documentElement;
  const vw = window.innerWidth;
  const sw = Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0);
  const result = { vw, scrollWidth: sw, overflowX: sw - vw, offenders: [], mainOverflowX: 0 };

  // The app shell scrolls inside <main>; the document itself never does.
  // Content wider than main's client box is a layout leak even when
  // technically scrollable, so report it separately.
  const mainEl = document.querySelector("main");
  if (mainEl) {
    result.mainOverflowX = Math.max(0, mainEl.scrollWidth - mainEl.clientWidth);
    if (result.mainOverflowX > tolerance && result.overflowX <= tolerance) {
      const mr = mainEl.getBoundingClientRect();
      result.offenders = collectOffenders(mainEl, Math.min(mr.right, vw));
    }
  }

  if (result.overflowX > tolerance) {
    result.offenders = collectOffenders(document.body, vw);
  }
  return result;
})()`;

/**
 * Detects ACTUALLY clipped content: a text-bearing leaf element whose box
 * extends past a non-scrollable clipping ancestor (overflow hidden/clip),
 * with no reachable scrollbar. Unlike raw scrollWidth checks this ignores
 * decorative protrusions under visible overflow (e.g. the sidebar's
 * protruding toggle button).
 */
const CLIP_FN = `(() => {
  const tolerance = 2;
  const pathOf = (el) => {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && parts.length < 5) {
      let s = cur.tagName.toLowerCase();
      if (cur.id) s += '#' + cur.id;
      else if (typeof cur.className === 'string' && cur.className.trim()) {
        s += '.' + cur.className.trim().split(/\\s+/).slice(0, 2).join('.');
      }
      parts.unshift(s);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  };
  const clips = [];
  const seen = new Set();
  const SKIP = new Set(["INPUT", "TEXTAREA", "SELECT", "IMG", "VIDEO", "CANVAS", "SVG", "IFRAME"]);
  for (const el of document.querySelectorAll("main *")) {
    if (!el.offsetParent) continue; // not rendered
    if (SKIP.has(el.tagName)) continue;
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") continue;
    if (parseFloat(s.opacity) < 0.05) continue;
    // Leaf-ish content carriers only (deepest element wins, avoids dupes)
    const directText = Array.from(el.childNodes).some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 0
    );
    if (!directText || el.children.length > 0) continue;
    const er = el.getBoundingClientRect();
    if (er.width <= 0) continue;
    // Walk up for a clipping or scrollable ancestor
    let a = el.parentElement;
    let clippedBy = null;
    while (a && a !== document.body) {
      const as = getComputedStyle(a);
      const ox = as.overflowX;
      if (ox === "hidden" || ox === "clip") {
        // Deliberate ellipsis truncation is not lost content
        if (as.textOverflow === "ellipsis") break;
        const ar = a.getBoundingClientRect();
        if (er.right > ar.right + tolerance || er.left < ar.left - tolerance) {
          clippedBy = { el: a, cut: Math.max(er.right - ar.right, ar.left - er.left) };
        }
        break; // nearest hard clipper decides; outer ones can't un-clip it
      }
      if ((ox === "auto" || ox === "scroll") && a.scrollWidth > a.clientWidth + tolerance) {
        break; // reachable via scrollbar — not lost content
      }
      a = a.parentElement;
    }
    if (!clippedBy) continue;
    const key = pathOf(clippedBy.el);
    if (seen.has(key)) continue;
    seen.add(key);
    clips.push({
      path: key,
      text: (el.textContent || "").trim().slice(0, 50),
      clipPx: Math.round(clippedBy.cut),
    });
    if (clips.length >= 8) break;
  }
  return { count: clips.length, clips };
})()`;

async function discoverRoutes(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "load" });
  await page.waitForTimeout(SETTLE_MS);
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href^="/"]'))
      .map((a) => a.getAttribute("href"))
      .filter(Boolean)
  );
  const extra = [
    "/login", "/dashboard", "/profile", "/events", "/events/create",
    "/events/my-activity", "/resources", "/resources/browse",
    "/resources/guides", "/resources/question-bank", "/resources/roadmaps",
    "/career", "/career/opportunities", "/helpdesk/faqs",
  ];
  const all = new Set([...hrefs, ...extra]);
  const cleaned = new Set();
  for (const raw of all) {
    const h = raw.split("?")[0].split("#")[0];
    if (!h.startsWith("/")) continue;
    if (h === "/logout" || h === "/Home") continue;
    if (h.includes(":")) continue; // unresolved param templates
    if (/\d|id/i.test(h.split("/").pop()) && h.split("/").length > 2 && !h.startsWith("/resources/me")) {
      // keep concrete detail pages (e.g. /events/e-123, /career/opportunities/x)
    }
    cleaned.add(h.replace(/\/+$/, "") || "/");
  }
  return Array.from(cleaned).sort();
}

async function auditRouteAtWidth(page, route, width) {
  const errors = [];
  const handler = (msg) => {
    if (msg.type() === "error") errors.push(msg.text().slice(0, 160));
  };
  page.on("console", handler);
  try {
    await page.setViewportSize({ width, height: width <= 500 ? 760 : width <= 1100 ? 900 : 940 });
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "load", timeout: 20_000 });
    await waitForContent(page);
    const audit = await page.evaluate(AUDIT_FN);
    audit.clips = await page.evaluate(CLIP_FN);
    audit.consoleErrors = errors.slice(0, 3);
    return audit;
  } catch (err) {
    return { vw: width, error: String(err).slice(0, 160), overflowX: 0, offenders: [], clips: { count: 0, clips: [] }, consoleErrors: errors.slice(0, 3) };
  } finally {
    page.off("console", handler);
  }
}

/** Viewport-stepped captures through the inner <main> scroller (fullPage can't
 *  see below the fold in an overflow-hidden app shell). */
async function scrollShots(page, dir, baseName) {
  const steps = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return [0];
    const max = Math.max(0, main.scrollHeight - main.clientHeight);
    const n = Math.min(4, Math.ceil(max / (main.clientHeight * 0.9)));
    const out = [];
    for (let i = 0; i <= n; i++) out.push(Math.round((max * i) / Math.max(1, n)));
    return [...new Set(out)];
  });
  for (let i = 0; i < steps.length; i++) {
    await page.evaluate((y) => {
      const m = document.querySelector("main");
      if (m) m.scrollTop = y;
    }, steps[i]);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(dir, `${baseName}-s${i}.png`) });
  }
}

async function liveResizePass(page, route) {
  const steps = [1440, 1280, 1024, 768, 600, 480, 414, 375, 320, 375, 768, 1024, 1440];
  await page.setViewportSize({ width: 1440, height: 940 });
  await page.goto(`${BASE_URL}${route}`, { waitUntil: "load", timeout: 20_000 });
  await waitForContent(page);
  const timeline = [];
  for (const w of steps) {
    await page.setViewportSize({ width: w, height: w <= 500 ? 760 : w <= 1100 ? 900 : 940 });
    await page.waitForTimeout(220);
    const r = await page.evaluate(AUDIT_FN);
    timeline.push({
      w,
      overflowX: Math.max(r.overflowX, r.mainOverflowX ?? 0),
      top: r.offenders[0]?.path ?? null,
    });
  }
  return timeline;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await launchBrowser();
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();

  console.log(`Discovering routes from ${BASE_URL}/dashboard ...`);
  let routes = await discoverRoutes(page);
  const filter = parseRoutesArg(ROUTE_FILTER);
  if (filter) routes = routes.filter((r) => filter.includes(r));
  console.log(`Auditing ${routes.length} routes × [${WIDTHS.join(", ")}] px\n`);

  const report = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, routes: {} };
  const slug = (r) => r.replace(/^\//, "").replace(/\//g, "_") || "root";

  for (const route of routes) {
    const entry = { widths: {}, worst: 0 };
    for (const width of WIDTHS) {
      const audit = await auditRouteAtWidth(page, route, width);
      entry.widths[width] = audit;
      const wOver = Math.max(audit.overflowX, audit.mainOverflowX ?? 0);
      if (wOver > entry.worst) entry.worst = wOver;
      if (audit.error) entry.loadError = audit.error;
      if (TAKE_SCREENS && [320, 1440].includes(width)) {
        const dir = path.join(OUT_DIR, "screens", String(width));
        mkdirSync(dir, { recursive: true });
        try {
          if (width === 320 && !audit.error) {
            await scrollShots(page, dir, slug(route));
          } else {
            await page.screenshot({ path: path.join(dir, `${slug(route)}.png`) });
          }
        } catch { /* screenshot failures are non-fatal */ }
      }
    }
    report.routes[route] = entry;
    const bad = Object.entries(entry.widths)
      .filter(([, a]) => a.overflowX > 1 || (a.mainOverflowX ?? 0) > 1)
      .map(([w, a]) => `${w}px:+${a.overflowX || a.mainOverflowX}`);
    const clipWorst = Object.entries(entry.widths)
      .filter(([, a]) => (a.clips?.count ?? 0) > 0)
      .map(([w, a]) => `${w}px`);
    const status = entry.loadError ? "LOAD-ERR" : bad.length ? "OVERFLOW" : clipWorst.length ? "CLIPPED" : "ok";
    console.log(`${status.padEnd(9)} ${route}${bad.length ? "  → " + bad.join("  ") : ""}${clipWorst.length ? `  [clips @ ${clipWorst.join(",")}]` : ""}`);
    if (entry.worst > 0) {
      for (const [, a] of Object.entries(entry.widths)) {
        for (const o of a.offenders.slice(0, 2)) {
          console.log(`           · ${o.overBy}px  ${o.path}  "${o.text}"`);
        }
      }
    }
    for (const [, a] of Object.entries(entry.widths)) {
      for (const c of a.clips?.clips?.slice(0, 3) ?? []) {
        console.log(`           · clip ${c.clipPx}px  ${c.path}  "${c.text}"`);
      }
    }
    if (entry.loadError) console.log(`           · ${entry.loadError}`);
  }

  console.log("\nLive-resize pass (no reload between steps):");
  report.liveResize = {};
  for (const route of RESIZE_ROUTES.filter((r) => routes.includes(r))) {
    const timeline = await liveResizePass(page, route);
    report.liveResize[route] = timeline;
    const bad = timeline.filter((t) => t.overflowX > 1);
    console.log(
      `${bad.length ? "RESIZE-OVERFLOW" : "ok            "} ${route}` +
        (bad.length ? `  → ${bad.map((t) => `${t.w}px:+${t.overflowX}`).join("  ")}` : "")
    );
  }

  writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  const issueCount = Object.values(report.routes).filter(
    (entry) => entry.loadError || entry.worst > 0 || Object.values(entry.widths).some((a) => (a.clips?.count ?? 0) > 0)
  ).length;
  console.log(`\nRoutes with issues: ${issueCount}/${routes.length}`);
  console.log(`Report + screenshots → ${OUT_DIR}`);
  await browser.close();
  if (FAIL_ON_ISSUES && issueCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
