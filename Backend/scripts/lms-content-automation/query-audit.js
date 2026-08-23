#!/usr/bin/env node
/**
 * query-audit.js — Returns full audit JSON with subjects, types, questions, demos.
 * Usage: node query-audit.js <db-path>
 */
process.removeAllListeners('warning');
process.env.NODE_NO_WARNINGS = '1';
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const dbPath = process.argv[2] || path.resolve(__dirname, '../../data/lms.sqlite');
const db = new DatabaseSync(dbPath);
var s = db.prepare("SELECT subjectCode,COUNT(*)as total,COUNT(DISTINCT type)as types,COUNT(DISTINCT unitNormalized)as units FROM lms_resources WHERE isDeleted=0 GROUP BY subjectCode ORDER BY total ASC").all();
var t = db.prepare("SELECT type,COUNT(*)as c FROM lms_resources WHERE isDeleted=0 GROUP BY type ORDER BY c").all();
var q = db.prepare("SELECT subjectCode,COUNT(*)as c FROM lms_question_bank GROUP BY subjectCode ORDER BY c ASC").all();
var d = db.prepare("SELECT COUNT(*)as c FROM lms_resources WHERE isDeleted=0 AND (title LIKE '%Demo%' OR title LIKE '%placeholder%' OR title LIKE '%test%')").get();
process.stdout.write(JSON.stringify({subjects:s, types:t, questions:q, demoCount:d.c}));
db.close();