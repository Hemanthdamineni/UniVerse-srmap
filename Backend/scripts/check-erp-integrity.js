#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const scrapeTargets = require("../src/config/scrapeTargets");
const { EXTERNAL_PAGE_SEED_DATA } = require("../src/data/externalSeedData");
const {
  DISCOVERY_FILE_CANDIDATES,
  ERP_UI_MAP_FILE,
  FRONTEND_BLUEPRINT_FILE,
  ERP_ARTIFACT_MAX_AGE_DAYS,
} = require("../src/config/env");
const { evaluateIntegrityStatic } = require("../src/services/erpIntegrityService");

function resolveArg(flag, fallback = "") {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return fallback;
  return String(process.argv[idx + 1] || fallback);
}

function resolveDiscoveryFile() {
  const fromArgs = resolveArg("--discovery", "");
  if (fromArgs) return path.resolve(fromArgs);
  return DISCOVERY_FILE_CANDIDATES.find((filePath) => fs.existsSync(filePath)) || "";
}

function printCoverageLine(label, payload) {
  const total = Number(
    payload?.totalKeys || payload?.totalTargets || payload?.activeErpKeyCount || 0
  );
  const missing = Array.isArray(payload?.missingInScrapeTargets)
    ? payload.missingInScrapeTargets.length
    : Array.isArray(payload?.missingInExternalSeed)
    ? payload.missingInExternalSeed.length
    : Array.isArray(payload?.missingMappings)
    ? payload.missingMappings.length
    : 0;
  console.log(`${label}: total=${total}, missing=${missing}`);
}

function main() {
  const maxArtifactAgeDaysRaw = resolveArg("--max-age-days", "");
  const maxArtifactAgeDays = Number(maxArtifactAgeDaysRaw || ERP_ARTIFACT_MAX_AGE_DAYS || 14);
  const discoveryFile = resolveDiscoveryFile();
  const uiMapFileRaw = resolveArg("--ui-map", ERP_UI_MAP_FILE);
  const uiMapFile = uiMapFileRaw ? path.resolve(uiMapFileRaw) : "";
  const frontendBlueprintFile = path.resolve(
    resolveArg("--frontend-blueprints", FRONTEND_BLUEPRINT_FILE)
  );

  const report = evaluateIntegrityStatic({
    scrapeTargets,
    externalSeedData: EXTERNAL_PAGE_SEED_DATA,
    discoveryFile,
    uiMapFile,
    frontendBlueprintFile,
    maxArtifactAgeDays,
  });

  console.log(`Integrity checked at: ${report.checkedAt}`);
  console.log(`Artifact max age: ${report.maxArtifactAgeDays} days`);
  console.log(`Frontend blueprint loaded: ${report.frontend.loaded ? "yes" : "no"}`);

  const artifacts = report.artifacts || {};
  for (const [name, artifact] of Object.entries(artifacts)) {
    console.log(
      `artifact:${name} exists=${artifact.exists ? "yes" : "no"} stale=${
        artifact.stale ? "yes" : "no"
      } ageDays=${artifact.ageDays == null ? "n/a" : artifact.ageDays}`
    );
  }

  printCoverageLine("coverage:frontendErp", report.coverage?.frontendErp);
  printCoverageLine("coverage:frontendExternal", report.coverage?.frontendExternal);
  printCoverageLine("coverage:scrapeTargets", report.coverage?.scrapeTargets);

  if (!report.ok) {
    console.error("Integrity check failed.");
    for (const failure of report.failures || []) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Integrity check passed.");
}

main();
