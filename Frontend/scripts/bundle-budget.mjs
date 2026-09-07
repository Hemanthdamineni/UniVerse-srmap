#!/usr/bin/env node
/**
 * Bundle + precache budget check (Batch B2 / T8.2.3).
 *
 * Runs against a fresh `dist/` (build first). Fails the build when any of:
 *
 *   1. the gzipped total of `dist/assets/**\/*.js` exceeds JS_GZIP_BUDGET_KIB
 *   2. the single largest gzipped JS chunk exceeds LARGEST_CHUNK_GZIP_KIB
 *      (guards the lazy KaTeX chunk — Rollup-misnamed `mermaid-*.js` — from
 *       creeping, and catches any new eager mega-chunk)
 *   3. the Workbox precache set (same glob as vite.config's PWA `globPatterns`,
 *      minus its `globIgnores`) exceeds PRECACHE_BUDGET_KIB
 *
 * Budgets carry ~8–10% headroom over the current build. Bumping one is a
 * deliberate act: do it in the same PR that adds the weight, with a note.
 *
 * Usage: node scripts/bundle-budget.mjs [--dist dist] [--json OUT]
 */
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const argValue = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const DIST = path.resolve(process.cwd(), argValue("--dist", "dist"));
const JSON_OUT = argValue("--json");

const JS_GZIP_BUDGET_KIB = 1230;
const LARGEST_CHUNK_GZIP_KIB = 330;
const PRECACHE_BUDGET_KIB = 5300;

// Must mirror vite.config.ts → VitePWA.workbox.{globPatterns,globIgnores}.
const PRECACHE_EXT = new Set(["js", "css", "html", "woff2", "svg", "png"]);
const PRECACHE_IGNORE = [
  /icons\/badges\.jpeg$/,
  /icons\/dark_mode_badge\.jpeg$/,
  /icons\/light_mode_badge\.jpeg$/,
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.error(`bundle-budget: no build at ${DIST} — run \`npm run build\` first.`);
  process.exit(2);
}

const allFiles = walk(DIST);

// 1 + 2 — JS chunks
const jsFiles = allFiles.filter((f) => f.startsWith(path.join(DIST, "assets")) && f.endsWith(".js"));
let jsGzipTotal = 0;
let largest = { name: "", gzip: 0 };
for (const file of jsFiles) {
  const gzip = gzipSync(readFileSync(file), { level: 9 }).length;
  jsGzipTotal += gzip;
  if (gzip > largest.gzip) largest = { name: path.relative(DIST, file), gzip };
}

// 3 — precache set
const precacheFiles = allFiles.filter((f) => {
  const ext = f.split(".").pop();
  if (!PRECACHE_EXT.has(ext)) return false;
  return !PRECACHE_IGNORE.some((re) => re.test(f));
});
const precacheBytes = precacheFiles.reduce((sum, f) => sum + statSync(f).size, 0);

const kib = (bytes) => bytes / 1024;
const report = {
  jsChunks: jsFiles.length,
  jsGzipKiB: +kib(jsGzipTotal).toFixed(1),
  jsGzipBudgetKiB: JS_GZIP_BUDGET_KIB,
  largestChunk: largest.name,
  largestChunkGzipKiB: +kib(largest.gzip).toFixed(1),
  largestChunkBudgetKiB: LARGEST_CHUNK_GZIP_KIB,
  precacheFiles: precacheFiles.length,
  precacheKiB: +kib(precacheBytes).toFixed(1),
  precacheBudgetKiB: PRECACHE_BUDGET_KIB,
};

const failures = [];
if (report.jsGzipKiB > JS_GZIP_BUDGET_KIB) {
  failures.push(`JS gzip total ${report.jsGzipKiB} KiB > ${JS_GZIP_BUDGET_KIB} KiB budget`);
}
if (report.largestChunkGzipKiB > LARGEST_CHUNK_GZIP_KIB) {
  failures.push(
    `largest chunk ${report.largestChunk} ${report.largestChunkGzipKiB} KiB > ${LARGEST_CHUNK_GZIP_KIB} KiB budget`,
  );
}
if (report.precacheKiB > PRECACHE_BUDGET_KIB) {
  failures.push(`precache set ${report.precacheKiB} KiB > ${PRECACHE_BUDGET_KIB} KiB budget`);
}

console.log(
  [
    `JS chunks:      ${report.jsChunks}`,
    `JS gzip total:  ${report.jsGzipKiB} / ${JS_GZIP_BUDGET_KIB} KiB`,
    `largest chunk:  ${report.largestChunk} — ${report.largestChunkGzipKiB} / ${LARGEST_CHUNK_GZIP_KIB} KiB gzip`,
    `precache set:   ${report.precacheFiles} files, ${report.precacheKiB} / ${PRECACHE_BUDGET_KIB} KiB`,
  ].join("\n"),
);

if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));

if (failures.length) {
  console.error(`\nbundle-budget: FAIL\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log("\nbundle-budget: OK");
