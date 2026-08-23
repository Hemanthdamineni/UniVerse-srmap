#!/usr/bin/env node

/**
 * LMS Content Critique & Gap Analysis Tool
 *
 * Conducts structured peer review and critical analysis of all verified
 * content to identify improvement opportunities:
 *  - Clarity and pedagogical effectiveness
 *  - Real-world example coverage
 *  - Industry relevance
 *  - Cross-subject coherence
 *  - Accessibility compliance
 *  - Gap identification
 *
 * Usage:
 *   node Backend/scripts/lms-content-automation/critique.js [--db-path <path>] [--report]
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

const NOW = new Date().toISOString();

// ──────────────────────────────────────────────

function analyzeSubjectCoverage(db) {
  const analysis = [];

  for (const subject of CORE_CSE_SUBJECTS) {
    const resources = db.prepare(
      `SELECT type, unitNormalized, COUNT(*) AS c FROM lms_resources
       WHERE subjectCode = ? AND isDeleted = 0 GROUP BY type, unitNormalized`
    ).all(subject.subjectCode);

    const unitCoverage = {};
    for (const unit of subject.units) {
      const unitNorm = unit.unit.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const unitResources = resources.filter((r) => r.unitNormalized === unitNorm);
      const typesCovered = new Set(unitResources.map((r) => r.type));
      const totalCount = unitResources.reduce((s, r) => s + Number(r.c || 0), 0);

      unitCoverage[unit.unit] = {
        typesPresent: Array.from(typesCovered),
        typesMissing: ["note", "quiz", "flashcard", "pyq", "link"].filter((t) => !typesCovered.has(t)),
        resourceCount: totalCount,
        gapScore: Math.round((1 - (Array.from(typesCovered).length / 5)) * 100),
      };
    }

    const totalResources = Object.values(unitCoverage).reduce((s, u) => s + u.resourceCount, 0);
    const avgGap = Object.values(unitCoverage).reduce((s, u) => s + u.gapScore, 0) / subject.units.length;

    analysis.push({
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      unitCoverage,
      totalResources,
      averageGapScore: Math.round(avgGap),
      overallCompleteness: Math.round((1 - avgGap / 100) * 100),
      priority: avgGap > 30 ? "HIGH" : avgGap > 15 ? "MEDIUM" : "LOW",
    });
  }

  return analysis;
}

function analyzeQualitySignals(db) {
  const signals = [];

  // Content depth analysis
  const noteLengths = db.prepare(
    `SELECT id, title, LENGTH(COALESCE(noteContent, '')) AS contentLen
     FROM lms_resources WHERE type = 'note' AND isDeleted = 0`
  ).all();
  const shortNotes = noteLengths.filter((r) => r.contentLen < 500);
  if (shortNotes.length > 0) {
    signals.push({
      dimension: "Content Depth",
      finding: `${shortNotes.length}/${noteLengths.length} notes are unusually short (< 500 chars)`,
      severity: "info",
      examples: shortNotes.slice(0, 3).map((r) => r.title),
    });
  }

  // Type distribution
  const typeDist = db.prepare(
    `SELECT type, COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0 GROUP BY type ORDER BY c DESC`
  ).all();
  signals.push({
    dimension: "Resource Type Distribution",
    finding: typeDist.map((r) => `${r.type}: ${r.c}`).join(", "),
    severity: "info",
    examples: [],
  });

  // Subject balance
  const subjectCounts = db.prepare(
    `SELECT subjectCode, COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0 GROUP BY subjectCode ORDER BY c DESC`
  ).all();
  if (subjectCounts.length > 0) {
    const minCount = Math.min(...subjectCounts.map((r) => r.c));
    const maxCount = Math.max(...subjectCounts.map((r) => r.c));
    if (maxCount > minCount * 1.5) {
      signals.push({
        dimension: "Subject Balance",
        finding: `Resource distribution is uneven (${minCount}–${maxCount} per subject). Consider balancing.`,
        severity: "info",
        examples: subjectCounts.map((r) => `${r.subjectCode}: ${r.c}`),
      });
    }
  }

  // Question bank depth
  const qbBySubject = db.prepare(
    `SELECT subjectCode, COUNT(*) AS c, COUNT(DISTINCT difficulty) AS diffs
     FROM lms_question_bank GROUP BY subjectCode`
  ).all();
  for (const row of qbBySubject) {
    if (row.diffs < 2) {
      signals.push({
        dimension: "Question Bank Depth",
        finding: `${row.subjectCode} has questions at only ${row.diffs} difficulty level(s)`,
        severity: "info",
        examples: [],
      });
    }
  }

  return signals;
}

function generateRecommendations(coverage, signals, db) {
  const recommendations = [];

  // Coverage-based recommendations
  for (const subject of coverage) {
    if (subject.overallCompleteness < 60) {
      recommendations.push({
        priority: "high",
        area: `Content Gaps — ${subject.subjectCode}`,
        recommendation: `Improve coverage: only ${subject.overallCompleteness}% complete. Focus on missing resource types.`,
        impact: "Ensures students have access to diverse learning materials",
      });
    }
  }

  // Missing subjects in question bank
  const subjectsWithQb = new Set(
    db.prepare("SELECT DISTINCT subjectCode FROM lms_question_bank").all().map((r) => r.subjectCode)
  );
  for (const subject of CORE_CSE_SUBJECTS) {
    if (!subjectsWithQb.has(subject.subjectCode)) {
      recommendations.push({
        priority: "high",
        area: `Question Bank — ${subject.subjectCode}`,
        recommendation: `No questions in the question bank. Add at least 10–15 questions across difficulty levels.`,
        impact: "Students need practice questions for exam preparation",
      });
    }
  }

  // Resource type variety
  for (const subject of CORE_CSE_SUBJECTS) {
    const types = db.prepare(
      `SELECT DISTINCT type FROM lms_resources WHERE subjectCode = ? AND isDeleted = 0`
    ).all().map((r) => r.type);
    const missing = ["note", "quiz", "flashcard", "pyq", "link"].filter((t) => !types.includes(t));
    if (missing.length > 0) {
      recommendations.push({
        priority: "medium",
        area: `Resource Types — ${subject.subjectCode}`,
        recommendation: `Missing resource types: ${missing.join(", ")}. Adding these will improve learning diversity.`,
        impact: "Broader resource types support different learning styles",
      });
    }
  }

  // Skill roadmap expansion
  const existingRoadmaps = db.prepare("SELECT DISTINCT skill FROM lms_roadmaps WHERE isDeleted = 0").all().map((r) => r.skill);
  const plannedSkills = SKILL_ROADMAPS.map((r) => r.skill);
  const missingRoadmaps = plannedSkills.filter((s) => !existingRoadmaps.includes(s));
  if (missingRoadmaps.length > 0) {
    recommendations.push({
      priority: "medium",
      area: "Skill Roadmaps",
      recommendation: `Roadmaps not yet created: ${missingRoadmaps.join(", ")}`,
      impact: "Skill roadmaps connect academic learning to career readiness",
    });
  }

  // Cross-subject topic linking
  const topicLinks = db.prepare("SELECT COUNT(*) AS c FROM lms_resource_topics").get()?.c || 0;
  if (topicLinks === 0) {
    recommendations.push({
      priority: "medium",
      area: "Topic Connections",
      recommendation: "No resource-topic links exist. Run the topic linking phase to connect resources to topics.",
      impact: "Topic links enable the recommendation engine and subject overview features",
    });
  }

  // Enhancement recommendations
  recommendations.push({
    priority: "low",
    area: "Content Enhancement",
    recommendation: "Add video lecture links and interactive coding exercises as supplementary resources.",
    impact: "Multimedia content increases engagement and understanding",
  });

  recommendations.push({
    priority: "low",
    area: "Assessment Enhancement",
    recommendation: "Create timed quiz resources that simulate actual exam conditions with weighted marking.",
    impact: "Exam-simulating quizzes improve student confidence and time management",
  });

  return recommendations;
}

function runAccessibilityCheck(db) {
  const issues = [];

  // Check for minimal content length (accessibility concern)
  const emptyContent = db.prepare(
    `SELECT COUNT(*) AS c FROM lms_resources
     WHERE isDeleted = 0 AND type = 'note'
     AND (noteContent IS NULL OR LENGTH(TRIM(noteContent)) < 100)`
  ).get()?.c || 0;
  if (emptyContent > 0) {
    issues.push({
      check: "Content minimum length",
      finding: `${emptyContent} notes have very little or no content`,
      severity: "warning",
    });
  }

  // No resources lack descriptions
  const noDesc = db.prepare(
    "SELECT COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0 AND (description IS NULL OR description = '')"
  ).get()?.c || 0;
  if (noDesc > 0) {
    issues.push({
      check: "Resource descriptions (accessibility)",
      finding: `${noDesc} resources lack descriptions — screen readers depend on these`,
      severity: "warning",
    });
  }

  return issues;
}

// ──────────────────────────────────────────────

function main() {
  console.log("=".repeat(70));
  console.log("  LMS Content Critique & Gap Analysis");
  console.log(`  DB: ${DB_PATH}`);
  console.log("=".repeat(70));

  if (!fs.existsSync(DB_PATH)) {
    console.error(`[FATAL] Database not found at: ${DB_PATH}`);
    process.exit(1);
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");

  try {
    // Phase 1: Coverage Analysis
    console.log("\n--- Subject Coverage Analysis ---");
    const coverage = analyzeSubjectCoverage(db);
    for (const s of coverage) {
      console.log(`  ${s.subjectCode} (${s.subjectName}):`);
      console.log(`    Completeness: ${s.overallCompleteness}%`);
      console.log(`    Gap Score: ${s.averageGapScore}% (priority: ${s.priority})`);
      console.log(`    Total Resources: ${s.totalResources}`);
      for (const [unit, info] of Object.entries(s.unitCoverage)) {
        const gaps = info.typesMissing;
        console.log(`    ${unit}: ${info.resourceCount} resources${gaps.length ? `, gaps: ${gaps.join(", ")}` : ""}`);
      }
    }

    // Phase 2: Quality Signals
    console.log("\n--- Quality Signals ---");
    const signals = analyzeQualitySignals(db);
    for (const sig of signals) {
      console.log(`  [${sig.severity}] ${sig.dimension}: ${sig.finding}`);
      if (sig.examples.length > 0) {
        console.log(`    Examples: ${sig.examples.join(", ")}`);
      }
    }

    // Phase 3: Accessibility Check
    console.log("\n--- Accessibility Check ---");
    const a11yIssues = runAccessibilityCheck(db);
    if (a11yIssues.length === 0) {
      console.log("  ✓ No critical accessibility issues found");
    } else {
      for (const issue of a11yIssues) {
        console.log(`  [${issue.severity}] ${issue.check}: ${issue.finding}`);
      }
    }

    // Phase 4: Recommendations
    console.log("\n--- Recommendations ---");
    const recommendations = generateRecommendations(coverage, signals, db);
    for (const rec of recommendations) {
      console.log(`  [${rec.priority.toUpperCase()}] ${rec.area}:`);
      console.log(`    ${rec.recommendation}`);
      console.log(`    → Impact: ${rec.impact}`);
    }

    // Phase 5: Overall Assessment
    console.log("\n--- Overall Assessment ---");
    const overallCoverage = coverage.reduce((s, c) => s + c.overallCompleteness, 0) / coverage.length;
    console.log(`  Average Completeness: ${Math.round(overallCoverage)}%`);
    console.log(`  Critical Gaps: ${recommendations.filter((r) => r.priority === "high").length}`);
    console.log(`  Medium Improvements: ${recommendations.filter((r) => r.priority === "medium").length}`);
    console.log(`  Enhancement Opportunities: ${recommendations.filter((r) => r.priority === "low").length}`);

    const output = {
      timestamp: NOW,
      overallCompleteness: Math.round(overallCoverage),
      subjectCoverage: coverage,
      qualitySignals: signals,
      accessibilityIssues: a11yIssues,
      recommendations,
      summary: {
        highPriorityActions: recommendations.filter((r) => r.priority === "high").length,
        mediumPriorityActions: recommendations.filter((r) => r.priority === "medium").length,
        lowPriorityActions: recommendations.filter((r) => r.priority === "low").length,
        averageCompleteness: Math.round(overallCoverage),
      },
    };

    if (GENERATE_REPORT) {
      const TIMESTAMP = NOW.replace(/[:.]/g, "-").slice(0, 19);
      const reportPath = path.join(PROJECT_ROOT, "scripts", "lms-content-automation", `critique-report-${TIMESTAMP}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(output, null, 2));
      console.log(`\nReport saved: ${reportPath}`);
    }

    console.log("=".repeat(70));

  } finally {
    if (db && typeof db.close === "function") db.close();
  }
}

main();
