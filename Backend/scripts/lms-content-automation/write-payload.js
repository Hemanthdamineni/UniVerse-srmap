#!/usr/bin/env node
/**
 * write-payload.js — Writes a JSON payload to a temp file.
 * Called by content-improver workflow to safely persist changes before applying.
 *
 * Usage: node write-payload.js <output-path>
 * Reads JSON from stdin (pipe it in)
 */
const fs = require('fs');
const chunks = [];
process.stdin.on('data', function(c) { chunks.push(c); });
process.stdin.on('end', function() {
  const data = Buffer.concat(chunks).toString();
  const outPath = process.argv[2];
  if (!outPath) { console.error('Usage: write-payload.js <output-path>'); process.exit(1); }
  fs.writeFileSync(outPath, data, 'utf8');
  const parsed = JSON.parse(data);
  console.log(JSON.stringify({ written: parsed.length }));
});