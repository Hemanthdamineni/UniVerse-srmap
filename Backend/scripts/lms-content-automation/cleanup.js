#!/usr/bin/env node
const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "..", "data", "lms.sqlite");
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");

// 1. Soft-delete demo resources
const demos = db.prepare("SELECT id, title FROM lms_resources WHERE title LIKE 'Demo%' AND isDeleted = 0").all();
console.log("Demo resources:", demos.length);
for (const d of demos) {
  db.prepare("UPDATE lms_resources SET isDeleted = 1, deletedAt = ?, deletedBy = ? WHERE id = ?")
    .run(new Date().toISOString(), "cleanup", d.id);
}

// 2. Soft-delete exact duplicates (same title + subjectCode, keep 1)
db.exec(`
  DELETE FROM lms_resources WHERE rowid IN (
    SELECT rowid FROM lms_resources
    WHERE isDeleted = 0 AND rowid NOT IN (
      SELECT MIN(rowid) FROM lms_resources WHERE isDeleted = 0 GROUP BY title, subjectCode
    )
  )
`);

// 3. Re-count
const remaining = db.prepare("SELECT COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0").get().c;
const byType = db.prepare("SELECT type, COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0 GROUP BY type ORDER BY c DESC").all();
console.log("Remaining active resources:", remaining);
console.log("By type:", JSON.stringify(byType));

// 4. Per-subject counts
const bySubject = db.prepare("SELECT subjectCode, COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0 GROUP BY subjectCode ORDER BY c DESC").all();
console.log("By subject:", JSON.stringify(bySubject));

db.close();
