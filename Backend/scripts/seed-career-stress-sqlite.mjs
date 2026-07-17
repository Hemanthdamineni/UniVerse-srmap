#!/usr/bin/env node
/**
 * Builds a large career.sqlite for k6 / load testing.
 *
 * Usage:
 *   node scripts/seed-career-stress-sqlite.mjs --out data/career-stress.sqlite --count 150000
 *
 * Requires Node.js 22+ (node:sqlite DatabaseSync).
 * Deletes existing file when --force is passed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { CareerStore } = require("../src/services/career/careerStore.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  let out = path.join(repoRoot, "data", "career-stress.sqlite");
  let count = 150_000;
  let force = false;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") out = path.resolve(repoRoot, argv[++i] || "");
    else if (a === "--count") count = Math.max(1, Number.parseInt(argv[++i] || "0", 10) || 150_000);
    else if (a === "--force") force = true;
  }
  return { out, count, force };
}

const TYPES = ["job", "internship", "hackathon", "competition", "fellowship", "workshop"];
const SOURCES = ["manual", "jobspy", "devfolio", "unstop"];

const { out, count, force } = parseArgs(process.argv);

if (force && fs.existsSync(out)) {
  fs.unlinkSync(out);
}

const store = new CareerStore({ dbPath: out });
const db = store.db;

db.exec("DELETE FROM career_bookmarks");
db.exec("DELETE FROM career_views");
db.exec("DELETE FROM career_applications");
db.exec("DELETE FROM career_opportunities");

const now = new Date().toISOString();
const insert = db.prepare(`
  INSERT INTO career_opportunities (
    id, type, title, company, organizer, description, shortDescription,
    skills, tags, location, mode, isPanIndia, eligibleBranches, eligibleYears,
    stipend, prize, isFree, postedAt, deadline, startDate, duration,
    source, sourceUrl, applyUrl, viewCount, bookmarkCount, applyCount,
    relevanceScore, isActive, isVerified, isFeatured, moderationState,
    scrapedAt, updatedAt
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )
`);

const batchSize = 2000;
console.error(`Seeding ${count} rows into ${out} ...`);

for (let start = 0; start < count; start += batchSize) {
  const end = Math.min(start + batchSize, count);
  db.exec("BEGIN IMMEDIATE");
  for (let i = start; i < end; i++) {
    const id = `stress-${i}`;
    const type = TYPES[i % TYPES.length];
    const source = SOURCES[i % SOURCES.length];
    const title = `Stress opportunity ${i}`;
    const desc = `Description for ${id} with enough text for shortDescription truncation rules.`;
    const sourceUrl = `https://stress.example/opps/${i}`;
    const applyUrl = `https://stress.example/apply/${i}`;
    insert.run(
      id,
      type,
      title,
      "Stress Corp",
      null,
      desc,
      desc.slice(0, 200),
      "[]",
      "[]",
      "Remote",
      "remote",
      1,
      "[]",
      "[]",
      null,
      null,
      1,
      now,
      "2027-06-01T00:00:00.000Z",
      null,
      null,
      source,
      sourceUrl,
      applyUrl,
      (i % 50) + 1,
      (i % 17) + 1,
      (i % 9) + 1,
      10 + (i % 40),
      1,
      1,
      i % 100 === 0 ? 1 : 0,
      0,
      now,
      now
    );
  }
  db.exec("COMMIT");
  console.error(`  inserted ${end} / ${count}`);
}

try {
  db.exec("DELETE FROM career_search");
  db.exec(`
    INSERT INTO career_search(rowid, title, description, skills, tags, company, organizer)
    SELECT rowid, title, description, skills, tags, company, organizer FROM career_opportunities
  `);
} catch (e) {
  console.error("FTS rebuild skipped:", e.message);
}

const row = db.prepare("SELECT COUNT(*) AS c FROM career_opportunities").get();
console.error(`Done. career_opportunities rows: ${row.c}`);
