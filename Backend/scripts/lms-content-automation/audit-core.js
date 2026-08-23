/**
 * LMS Audit System — Database Schema & Core Module
 *
 * This module initializes the audit database tables, config, and provides
 * the core engine for running, storing, and retrieving audit results.
 *
 * Usage (as a subprocess invoked by workflow agents):
 *   node audit-core.js init                        # Create audit tables
 *   node audit-core.js inventory                   # Pull full resource inventory
 *   node audit-core.js run <check-name>            # Run a single check
 *   node audit-core.js report <run-id>             # Generate report for a run
 *
 * DB tables:
 *   audit_runs          — Each audit execution
 *   audit_checks        — Individual check definitions
 *   audit_findings      — All findings (anomalies)
 *   audit_remediation   — Remediation tracking
 *   audit_reports       — Generated report metadata
 *   audit_config        — Configuration and thresholds
 */

const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
process.chdir(PROJECT_ROOT);

const ARGS = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    const k = process.argv[i].slice(2);
    ARGS[k] = process.argv[i+1] && !process.argv[i+1].startsWith('--') ? process.argv[i+1] : true;
    if (ARGS[k] !== true) i++;
  }
}
const COMMAND = process.argv[2] || 'help';
const DB_PATH = ARGS['lms-db'] || path.join(PROJECT_ROOT, 'data', 'lms.sqlite');
const AUDIT_DB_PATH = ARGS['audit-db'] || path.join(PROJECT_ROOT, 'data', 'lms-audit.sqlite');

const { DatabaseSync } = require('node:sqlite');
const lmsDb = new DatabaseSync(DB_PATH);
lmsDb.exec('PRAGMA journal_mode=WAL');
lmsDb.exec('PRAGMA foreign_keys=ON');

const auditDb = new DatabaseSync(AUDIT_DB_PATH);
auditDb.exec('PRAGMA journal_mode=WAL');
auditDb.exec('PRAGMA foreign_keys=ON');

// ──────────────────────────────────────────────
// SCHEMA
// ──────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS audit_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_checks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK(severity IN ('critical','high','medium','low','info')),
  enabled INTEGER DEFAULT 1,
  schedule TEXT,
  config TEXT DEFAULT '{}',
  createdBy TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_runs (
  id TEXT PRIMARY KEY,
  status TEXT CHECK(status IN ('running','completed','failed','partial')),
  trigger TEXT CHECK(trigger IN ('scheduled','on-demand','manual')),
  startedAt TEXT,
  completedAt TEXT,
  totalResources INTEGER DEFAULT 0,
  resourcesScanned INTEGER DEFAULT 0,
  findingsCount INTEGER DEFAULT 0,
  criticalCount INTEGER DEFAULT 0,
  highCount INTEGER DEFAULT 0,
  mediumCount INTEGER DEFAULT 0,
  lowCount INTEGER DEFAULT 0,
  summary TEXT,
  triggeredBy TEXT
);

CREATE TABLE IF NOT EXISTS audit_findings (
  id TEXT PRIMARY KEY,
  runId TEXT NOT NULL,
  checkId TEXT NOT NULL,
  checkName TEXT NOT NULL,
  resourceId TEXT,
  resourceType TEXT,
  resourceTitle TEXT,
  subjectCode TEXT,
  category TEXT NOT NULL,
  severity TEXT CHECK(severity IN ('critical','high','medium','low','info')) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  detail TEXT,
  location TEXT,
  recommendation TEXT,
  status TEXT DEFAULT 'open' CHECK(status IN ('open','acknowledged','in-progress','resolved','dismissed')),
  assignedTo TEXT,
  tags TEXT DEFAULT '[]',
  score REAL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS audit_remediation (
  id TEXT PRIMARY KEY,
  findingId TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','in-progress','completed','failed')),
  notes TEXT,
  autoFixApplied INTEGER DEFAULT 0,
  autoFixResult TEXT,
  performedBy TEXT,
  createdAt TEXT NOT NULL,
  completedAt TEXT
);

CREATE TABLE IF NOT EXISTS audit_reports (
  id TEXT PRIMARY KEY,
  runId TEXT NOT NULL,
  type TEXT CHECK(type IN ('executive','detailed','compliance','trend','csv','json')),
  format TEXT CHECK(format IN ('pdf','csv','json','html','markdown')),
  title TEXT NOT NULL,
  summary TEXT,
  data TEXT,
  filePath TEXT,
  generatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_findings_run ON audit_findings(runId);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON audit_findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_status ON audit_findings(status);
CREATE INDEX IF NOT EXISTS idx_findings_resource ON audit_findings(resourceId);
CREATE INDEX IF NOT EXISTS idx_findings_category ON audit_findings(category);
CREATE INDEX IF NOT EXISTS idx_remediation_finding ON audit_remediation(findingId);
`;

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

let _seq = Date.now();
function uid(prefix) {
  _seq++;
  return prefix + '_' + _seq.toString(36) + Math.random().toString(36).slice(2, 8);
}
function now() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

// ──────────────────────────────────────────────
// COMMANDS
// ──────────────────────────────────────────────

function cmdInit() {
  auditDb.exec(SCHEMA);
  console.log('Audit schema initialized');

  // Seed default checks
  const checks = [
    ['cq-001', 'Content Readability Score', 'quality', 'Assess Flesch-Kincaid readability of all note-type resources', 'medium', 'weekly'],
    ['cq-002', 'Broken URL Detection', 'quality', 'Check all external/internal URLs for 4xx/5xx responses', 'high', 'daily'],
    ['cq-003', 'Multimedia File Integrity', 'quality', 'Verify uploaded files are not corrupted and have valid headers', 'high', 'weekly'],
    ['cq-004', 'Content Duplicate Detection', 'quality', 'Flag near-duplicate resources by title/content similarity', 'medium', 'weekly'],
    ['cm-001', 'Missing Unit Coverage', 'completeness', 'Detect units with zero resources across all subjects', 'critical', 'daily'],
    ['cm-002', 'Incomplete Module Detection', 'completeness', 'Flag units missing required resource types (note, quiz, pyq)', 'high', 'daily'],
    ['cm-003', 'Empty Discussion Boards', 'completeness', 'Identify resources with zero comments or annotations', 'low', 'weekly'],
    ['cm-004', 'Missing Assessment Materials', 'completeness', 'Flag subjects/units with no quiz or PYQ resources', 'high', 'weekly'],
    ['cc-001', 'Metadata Accuracy Check', 'compliance', 'Validate subjectCode, semester, unitNormalized consistency', 'medium', 'weekly'],
    ['cc-002', 'Accessibility Compliance', 'compliance', 'Check for missing descriptions, alt text, renderType', 'medium', 'weekly'],
    ['cc-003', 'Data Privacy Scan', 'compliance', 'Check noteContent for PII patterns (emails, phone numbers)', 'high', 'monthly'],
    ['cu-001', 'Resource Utilization Analysis', 'utilization', 'Identify resources with zero views/comments', 'low', 'weekly'],
    ['cu-002', 'Stale Resource Detection', 'utilization', 'Flag resources older than 6 months with no recent views', 'low', 'monthly'],
    ['cu-003', 'Storage Quota Monitoring', 'utilization', 'Check user storage usage vs limits', 'medium', 'weekly'],
  ];

  const stmt = auditDb.prepare(
    'INSERT OR IGNORE INTO audit_checks (id, name, category, description, severity, enabled, schedule, config, createdBy, createdAt) VALUES (?,?,?,?,?,1,?,\'{}\',\'system\',?)'
  );
  for (const [id, name, cat, desc, sev, sched] of checks) {
    stmt.run(id, name, cat, desc, sev, sched, now());
  }
  console.log('Seeded ' + checks.length + ' audit checks');
}

function cmdInventory() {
  const subjects = lmsDb.prepare('SELECT DISTINCT subjectCode, subjectName FROM lms_resources WHERE isDeleted=0 ORDER BY subjectCode').all();
  const total = lmsDb.prepare('SELECT COUNT(*) AS c FROM lms_resources WHERE isDeleted=0').get().c;
  const byType = lmsDb.prepare('SELECT type, COUNT(*) AS c FROM lms_resources WHERE isDeleted=0 GROUP BY type').all();
  const bySubject = lmsDb.prepare('SELECT subjectCode, COUNT(*) AS c, COUNT(DISTINCT type) AS types FROM lms_resources WHERE isDeleted=0 GROUP BY subjectCode ORDER BY c DESC').all();
  const units = lmsDb.prepare('SELECT DISTINCT subjectCode, unitNormalized FROM lms_resources WHERE isDeleted=0 ORDER BY subjectCode').all();
  const users = lmsDb.prepare('SELECT DISTINCT uploadedBy FROM lms_resources WHERE isDeleted=0 ORDER BY uploadedBy').all();
  const dateRange = lmsDb.prepare('SELECT MIN(uploadedAt) AS first, MAX(uploadedAt) AS last FROM lms_resources WHERE isDeleted=0').get();
  const guides = lmsDb.prepare('SELECT COUNT(*) AS c FROM lms_guides WHERE isDeleted=0').get().c;
  const roadmaps = lmsDb.prepare('SELECT COUNT(*) AS c FROM lms_roadmaps WHERE isDeleted=0').get().c;
  const questions = lmsDb.prepare('SELECT COUNT(*) AS c FROM lms_question_bank').get().c;

  const result = {
    timestamp: now(),
    totalResources: total,
    totalGuides: guides,
    totalRoadmaps: roadmaps,
    totalQuestions: questions,
    subjects: subjects.length,
    users: users.length,
    units: units.length,
    byType,
    bySubject,
    dateRange,
  };

  console.log(JSON.stringify(result, null, 2));
}

function cmdRunCheck() {
  const checkName = ARGS.check || process.argv[3];
  if (!checkName) { console.error('Specify --check <name>'); process.exit(1); }
  console.log('Running check: ' + checkName);

  // Create a run
  const runId = uid('run');
  auditDb.prepare("INSERT INTO audit_runs (id, status, trigger, startedAt, resourcesScanned, findingsCount, triggeredBy) VALUES (?,'running','on-demand',?,0,0,?)")
    .run(runId, now(), 'audit-cli');

  // Dispatch to the right check logic
  const checks = {
    'Content Readability Score': runReadabilityCheck,
    'Broken URL Detection': runBrokenUrlCheck,
    'Content Duplicate Detection': runDuplicateCheck,
    'Missing Unit Coverage': runMissingUnitCheck,
    'Incomplete Module Detection': runIncompleteModuleCheck,
    'Metadata Accuracy Check': runMetadataCheck,
    'Accessibility Compliance': runAccessibilityCheck,
    'Resource Utilization Analysis': runUtilizationCheck,
    'Stale Resource Detection': runStaleResourceCheck,
    'Missing Assessment Materials': runMissingAssessmentCheck,
  };

  const handler = checks[checkName];
  if (!handler) { console.error('Unknown check: ' + checkName); process.exit(1); }

  const findings = handler(lmsDb, auditDb, runId);

  // Update run
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) { if (counts[f.severity] !== undefined) counts[f.severity]++; }

  auditDb.prepare(
    "UPDATE audit_runs SET status='completed', completedAt=?, totalResources=(SELECT COUNT(*) FROM lms_resources WHERE isDeleted=0), findingsCount=?, criticalCount=?, highCount=?, mediumCount=?, lowCount=? WHERE id=?"
  ).run(now(), findings.length, counts.critical, counts.high, counts.medium, counts.low, runId);

  console.log('Run ' + runId + ': ' + findings.length + ' findings (' +
    counts.critical + ' critical, ' + counts.high + ' high, ' + counts.medium + ' medium, ' + counts.low + ' low)');

  if (ARGS.verbose) {
    for (const f of findings) {
      console.log('  [' + f.severity.toUpperCase() + '] ' + f.title + (f.resourceTitle ? ' — ' + f.resourceTitle : ''));
    }
  }

  return { runId, findings };
}

function runReadabilityCheck(db, auditDb, runId) {
  const notes = db.prepare("SELECT id, title, subjectCode, noteContent FROM lms_resources WHERE type='note' AND isDeleted=0 AND noteContent IS NOT NULL").all();
  const findings = [];
  for (const n of notes) {
    const text = n.noteContent || '';
    const words = text.split(/\s+/).filter(Boolean).length;
    const sentences = text.split(/[.!?]+/).filter(Boolean).length || 1;
    const syllables = countSyllables(text);
    const avgWordsPerSentence = words / sentences;
    const avgSyllablesPerWord = syllables / (words || 1);

    // Flesch-Kincaid Grade Level
    const fkGrade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
    // Flesch Reading Ease
    const fre = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

    if (fkGrade > 18 || fre < 10) {
      findings.push(makeFinding(runId, 'cq-001', 'Content Readability Score', n.id, 'note', n.title, n.subjectCode,
        'quality', 'medium', 'Very low readability score', 'Grade level ' + fkGrade.toFixed(1) + ', FRE ' + fre.toFixed(1),
        'Consider simplifying language, adding examples, breaking into smaller sections',
        { fkGrade: fkGrade.toFixed(1), fre: fre.toFixed(1), words, sentences }));
    }
    if (words < 50 && text.length > 0) {
      findings.push(makeFinding(runId, 'cq-001', 'Content Readability Score', n.id, 'note', n.title, n.subjectCode,
        'quality', 'low', 'Extremely short note', 'Only ' + words + ' words — may lack substance',
        'Expand with definitions, examples, and practice problems'));
    }
  }
  return persistFindings(auditDb, runId, findings);
}

function runBrokenUrlCheck(db, auditDb, runId) {
  // Check URL-type resources and embedded URLs in noteContent
  const findings = [];
  const links = db.prepare("SELECT id, title, subjectCode, url FROM lms_resources WHERE type='link' AND isDeleted=0 AND url IS NOT NULL").all();
  for (const l of links) {
    if (!l.url || l.url.startsWith('http://example.com')) {
      findings.push(makeFinding(runId, 'cq-002', 'Broken URL Detection', l.id, 'link', l.title, l.subjectCode,
        'quality', 'high', 'Placeholder URL detected', 'URL: ' + (l.url || 'none'),
        'Replace example.com URLs with real resource links'));
    }
  }
  // Check noteContent for embedded URLs
  const notes = db.prepare("SELECT id, title, subjectCode, noteContent FROM lms_resources WHERE type='note' AND isDeleted=0 AND noteContent IS NOT NULL").all();
  for (const n of notes) {
    const urls = n.noteContent.match(/https?:\/\/[^\s)]+/g) || [];
    for (const url of urls) {
      if (url.includes('example.com') || url.includes('placeholder')) {
        findings.push(makeFinding(runId, 'cq-002', 'Broken URL Detection', n.id, 'note', n.title, n.subjectCode,
          'quality', 'medium', 'Placeholder URL in note content', 'URL: ' + url.slice(0, 80),
          'Replace with real reference URL or remove'));
      }
    }
  }
  return persistFindings(auditDb, runId, findings);
}

function runDuplicateCheck(db, auditDb, runId) {
  const resources = db.prepare("SELECT id, title, subjectCode, type, unit FROM lms_resources WHERE isDeleted=0 ORDER BY title").all();
  const findings = [];
  const seen = {};
  for (const r of resources) {
    const key = (r.title || '').toLowerCase().trim();
    if (seen[key] && seen[key].subjectCode === r.subjectCode) {
      findings.push(makeFinding(runId, 'cq-004', 'Content Duplicate Detection', r.id, r.type, r.title, r.subjectCode,
        'quality', 'medium', 'Duplicate resource detected', 'Matches existing resource: ' + seen[key].id,
        'Merge or remove duplicate'));
    }
    seen[key] = r;
  }
  return persistFindings(auditDb, runId, findings);
}

function runMissingUnitCheck(db, auditDb, runId) {
  const subjects = db.prepare("SELECT DISTINCT subjectCode FROM lms_resources WHERE isDeleted=0").all();
  const findings = [];
  const expectedUnits = ['unit-1', 'unit-2', 'unit-3', 'unit-4', 'unit-5'];
  for (const s of subjects) {
    const actualUnits = db.prepare("SELECT DISTINCT unitNormalized FROM lms_resources WHERE subjectCode=? AND isDeleted=0").all(s.subjectCode).map(r => r.unitNormalized);
    for (const eu of expectedUnits) {
      if (!actualUnits.includes(eu)) {
        findings.push(makeFinding(runId, 'cm-001', 'Missing Unit Coverage', null, 'subject', s.subjectCode, s.subjectCode,
          'completeness', 'critical', 'Unit with zero resources', s.subjectCode + ': ' + eu + ' has no resources at all',
          'Generate content for the missing unit'));
      }
    }
  }
  return persistFindings(auditDb, runId, findings);
}

function runIncompleteModuleCheck(db, auditDb, runId) {
  const subjects = db.prepare("SELECT DISTINCT subjectCode FROM lms_resources WHERE isDeleted=0").all();
  const findings = [];
  for (const s of subjects) {
    const unitData = db.prepare("SELECT unitNormalized, COUNT(DISTINCT type) AS typeCount FROM lms_resources WHERE subjectCode=? AND isDeleted=0 GROUP BY unitNormalized").all(s.subjectCode);
    for (const u of unitData) {
      if (u.typeCount < 3) {
        findings.push(makeFinding(runId, 'cm-002', 'Incomplete Module Detection', null, 'unit', s.subjectCode + ' ' + u.unitNormalized, s.subjectCode,
          'completeness', 'high', 'Unit has insufficient resource types', s.subjectCode + ' ' + u.unitNormalized + ' only ' + u.typeCount + '/5 types',
          'Add missing resource types (note, quiz, flashcard, pyq, link)'));
      }
    }
  }
  return persistFindings(auditDb, runId, findings);
}

function runMissingAssessmentCheck(db, auditDb, runId) {
  const subjects = db.prepare("SELECT DISTINCT subjectCode FROM lms_resources WHERE isDeleted=0").all();
  const findings = [];
  for (const s of subjects) {
    const hasQuiz = db.prepare("SELECT COUNT(*) AS c FROM lms_resources WHERE subjectCode=? AND type='quiz' AND isDeleted=0").get(s.subjectCode).c > 0;
    const hasPyq = db.prepare("SELECT COUNT(*) AS c FROM lms_resources WHERE subjectCode=? AND type='pyq' AND isDeleted=0").get(s.subjectCode).c > 0;
    if (!hasQuiz) {
      findings.push(makeFinding(runId, 'cm-004', 'Missing Assessment Materials', null, 'subject', s.subjectCode, s.subjectCode,
        'completeness', 'high', 'No quiz resources for subject', s.subjectCode + ' has zero quiz resources',
        'Add quiz resources for self-assessment'));
    }
    if (!hasPyq) {
      findings.push(makeFinding(runId, 'cm-004', 'Missing Assessment Materials', null, 'subject', s.subjectCode, s.subjectCode,
        'completeness', 'high', 'No PYQ resources for subject', s.subjectCode + ' has zero past year question resources',
        'Add PYQ resources for exam preparation'));
    }
  }
  return persistFindings(auditDb, runId, findings);
}

function runMetadataCheck(db, auditDb, runId) {
  const findings = [];
  const resources = db.prepare("SELECT id, title, type, subjectCode, semester, unit, tags FROM lms_resources WHERE isDeleted=0 LIMIT 500").all();
  for (const r of resources) {
    if (!r.semester) {
      findings.push(makeFinding(runId, 'cc-001', 'Metadata Accuracy Check', r.id, r.type, r.title, r.subjectCode,
        'compliance', 'medium', 'Missing semester metadata', 'Resource has no semester assigned',
        'Set semester to appropriate value (e.g., VI)'));
    }
    if (!r.tags || r.tags === '[]' || r.tags === '""') {
      findings.push(makeFinding(runId, 'cc-001', 'Metadata Accuracy Check', r.id, r.type, r.title, r.subjectCode,
        'compliance', 'low', 'Missing tags', 'Resource has no tags',
        'Add relevant topic tags for discoverability'));
    }
  }
  return persistFindings(auditDb, runId, findings);
}

function runAccessibilityCheck(db, auditDb, runId) {
  const findings = [];
  const resources = db.prepare("SELECT id, title, type, subjectCode, description FROM lms_resources WHERE isDeleted=0 LIMIT 500").all();
  for (const r of resources) {
    if (!r.description || r.description.trim() === '') {
      findings.push(makeFinding(runId, 'cc-002', 'Accessibility Compliance', r.id, r.type, r.title, r.subjectCode,
        'compliance', 'medium', 'Missing resource description', 'Screen readers depend on descriptions',
        'Add a concise description (2-3 sentences) for accessibility'));
    }
  }
  return persistFindings(auditDb, runId, findings);
}

function runUtilizationCheck(db, auditDb, runId) {
  const findings = [];
  const resources = db.prepare("SELECT id, title, type, subjectCode, viewCount, upvotes, commentCount FROM lms_resources WHERE isDeleted=0 LIMIT 500").all();
  for (const r of resources) {
    if (r.viewCount === 0 && r.type !== 'link') {
      findings.push(makeFinding(runId, 'cu-001', 'Resource Utilization Analysis', r.id, r.type, r.title, r.subjectCode,
        'utilization', 'low', 'Resource has never been viewed', 'Zero views since upload',
        'Consider promoting content or checking if it is discoverable'));
    }
  }
  return persistFindings(auditDb, runId, findings);
}

function runStaleResourceCheck(db, auditDb, runId) {
  const findings = [];
  const stale = db.prepare(
    "SELECT id, title, type, subjectCode, uploadedAt FROM lms_resources WHERE isDeleted=0 AND uploadedAt < datetime('now', '-6 months') AND viewCount = 0"
  ).all();
  for (const r of stale) {
    findings.push(makeFinding(runId, 'cu-002', 'Stale Resource Detection', r.id, r.type, r.title, r.subjectCode,
      'utilization', 'low', 'Resource stale and unused', 'Uploaded ' + (r.uploadedAt || 'unknown') + ' with zero views',
      'Review and update or archive'));
  }
  return persistFindings(auditDb, runId, findings);
}

// ──────────────────────────────────────────────
// SHARED HELPERS
// ──────────────────────────────────────────────

function countSyllables(text) {
  let count = 0;
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  for (const word of words) {
    let syl = 0;
    let prevVowel = false;
    for (const ch of word) {
      if ('aeiou'.includes(ch)) {
        if (!prevVowel) syl++;
        prevVowel = true;
      } else prevVowel = false;
    }
    if (word.endsWith('e')) syl--;
    if (word.endsWith('le') && word.length > 2) syl++;
    if (syl < 1) syl = 1;
    count += syl;
  }
  return count || 1;
}

function makeFinding(runId, checkId, checkName, resourceId, resourceType, resourceTitle, subjectCode,
  category, severity, title, description, recommendation, extra) {
  return {
    id: uid('find'),
    runId, checkId, checkName, resourceId: resourceId || null,
    resourceType: resourceType || null,
    resourceTitle: resourceTitle || null,
    subjectCode: subjectCode || null,
    category, severity, title,
    description: description || '',
    detail: JSON.stringify(extra || {}),
    recommendation: recommendation || '',
    status: 'open',
    tags: '["' + category + '","' + severity + '"]',
    score: severity === 'critical' ? 5 : severity === 'high' ? 4 : severity === 'medium' ? 3 : severity === 'low' ? 2 : 1,
    createdAt: now(),
    updatedAt: now(),
  };
}

function persistFindings(auditDb, runId, findings) {
  if (findings.length === 0) return findings;
  const stmt = auditDb.prepare(`
    INSERT OR IGNORE INTO audit_findings
    (id, runId, checkId, checkName, resourceId, resourceType, resourceTitle, subjectCode,
     category, severity, title, description, detail, recommendation, status, tags, score, createdAt, updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'open',?,?,?,?)
  `);
  for (const f of findings) {
    stmt.run(f.id, f.runId, f.checkId, f.checkName, f.resourceId, f.resourceType, f.resourceTitle, f.subjectCode,
      f.category, f.severity, f.title, f.description, f.detail, f.recommendation, f.tags, f.score || 1, f.createdAt, f.updatedAt);
  }
  return findings;
}

// ──────────────────────────────────────────────
// REPORTING
// ──────────────────────────────────────────────

function cmdReport() {
  const runId = ARGS.run || process.argv[3];
  if (!runId) {
    // Latest run
    const latest = auditDb.prepare("SELECT id FROM audit_runs ORDER BY startedAt DESC LIMIT 1").get();
    if (!latest) { console.log('No audit runs found'); return; }
    return cmdReportForRun(latest.id);
  }
  return cmdReportForRun(runId);
}

function cmdReportForRun(runId) {
  const run = auditDb.prepare("SELECT * FROM audit_runs WHERE id=?").get(runId);
  if (!run) { console.log('Run not found: ' + runId); return; }

  const findings = auditDb.prepare("SELECT * FROM audit_findings WHERE runId=? ORDER BY score DESC, severity ASC").all(runId);
  const bySeverity = {};
  const byCategory = {};
  const bySubject = {};
  const byStatus = {};

  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    byStatus[f.status] = (byStatus[f.status] || 0) + 1;
    if (f.subjectCode) bySubject[f.subjectCode] = (bySubject[f.subjectCode] || 0) + 1;
  }

  const report = {
    run: {
      id: run.id,
      status: run.status,
      trigger: run.trigger,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      totalResources: run.totalResources,
      findingsCount: run.findingsCount,
      scanTime: run.completedAt && run.startedAt
        ? Math.round((new Date(run.completedAt) - new Date(run.startedAt)) / 1000) + 's'
        : 'N/A',
    },
    summary: {
      totalFindings: findings.length,
      bySeverity,
      byCategory,
      bySubject,
      byStatus,
      openCount: (byStatus['open'] || 0) + (byStatus['acknowledged'] || 0),
      resolvedCount: (byStatus['resolved'] || 0) + (byStatus['dismissed'] || 0),
    },
    criticalFindings: findings.filter(f => f.severity === 'critical').map(f => ({
      id: f.id, title: f.title, resource: f.resourceTitle, subject: f.subjectCode, recommendation: f.recommendation
    })),
    highFindings: findings.filter(f => f.severity === 'high').map(f => ({
      id: f.id, title: f.title, resource: f.resourceTitle, subject: f.subjectCode
    })),
    topRecommendations: [...new Set(findings.filter(f => f.recommendation).map(f => f.recommendation))].slice(0, 10),
  };

  if (ARGS.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('  AUDIT REPORT: ' + run.id);
    console.log('  Status: ' + run.status + ' | Trigger: ' + run.trigger);
    console.log('  Resources: ' + run.totalResources + ' | Scanned: ' + run.resourcesScanned);
    console.log('  Findings: ' + report.summary.totalFindings);
    console.log('═══════════════════════════════════════════════════\n');
    console.log('  Severity breakdown:');
    for (const [sev, count] of Object.entries(report.summary.bySeverity)) {
      console.log('    ' + sev.toUpperCase() + ': ' + count);
    }
    console.log('  Category breakdown:');
    for (const [cat, count] of Object.entries(report.summary.byCategory)) {
      console.log('    ' + cat + ': ' + count);
    }
    console.log('  Open findings: ' + report.summary.openCount);
    console.log('  Resolved: ' + report.summary.resolvedCount);

    if (report.criticalFindings.length > 0) {
      console.log('\n  CRITICAL FINDINGS:');
      for (const f of report.criticalFindings) {
        console.log('    ! ' + f.title + (f.resource ? ' — ' + f.resource : ''));
        console.log('      Fix: ' + f.recommendation);
      }
    }

    if (report.highFindings.length > 0) {
      console.log('\n  HIGH FINDINGS:');
      for (const f of report.highFindings.slice(0, 10)) {
        console.log('    ! ' + f.title + (f.resource ? ' — ' + f.resource : ''));
      }
    }

    console.log('\n  Top Recommendations:');
    for (const r of report.topRecommendations.slice(0, 5)) {
      console.log('    → ' + r);
    }
  }

  // Save report
  const reportId = uid('rpt');
  auditDb.prepare(
    "INSERT INTO audit_reports (id, runId, type, format, title, summary, data, generatedAt) VALUES (?,?,'detailed','json',?,?,?,?)"
  ).run(reportId, runId, 'Audit Report: ' + run.id, JSON.stringify(report.summary), JSON.stringify(report), now());

  const filePath = path.join(PROJECT_ROOT, 'scripts', 'lms-content-automation', 'audit-report-' + run.id + '.json');
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
  console.log('\nReport saved: ' + filePath);

  return report;
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────

switch (COMMAND) {
  case 'init': cmdInit(); break;
  case 'inventory': cmdInventory(); break;
  case 'run': cmdRunCheck(); break;
  case 'report': cmdReport(); break;
  case 'help':
  default:
    console.log('Usage: node audit-core.js <command> [options]');
    console.log('Commands:');
    console.log('  init                  Initialize audit database schema');
    console.log('  inventory             Pull full resource inventory');
    console.log('  run --check <name>    Run a specific audit check');
    console.log('  report [run-id]       Generate report for a run (default: latest)');
    console.log('');
    console.log('Options:');
    console.log('  --lms-db <path>       Path to LMS database (default: data/lms.sqlite)');
    console.log('  --audit-db <path>     Path to audit database (default: data/lms-audit.sqlite)');
    console.log('  --verbose             Show finding details');
    console.log('  --format json         Output in JSON');
    break;
}
