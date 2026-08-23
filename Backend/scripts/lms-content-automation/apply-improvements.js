#!/usr/bin/env node
/**
 * apply-improvements.js — Reads a JSON file of improvements and writes them to the LMS DB.
 * Called by the content-improver workflow after generating all rewrites/enrichments.
 *
 * Usage: node apply-improvements.js <path-to-json>
 * JSON format: [{ id: "res_...", noteContent: "full markdown string" }]
 */
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const payloadPath = process.argv[2];
if (!payloadPath || !fs.existsSync(payloadPath)) {
  console.error('Usage: node apply-improvements.js <path-to-json>');
  process.exit(1);
}

const DB_PATH = path.resolve(__dirname, '..', '..', 'data', 'lms.sqlite');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

const items = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
const stmt = db.prepare("UPDATE lms_resources SET noteContent = ?, updatedAt = datetime('now') WHERE id = ? AND isDeleted = 0");
let updated = 0, errors = 0;

for (const item of items) {
  if (!item.id || !item.noteContent) { errors++; continue; }
  try {
    const result = stmt.run(item.noteContent, item.id);
    if (result.changes > 0) updated++;
    else errors++;
  } catch (e) {
    errors++;
  }
}

console.log(JSON.stringify({ updated, errors, total: items.length }));
db.close();