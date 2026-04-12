#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");

const runMode = process.argv.includes("--run");

const steps = [
  { script: "discover:endpoints", note: "Browser will open. Complete ERP captcha and resume." },
  { script: "fetch:endpoints", note: "Fetches resolved endpoint responses into direct-api-output." },
  { script: "preprocess:endpoints", note: "Normalizes endpoint payloads for parser stability." },
  { script: "analyze:ui-map", note: "Rebuilds UI semantic map for action/schema metadata." },
  { script: "verify:integrity", note: "Runs static integrity gate (coverage + freshness)." },
];

function printRunbook() {
  console.log("Manual ERP Artifact Refresh Runbook");
  console.log("1. Export credentials if needed: ERP_USERNAME and ERP_PASSWORD.");
  console.log("2. Keep a desktop/browser session available for captcha + login pauses.");
  console.log("3. Run the refresh pipeline and confirm integrity at the end.");
  console.log("");
  for (const [index, step] of steps.entries()) {
    console.log(`${index + 1}. npm run ${step.script}`);
    console.log(`   ${step.note}`);
  }
  console.log("");
}

function runStep(scriptName) {
  const result = spawnSync("npm", ["run", scriptName], {
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    const error = new Error(`Step failed: npm run ${scriptName}`);
    error.status = result.status || 1;
    throw error;
  }
}

function main() {
  printRunbook();

  if (!runMode) {
    console.log('Use "--run" to execute the full refresh pipeline.');
    return;
  }

  for (const step of steps) {
    console.log(`\n>>> Running: npm run ${step.script}`);
    runStep(step.script);
  }

  console.log("\nManual artifact refresh completed.");
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = Number(error.status || 1);
}
