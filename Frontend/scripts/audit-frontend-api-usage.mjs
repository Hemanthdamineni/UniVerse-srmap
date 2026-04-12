import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(repoRoot, "src");

const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const FETCH_CALL_PATTERN = /\bfetch\s*\(\s*(['"`])([^'"`]+)\1/g;
const HTTP_CLIENT_CALL_PATTERN =
  /\b(?:axios|API)\.(?:get|post|put|patch|delete|request)\s*\(\s*(['"`])([^'"`]+)\1/g;

function collectSourceFiles(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(absolutePath));
      continue;
    }
    if (SOURCE_FILE_PATTERN.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function collectMatches(pattern, contents) {
  const matches = [];
  let match;
  while ((match = pattern.exec(contents)) !== null) {
    matches.push(match[2]);
  }
  pattern.lastIndex = 0;
  return matches;
}

function isDirectExternalTarget(target) {
  return /^https?:\/\//i.test(target.trim());
}

const violations = [];

for (const filePath of collectSourceFiles(sourceRoot)) {
  const contents = fs.readFileSync(filePath, "utf8");
  const targets = [
    ...collectMatches(FETCH_CALL_PATTERN, contents),
    ...collectMatches(HTTP_CLIENT_CALL_PATTERN, contents),
  ];

  for (const target of targets) {
    if (!isDirectExternalTarget(target)) continue;
    violations.push({
      file: path.relative(repoRoot, filePath),
      target,
    });
  }
}

if (violations.length > 0) {
  console.error("Direct external API usage detected in frontend source:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.target}`);
  }
  process.exit(1);
}

console.log("Frontend API contract audit passed. No direct external API calls were found.");
