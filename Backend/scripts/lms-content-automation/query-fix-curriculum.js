#!/usr/bin/env node
/**
 * query-fix-curriculum.js — Purges wrong subject codes, remaps correct ones.
 * Run once after curriculum update to clean up data with fake subject codes.
 * Usage: node query-fix-curriculum.js [db-path]
 */
process.removeAllListeners('warning');
process.env.NODE_NO_WARNINGS = '1';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const dbPath = process.argv[2] || path.resolve(__dirname, '../../data/lms.sqlite');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode=WAL');

var result = { purgedResources: 0, purgedGuides: 0, purgedQB: 0, purgedCheatsheets: 0, remapped: { notes: 0, cheats: 0 } };

// 1. Fake subject codes that never existed
var FAKE_CODES = ['CSE308','CSE310','CSE312','CSE314','CSE316'];
FAKE_CODES.forEach(function(code) {
  var r = db.prepare("SELECT COUNT(*)as c FROM lms_resources WHERE subjectCode=? AND isDeleted=0").get(code);
  if (r && r.c > 0) {
    db.prepare("UPDATE lms_resources SET isDeleted=1,deletedAt=datetime('now'),deletedBy='curriculum-fix' WHERE subjectCode=? AND isDeleted=0").run(code);
    result.purgedResources += r.c;
  }
  var g = db.prepare("SELECT COUNT(*)as c FROM lms_guides WHERE subjectCode=? AND isDeleted=0").get(code);
  if (g && g.c > 0) {
    db.prepare("UPDATE lms_guides SET isDeleted=1,deletedAt=datetime('now') WHERE subjectCode=? AND isDeleted=0").run(code);
    result.purgedGuides += g.c;
  }
  var q = db.prepare("SELECT COUNT(*)as c FROM lms_question_bank WHERE subjectCode=?").get(code);
  if (q && q.c > 0) {
    db.prepare("DELETE FROM lms_question_bank WHERE subjectCode=?").run(code);
    result.purgedQB += q.c;
  }
});

// 2. Remap DSA-ingested notes: CSE302 -> CSE204 (real Algorithms code)
var r1 = db.prepare("UPDATE lms_resources SET subjectCode='CSE204',subjectName='Design and Analysis of Algorithms',updatedAt=datetime('now') WHERE uploadedBy='ingestion-system' AND isDeleted=0").run();
result.remapped.notes = r1.changes;

// 3. Remap quality-pipeline enriched notes
db.prepare("UPDATE lms_resources SET subjectCode='CSE204',subjectName='Design and Analysis of Algorithms',updatedAt=datetime('now') WHERE uploadedBy='quality-pipeline' AND subjectCode='CSE302' AND isDeleted=0").run();
db.prepare("UPDATE lms_resources SET subjectCode='CSE302',subjectName='Operating Systems',updatedAt=datetime('now') WHERE uploadedBy='quality-pipeline' AND subjectCode='CSE304' AND isDeleted=0").run();
db.prepare("UPDATE lms_resources SET subjectCode='CSE209',subjectName='Database Management Systems',updatedAt=datetime('now') WHERE uploadedBy='quality-pipeline' AND subjectCode='CSE306' AND isDeleted=0").run();

// Re-count
result.finalResources = db.prepare("SELECT COUNT(*)as c FROM lms_resources WHERE isDeleted=0").get().c;
result.finalQB = db.prepare("SELECT COUNT(*)as c FROM lms_question_bank").get().c;
result.subjects = db.prepare("SELECT subjectCode,COUNT(*)as c FROM lms_resources WHERE isDeleted=0 GROUP BY subjectCode ORDER BY c DESC").all();

process.stdout.write(JSON.stringify(result));
db.close();