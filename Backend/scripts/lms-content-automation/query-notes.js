#!/usr/bin/env node
/**
 * query-notes.js — Returns JSON array of all note resources with length.
 * Only prints valid JSON to stdout, no warnings.
 * Usage: node query-notes.js <db-path>
 */
process.removeAllListeners('warning');
process.env.NODE_NO_WARNINGS = '1';
const { DatabaseSync } = require('node:sqlite');
const dbPath = process.argv[2] || require('path').resolve(__dirname, '../../data/lms.sqlite');
const db = new DatabaseSync(dbPath);
const r = db.prepare("SELECT id,title,subjectCode,unit,LENGTH(COALESCE(noteContent,''))as len FROM lms_resources WHERE type='note' AND isDeleted=0 ORDER BY len ASC").all();
process.stdout.write(JSON.stringify(r));
db.close();