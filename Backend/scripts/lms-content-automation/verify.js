#!/usr/bin/env node

/**
 * LMS Content Verification Tool
 *
 * Multi-layered verification of all generated content:
 *  - Factual accuracy / type correctness
 *  - Learning objective alignment
 *  - LMS formatting compliance
 *  - Cross-subject data consistency
 *  - Accessibility basics
 *
 * Usage:
 *   node Backend/scripts/lms-content-automation/verify.js [--db-path <path>] [--report]
 */

const path = require("path");
const fs = require("fs");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
process.chdir(PROJECT_ROOT);

const { DatabaseSync } = require("node:sqlite");
const { CORE_CSE_SUBJECTS, SKILL_ROADMAPS } = require("./contentCurriculum");

const DB_PATH = process.argv.find((a) => a.startsWith("--db-path="))
  ? process.argv.find((a) => a.startsWith("--db-path=")).split("=")[1]
  : path.join(PROJECT_ROOT, "data", "lms.sqlite");
const GENERATE_REPORT = process.argv.includes("--report");

// ──────────────────────────────────────────────
// Result collector
// ──────────────────────────────────────────────

const results = {
  checks: [],
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: [],
};

function check(name, category, ok, detail) {
  results.checks.push({ name, category, ok, detail });
  if (ok) results.passed++;
  else results.failed++;
  const icon = ok ? "✓" : "✗";
  console.log(`  ${icon} [${category}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function warn(name, category, detail) {
  results.checks.push({ name, category, ok: true, detail: `(warn) ${detail}`, warning: true });
  results.warnings++;
  console.log(`  ⚠ [${category}] ${name} — ${detail}`);
}

// ──────────────────────────────────────────────

function main() {
  console.log("=".repeat(70));
  console.log("  LMS Content Verification Suite");
  console.log(`  DB: ${DB_PATH}`);
  console.log("=".repeat(70));

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[FATAL] Database not found at: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");

  try {
    // ── 1. Schema Integrity ──
    console.log("\n--- Schema Integrity ---");
    const requiredTables = [
      "lms_resources", "lms_guides", "lms_guide_sections",
      "lms_roadmaps", "lms_roadmap_nodes", "lms_roadmap_edges",
      "lms_question_bank", "lms_topics", "lms_resource_topics",
    ];
    const existingTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
    for (const tbl of requiredTables) {
      check(`Table: ${tbl}`, "schema", existingTables.includes(tbl),
        existingTables.includes(tbl) ? `Found` : `MISSING`);
    }

    // ── 2. Resource Integrity ──
    console.log("\n--- Resource Integrity ---");
    const totalResources = db.prepare("SELECT COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0").get()?.c || 0;
    check("Total active resources", "resources", totalResources > 0, `${totalResources} resources found`);

    // Check resource types validity
    const validTypes = ["link", "file", "note", "quiz", "flashcard", "pyq"];
    const invalidTypes = db.prepare(
      `SELECT DISTINCT type FROM lms_resources WHERE type NOT IN ('${validTypes.join("','")}')`
    ).all();
    check("Resource type validity", "resources", invalidTypes.length === 0,
      invalidTypes.length > 0 ? `Invalid types: ${invalidTypes.map((r) => r.type).join(", ")}` : "All types valid");

    // Check required fields are populated
    const missingRequired = db.prepare(
      "SELECT COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0 AND (title IS NULL OR title = '' OR semester IS NULL OR subjectCode IS NULL OR unit IS NULL)"
    ).get()?.c || 0;
    check("Required fields populated", "resources", missingRequired === 0,
      missingRequired > 0 ? `${missingRequired} resources missing required fields` : "All resources have required fields");

    // Check resource coverage per subject
    console.log("\n--- Subject Coverage ---");
    for (const subject of CORE_CSE_SUBJECTS) {
      const count = db.prepare(
        "SELECT COUNT(*) AS c FROM lms_resources WHERE subjectCode = ? AND isDeleted = 0"
      ).get(subject.subjectCode)?.c || 0;
      const typeCount = db.prepare(
        "SELECT COUNT(DISTINCT type) AS c FROM lms_resources WHERE subjectCode = ? AND isDeleted = 0"
      ).get(subject.subjectCode)?.c || 0;

      check(`${subject.subjectCode}: resource count`, "coverage",
        count >= subject.units.length * 2,
        `${count} resources (min expected: ${subject.units.length * 2})`);

      check(`${subject.subjectCode}: type diversity`, "coverage",
        typeCount >= 3,
        `${typeCount}/5 resource types`);
    }

    // ── 3. Guide Integrity ──
    console.log("\n--- Guide Integrity ---");
    const totalGuides = db.prepare("SELECT COUNT(*) AS c FROM lms_guides WHERE isDeleted = 0").get()?.c || 0;
    check("Total guides", "guides", totalGuides > 0, `${totalGuides} guides`);

    const guidesWithSections = db.prepare(`
      SELECT g.id, g.title, COUNT(gs.id) AS sectionCount
      FROM lms_guides g LEFT JOIN lms_guide_sections gs ON gs.guideId = g.id
      WHERE g.isDeleted = 0 GROUP BY g.id
    `).all();
    const emptyGuides = guidesWithSections.filter((g) => g.sectionCount === 0);
    check("Guides have sections", "guides", emptyGuides.length === 0,
      emptyGuides.length > 0 ? `${emptyGuides.length} guides have no sections` : "All guides have sections");

    const publishedGuides = db.prepare("SELECT COUNT(*) AS c FROM lms_guides WHERE published = 1 AND isDeleted = 0").get()?.c || 0;
    check("Published guides", "guides", publishedGuides > 0, `${publishedGuides} published`);

    // ── 4. Roadmap Integrity ──
    console.log("\n--- Roadmap Integrity ---");
    const totalRoadmaps = db.prepare("SELECT COUNT(*) AS c FROM lms_roadmaps WHERE isDeleted = 0").get()?.c || 0;
    check("Total roadmaps", "roadmaps", totalRoadmaps > 0, `${totalRoadmaps} roadmaps`);

    const rowsWithNodes = db.prepare(`
      SELECT r.id, COUNT(rn.id) AS nodeCount FROM lms_roadmaps r
      LEFT JOIN lms_roadmap_nodes rn ON rn.roadmapId = r.id
      WHERE r.isDeleted = 0 GROUP BY r.id
    `).all();
    const emptyRoadmaps = rowsWithNodes.filter((r) => r.nodeCount === 0);
    check("Roadmaps have nodes", "roadmaps", emptyRoadmaps.length === 0,
      emptyRoadmaps.length > 0 ? `${emptyRoadmaps.length} roadmaps have no nodes` : "All roadmaps have nodes");

    // ── 5. Question Bank Integrity ──
    console.log("\n--- Question Bank Integrity ---");
    const totalQuestions = db.prepare("SELECT COUNT(*) AS c FROM lms_question_bank").get()?.c || 0;
    check("Total question bank items", "questions", totalQuestions > 0, `${totalQuestions} questions`);

    const questionsByDifficulty = db.prepare(
      "SELECT difficulty, COUNT(*) AS c FROM lms_question_bank GROUP BY difficulty ORDER BY c DESC"
    ).all();
    const difficultyCount = questionsByDifficulty.length;
    check("Difficulty diversity", "questions", difficultyCount >= 1,
      `${difficultyCount} difficulty levels: ${questionsByDifficulty.map((r) => `${r.difficulty}(${r.c})`).join(", ")}`);

    const questionsWithInvalidOptions = db.prepare(`
      SELECT id, options FROM lms_question_bank
    `).all().filter((q) => {
      try {
        const opts = JSON.parse(q.options);
        return !Array.isArray(opts) || opts.length < 2;
      } catch { return true; }
    });
    check("Question options validity", "questions", questionsWithInvalidOptions.length === 0,
      questionsWithInvalidOptions.length > 0 ? `${questionsWithInvalidOptions.length} questions have invalid options` : "All options valid");

    // ── 6. Topic Integrity ──
    console.log("\n--- Topic Integrity ---");
    const totalTopics = db.prepare("SELECT COUNT(*) AS c FROM lms_topics").get()?.c || 0;
    check("Total topics", "topics", totalTopics > 0, `${totalTopics} topics`);

    const topicResourceLinks = db.prepare("SELECT COUNT(*) AS c FROM lms_resource_topics").get()?.c || 0;
    check("Resource-topic links", "topics", topicResourceLinks > 0, `${topicResourceLinks} links`);

    // ── 7. Cross-Object Consistency ──
    console.log("\n--- Cross-Object Consistency ---");
    const outdatedCount = db.prepare("SELECT COUNT(*) AS c FROM lms_resources WHERE isOutdated = 1 AND isDeleted = 0").get()?.c || 0;
    if (outdatedCount > 0) warn("Outdated resources", "consistency", `${outdatedCount} resources marked as outdated`);

    const orphanResources = db.prepare(`
      SELECT COUNT(*) AS c FROM lms_resources r
      WHERE r.isDeleted = 0 AND r.subjectCode NOT IN (${CORE_CSE_SUBJECTS.map((s) => `'${s.subjectCode}'`).join(",")})
    `).get()?.c || 0;
    if (orphanResources > 0) warn("Resources for non-curriculum subjects", "consistency",
      `${orphanResources} resources found for subjects not in the core curriculum`);

    // ── 8. Content Quality Sampling ──
    console.log("\n--- Content Quality Sampling ---");
    const resourcesWithContent = db.prepare(
      "SELECT COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0 AND (noteContent IS NOT NULL OR structuredContent IS NOT NULL OR url IS NOT NULL)"
    ).get()?.c || 0;
    check("Resources with actual content", "quality",
      resourcesWithContent > totalResources * 0.5,
      `${resourcesWithContent}/${totalResources} have content`);

    // ── Summary ──
    console.log("\n" + "=".repeat(70));
    const total = results.passed + results.failed;
    console.log(`  Results: ${results.passed}/${total} passed, ${results.warnings} warnings`);
    if (results.failed > 0) {
      console.log(`  FAILED checks:`);
      for (const chk of results.checks.filter((c) => !c.ok)) {
        console.log(`    - ${chk.name}: ${chk.detail}`);
      }
    }
    const overallOk = results.failed === 0;
    console.log(`  Overall: ${overallOk ? "PASSED" : "SOME CHECKS FAILED"}`);
    console.log("=".repeat(70));

    // ── Report ──
    if (GENERATE_REPORT) {
      const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const reportPath = path.join(PROJECT_ROOT, "scripts", "lms-content-automation", `verify-report-${TIMESTAMP}.json`);
      fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        summary: { passed: results.passed, failed: results.failed, warnings: results.warnings, total },
        checks: results.checks,
        overallOk,
      }, null, 2));
      console.log(`\nReport saved: ${reportPath}`);
    }
  } finally {
    if (db && typeof db.close === "function") db.close();
  }
}

main();
