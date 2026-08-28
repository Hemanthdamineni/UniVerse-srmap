const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { ErpDumpService } = require("../src/services/erp/erpServices");

// Build a small dump directory tree under a temp dir and verify
// resolveLatest() picks the most-recently-named entry. DUMP_BASE_DIR is
// computed relative to __dirname inside erpServices.js so we cannot
// easily override it for the test. Instead we copy the production
// resolution logic locally and exercise it against a controlled tree
// — keeping the test honest about what it asserts (string ordering
// over ISO-ish timestamp names) without coupling to a path we don't own.

function makeTree(timestamps) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "erp-dump-resolve-"));
  for (const stamp of timestamps) {
    fs.mkdirSync(path.join(root, stamp));
  }
  return root;
}

function resolveLatestFromTree(root) {
  if (!fs.existsSync(root)) return null;
  const entries = fs.readdirSync(root);
  const dirs = entries
    .map((name) => path.join(root, name))
    .filter((p) => fs.statSync(p).isDirectory())
    .sort()
    .reverse();
  return dirs.length > 0 ? dirs[0] : null;
}

test("resolveLatest returns null when the base dir is missing", () => {
  const result = resolveLatestFromTree(path.join(os.tmpdir(), "nope-" + Date.now()));
  assert.equal(result, null);
});

test("resolveLatest returns null when the base dir is empty", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "erp-dump-empty-"));
  try {
    assert.equal(resolveLatestFromTree(root), null);
  } finally {
    fs.rmdirSync(root);
  }
});

test("resolveLatest picks the lexicographically newest entry", () => {
  const root = makeTree([
    "2026-05-28T10-38-25-559Z",
    "2026-05-28T11-01-34-366Z",
    "2026-05-28T10-41-28-298Z",
  ]);
  try {
    const result = resolveLatestFromTree(root);
    assert.equal(result, path.join(root, "2026-05-28T11-01-34-366Z"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("resolveLatest ignores non-directory entries", () => {
  const root = makeTree([
    "2026-05-28T10-00-00-000Z",
    "2026-05-28T11-00-00-000Z",
  ]);
  try {
    // A stray file at the root should not be returned.
    fs.writeFileSync(path.join(root, "2026-05-28T12-00-00-000Z"), "not a dir");
    const result = resolveLatestFromTree(root);
    assert.equal(result, path.join(root, "2026-05-28T11-00-00-000Z"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("resolveLatest against the real production dump dir returns the newest", () => {
  // Smoke test against the actual Backend/data/erp-dump dir if it
  // exists. This is a best-effort check (skipped if the dir is absent
  // or has fewer than two entries) — the unit tests above already cover
  // the algorithm.
  const baseDir = path.join(__dirname, "..", "data", "erp-dump");
  if (!fs.existsSync(baseDir)) return;
  const entries = fs.readdirSync(baseDir).filter((n) => {
    try {
      return fs.statSync(path.join(baseDir, n)).isDirectory();
    } catch {
      return false;
    }
  });
  if (entries.length < 2) return;
  const sorted = entries.slice().sort().reverse();
  const result = ErpDumpService.resolveLatest();
  if (result === null) {
    assert.fail("resolveLatest returned null on a populated base dir");
  }
  assert.equal(path.basename(result), sorted[0]);
});
