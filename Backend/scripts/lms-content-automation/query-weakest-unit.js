#!/usr/bin/env node
/**
 * query-weakest-unit.js — Returns the unit with fewest resources for a subject.
 * Usage: node query-weakest-unit.js <subjectCode> [db-path]
 */
process.removeAllListeners('warning');
process.env.NODE_NO_WARNINGS = '1';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const subjectCode = process.argv[2];
const dbPath = process.argv[3] || path.resolve(__dirname, '../../data/lms.sqlite');
const db = new DatabaseSync(dbPath);
var u = db.prepare("SELECT unitNormalized,COUNT(*)as c FROM lms_resources WHERE subjectCode=? AND isDeleted=0 GROUP BY unitNormalized ORDER BY c ASC LIMIT 1").get(subjectCode);
if (!u) u = { unitNormalized: 'unit-1', c: 0 };
process.stdout.write(JSON.stringify(u));
db.close();