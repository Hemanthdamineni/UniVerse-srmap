#!/usr/bin/env node
// Joins the docker-stats CSV from monitor.sh against the k6 stage
// schedule in stages.json to answer "how many concurrent users before
// this box saturates?" Run by run.sh after a capacity-ramp.js run.
//
// Usage: node report.mjs <monitor.csv> <k6-start-epoch>
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Must match docker-compose.capacity.yml's cpu limits — that's the only
// place the 1.6 / 0.3 core budgets are meant to live; keep them in sync
// if you resize the simulated VM shape there.
const CPU_LIMITS = {
  "universe-srmap-backend": 1.6,
  "universe-srmap-redis": 0.3,
};

const [, , csvPath, startEpochArg] = process.argv;
if (!csvPath || !startEpochArg) {
  console.error("usage: node report.mjs <monitor.csv> <k6-start-epoch>");
  process.exit(1);
}

const startEpoch = Number(startEpochArg);
const stagesConfig = JSON.parse(
  readFileSync(join(__dirname, "../../load-tests/capacity/stages.json"), "utf8")
);

function durationToSeconds(d) {
  const m = /^(\d+)([sm])$/.exec(d);
  if (!m) throw new Error(`bad duration: ${d}`);
  return m[2] === "m" ? Number(m[1]) * 60 : Number(m[1]);
}

// Build stage windows as [startOffsetSec, endOffsetSec, targetVUs].
let cursor = 0;
const windows = stagesConfig.stages.map((s) => {
  const dur = durationToSeconds(s.duration);
  const w = { start: cursor, end: cursor + dur, target: s.target };
  cursor += dur;
  return w;
});

const rows = readFileSync(csvPath, "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .filter(Boolean)
  .map((line) => {
    const [epoch, container, cpu, memUsedMb, memLimitMb, memPercent] = line.split(",");
    return {
      offset: Number(epoch) - startEpoch,
      container,
      cpu: Number(cpu),
      memUsedMb: Number(memUsedMb),
      memPercent: Number(memPercent),
    };
  })
  .filter((r) => r.offset >= 0);

function statsFor(container, windowStart, windowEnd) {
  const samples = rows.filter(
    (r) => r.container === container && r.offset >= windowStart && r.offset < windowEnd
  );
  if (samples.length === 0) return null;
  const cpuVals = samples.map((s) => s.cpu);
  const memVals = samples.map((s) => s.memUsedMb);
  const limit = CPU_LIMITS[container] ?? 1;
  const avgCpu = cpuVals.reduce((a, b) => a + b, 0) / cpuVals.length;
  const maxCpu = Math.max(...cpuVals);
  return {
    avgCpuPct: avgCpu,
    maxCpuPct: maxCpu,
    avgCpuOfBudget: avgCpu / (limit * 100),
    maxCpuOfBudget: maxCpu / (limit * 100),
    avgMemMb: memVals.reduce((a, b) => a + b, 0) / memVals.length,
    maxMemMb: Math.max(...memVals),
  };
}

console.log("\n# Capacity ramp report\n");
console.log(
  "| Stage target VUs | window (s) | backend CPU avg/max (% of 1.6-core budget) | backend mem avg/max (MB) | redis CPU avg/max (% of 0.3-core budget) |"
);
console.log("|---|---|---|---|---|");

let firstSaturatedStage = null;

for (const w of windows) {
  const backend = statsFor("universe-srmap-backend", w.start, w.end);
  const redis = statsFor("universe-srmap-redis", w.start, w.end);
  if (!backend) continue;

  const fmtPct = (n) => `${(n * 100).toFixed(0)}%`;
  const backendCell = `${backend.avgCpuPct.toFixed(0)}% / ${backend.maxCpuPct.toFixed(0)}% (${fmtPct(backend.avgCpuOfBudget)} / ${fmtPct(backend.maxCpuOfBudget)})`;
  const memCell = `${backend.avgMemMb.toFixed(0)} / ${backend.maxMemMb.toFixed(0)}`;
  const redisCell = redis
    ? `${redis.avgCpuPct.toFixed(0)}% / ${redis.maxCpuPct.toFixed(0)}% (${fmtPct(redis.avgCpuOfBudget)} / ${fmtPct(redis.maxCpuOfBudget)})`
    : "n/a";

  console.log(`| ${w.target} | ${w.start}-${w.end} | ${backendCell} | ${memCell} | ${redisCell} |`);

  if (!firstSaturatedStage && backend.avgCpuOfBudget >= 0.85) {
    firstSaturatedStage = w;
  }
}

console.log("\n## Verdict\n");
if (firstSaturatedStage) {
  console.log(
    `Backend CPU crossed 85% of its 1.6-core budget at the **${firstSaturatedStage.target} VU** stage. ` +
      `Treat that as the realistic concurrent-user ceiling for a 2 OCPU/12GB Oracle VM running backend+redis+caddy — ` +
      `k6 VUs here browse continuously with ~100-300ms think time between page loads, which is denser than real ` +
      `student traffic, so this is a conservative (worst-case) number, not an average-case one.`
  );
} else {
  console.log(
    "Backend CPU never crossed 85% of budget across the whole ramp — either it survived to the top stage " +
      `(${windows[windows.length - 2]?.target ?? "?"} VUs) without saturating, or k6 aborted early on latency/error ` +
      "thresholds before CPU became the bottleneck (check the k6 output above the report — if it says " +
      '"thresholds on metrics ... have been crossed", the real limit was latency/error rate, not CPU, and you ' +
      "should raise BASE_URL concurrency limits or investigate the request path k6 was hitting when it aborted."
  );
}
console.log(
  "\nIf k6 aborted before reaching the last stage, the abort point (not this table's last row) is the real ceiling — " +
    "check the k6 stdout summary for which threshold fired and at what VU count."
);
