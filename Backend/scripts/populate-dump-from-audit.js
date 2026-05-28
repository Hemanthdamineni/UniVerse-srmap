const fs = require("fs");
const path = require("path");

const AUDIT_DIR = path.join(__dirname, "../data/live-page-audit");
const DUMP_BASE_DIR = path.join(__dirname, "../data/erp-dump");

function ts() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`[${ts()}] ${msg}`);
}

function findLatestDump() {
  if (!fs.existsSync(DUMP_BASE_DIR)) return null;
  const dirs = fs
    .readdirSync(DUMP_BASE_DIR)
    .map((n) => path.join(DUMP_BASE_DIR, n))
    .filter((p) => fs.statSync(p).isDirectory())
    .sort()
    .reverse();
  return dirs.length > 0 ? dirs[0] : null;
}

function findLatestAudit() {
  if (!fs.existsSync(AUDIT_DIR)) return null;
  const dirs = fs
    .readdirSync(AUDIT_DIR)
    .map((n) => path.join(AUDIT_DIR, n))
    .filter((p) => fs.statSync(p).isDirectory())
    .sort()
    .reverse();
  return dirs.length > 0 ? dirs[0] : null;
}

function encodeKey(dropdown, subitem) {
  const d = (dropdown || "").replace(/[/\\|]/g, "_");
  const s = (subitem || "").replace(/[/\\|]/g, "_");
  return `${d}|${s}`;
}

function main() {
  const dumpDir = findLatestDump();
  if (!dumpDir) {
    log("ERROR: No dump directory found");
    process.exit(1);
  }
  log(`Using dump: ${dumpDir}`);

  const auditDir = findLatestAudit();
  if (!auditDir) {
    log("ERROR: No audit directory found");
    process.exit(1);
  }
  log(`Using audit: ${auditDir}`);

  const rawDir = path.join(dumpDir, "raw");
  const pagesDir = path.join(auditDir, "pages");

  if (!fs.existsSync(pagesDir)) {
    log("ERROR: No pages directory in audit");
    process.exit(1);
  }

  let copiedCount = 0;
  let skippedCount = 0;
  const populatedEntries = [];

  const pageDirs = fs
    .readdirSync(pagesDir)
    .map((n) => path.join(pagesDir, n))
    .filter((p) => fs.statSync(p).isDirectory())
    .sort();

  for (const pageDir of pageDirs) {
    const rawIndexPath = path.join(pageDir, "raw-index.json");
    if (!fs.existsSync(rawIndexPath)) {
      skippedCount++;
      continue;
    }

    const rawIndex = JSON.parse(fs.readFileSync(rawIndexPath, "utf8"));
    if (!Array.isArray(rawIndex) || rawIndex.length === 0) {
      skippedCount++;
      continue;
    }

    for (const entry of rawIndex) {
      const trail = entry.trail;
      if (!Array.isArray(trail) || trail.length < 3) continue;

      const dropdown = trail[1];
      const subitem = trail[2];
      const sourceFile = entry.file;
      const sourcePath = path.join(pageDir, sourceFile);

      if (!fs.existsSync(sourcePath)) {
        log(`  WARN: ${sourceFile} not found in ${path.basename(pageDir)}`);
        continue;
      }

      const content = fs.readFileSync(sourcePath, "utf8");
      const destKey = encodeKey(dropdown, subitem);
      const destFile = `${destKey}.html`;
      const destPath = path.join(rawDir, destFile);

      fs.writeFileSync(destPath, content, "utf8");
      populatedEntries.push({ dropdown, subitem, bytes: Buffer.byteLength(content), key: destKey });
      copiedCount++;
    }
  }

  // Write profile data from audit's login-profile.json
  const loginProfilePath = path.join(auditDir, "login-profile.json");
  if (fs.existsSync(loginProfilePath)) {
    const loginData = JSON.parse(fs.readFileSync(loginProfilePath, "utf8"));
    const profileData = loginData.profileData || loginData;
    fs.writeFileSync(path.join(dumpDir, "profile.json"), JSON.stringify(profileData, null, 2), "utf8");
    log(`Profile written (${Buffer.byteLength(JSON.stringify(profileData))} bytes)`);
  } else {
    log("WARN: No login-profile.json found, profile unchanged");
  }

  // Update summary.json
  const summaryPath = path.join(dumpDir, "summary.json");
  let summary = { generatedAt: ts(), durationMs: 0, pageCount: 0, successCount: 0, failureCount: 0, results: [], populatedFromAudit: true };
  if (fs.existsSync(summaryPath)) {
    try {
      summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    } catch {}
  }

  summary.populatedFromAudit = true;
  summary.generatedAt = ts();
  summary.pageCount = copiedCount;
  summary.successCount = copiedCount;
  summary.failureCount = 0;
  summary.results = populatedEntries.map((e) => ({
    dropdown: e.dropdown,
    subitem: e.subitem,
    status: 200,
    ok: true,
    bytes: e.bytes,
    rawFile: `${e.key}.html`,
  }));

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  log(`Summary written: ${copiedCount} pages, 0 failures`);
  log(`Done — copied ${copiedCount} raw HTML files to dump`);
}

main();
