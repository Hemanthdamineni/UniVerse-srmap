/**
 * Merges Backend live-page-audit outputs into Frontend/public/fixtures/erp-batch.json
 * for static prototype builds. Prefers processed-data-no-raw-html.json (no rawHtml);
 * falls back to frontend-payload.json with rawHtml stripped.
 *
 * Usage:
 *   node ./scripts/sync-erp-fixtures-from-audit.mjs
 *   ERP_AUDIT_RUN=2026-05-10T11-02-27-383Z node ./scripts/sync-erp-fixtures-from-audit.mjs
 *   ERP_AUDIT_RUN_DIR=/abs/path/to/run-dir node ./scripts/sync-erp-fixtures-from-audit.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const auditRootDefault = path.join(repoRoot, "Backend/data/live-page-audit");
const outFile = path.resolve(__dirname, "../public/fixtures/erp-batch.json");
const sessionProfileOut = path.resolve(__dirname, "../public/fixtures/session-profile.json");

function stripRawHtml(value) {
  if (Array.isArray(value)) return value.map(stripRawHtml);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "rawHtml") continue;
      out[k] = stripRawHtml(v);
    }
    return out;
  }
  return value;
}

function resolveRunDir() {
  const dirEnv = process.env.ERP_AUDIT_RUN_DIR;
  if (dirEnv) {
    const abs = path.isAbsolute(dirEnv) ? dirEnv : path.join(repoRoot, dirEnv);
    if (fs.existsSync(path.join(abs, "summary.json"))) return abs;
    console.error("ERP_AUDIT_RUN_DIR must contain summary.json:", abs);
    process.exit(1);
  }

  const runName = process.env.ERP_AUDIT_RUN;
  if (runName) {
    const p = path.join(auditRootDefault, runName);
    if (fs.existsSync(path.join(p, "summary.json"))) return p;
    console.error("No summary.json under", p);
    process.exit(1);
  }

  if (!fs.existsSync(auditRootDefault)) {
    console.error("Missing audit directory:", auditRootDefault);
    console.error("Run Backend audit:live-pages first, or set ERP_AUDIT_RUN / ERP_AUDIT_RUN_DIR.");
    process.exit(1);
  }

  const names = fs.readdirSync(auditRootDefault).filter((n) => {
    const p = path.join(auditRootDefault, n);
    return fs.statSync(p).isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(n);
  });
  names.sort((a, b) => b.localeCompare(a));
  if (!names.length) {
    console.error("No timestamped run directories under", auditRootDefault);
    process.exit(1);
  }
  return path.join(auditRootDefault, names[0]);
}

function loadPayloadForPage(pageDirRelative, auditBase) {
  const pageDir = path.join(auditBase, pageDirRelative);
  const processed = path.join(pageDir, "processed-data-no-raw-html.json");
  const full = path.join(pageDir, "frontend-payload.json");

  if (fs.existsSync(processed)) {
    return JSON.parse(fs.readFileSync(processed, "utf8"));
  }
  if (fs.existsSync(full)) {
    return stripRawHtml(JSON.parse(fs.readFileSync(full, "utf8")));
  }
  return null;
}

function main() {
  const runDir = resolveRunDir();
  const summaryPath = path.join(runDir, "summary.json");
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  const auditBase = path.dirname(runDir);
  const batch = {};
  let used = 0;
  let skipped = 0;

  for (const row of summary.results || []) {
    if (!row.ok || !row.pageKey || !row.pageDir) {
      skipped++;
      continue;
    }
    const payload = loadPayloadForPage(row.pageDir, auditBase);
    if (!payload) {
      console.warn("Skip (no payload files):", row.pageKey, row.pageDir);
      skipped++;
      continue;
    }
    payload.source = payload.source || "audit-fixture";
    batch[row.pageKey] = payload;
    used++;
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(batch, null, 2), "utf8");
  const kb = Math.round(fs.statSync(outFile).size / 1024);
  console.log(`Wrote ${used} page keys to ${path.relative(repoRoot, outFile)} (~${kb} KiB). Skipped: ${skipped}`);

  const profileEntry = batch.profile;
  const tableContent =
    profileEntry &&
    typeof profileEntry === "object" &&
    profileEntry.data &&
    typeof profileEntry.data === "object" &&
    profileEntry.data.TableContent &&
    typeof profileEntry.data.TableContent === "object"
      ? profileEntry.data.TableContent
      : null;
  if (tableContent) {
    fs.writeFileSync(sessionProfileOut, JSON.stringify({ TableContent: tableContent }, null, 2), "utf8");
    console.log("Wrote", path.relative(repoRoot, sessionProfileOut));
  } else {
    console.warn("No profile TableContent in batch; skipped session-profile.json");
  }

  console.log("Audit run:", path.relative(repoRoot, runDir));
}

main();
