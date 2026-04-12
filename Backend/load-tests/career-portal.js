/**
 * k6 load test for /api/career/* against a production-sized career.sqlite.
 *
 * Prerequisites:
 *   1. Seed DB: `node scripts/seed-career-stress-sqlite.mjs --out data/career-stress.sqlite --count 150000 --force`
 *   2. Point the backend at that file (e.g. CAREER_DB_PATH or your env that selects career.sqlite — match your server config).
 *   3. Set CAREER_LOAD_TEST_TOKEN in backend env and pass the same value here.
 *
 * Run (example):
 *   CAREER_LOAD_TEST_TOKEN=devtoken \
 *   STRESS_OPP_COUNT=150000 \
 *   k6 run load-tests/career-portal.js
 *
 * Env:
 *   BASE_URL              default http://localhost:5000
 *   CAREER_LOAD_TEST_TOKEN required for synthetic session headers
 *   STRESS_OPP_COUNT      upper bound for random /opportunities/:id (default 150000)
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const checkFailRate = new Rate("career_checks_failed");

export const options = {
  stages: [
    { duration: "30s", target: 200 },
    { duration: "2m", target: 1000 },
    { duration: "3m", target: 1000 },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000", "p(99)<8000"],
    http_req_failed: ["rate<0.08"],
    career_checks_failed: ["rate<0.15"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const LOAD_TOKEN = __ENV.CAREER_LOAD_TEST_TOKEN || "";
const STRESS_MAX = Math.max(1, Number(__ENV.STRESS_OPP_COUNT || 150000));

function loadHeaders() {
  return {
    "x-career-load-token": LOAD_TOKEN,
    "x-load-user-id": `k6-vu-${__VU}-iter-${__ITER}`,
    "x-load-role": "student",
    "x-load-branch": "CSE",
    "x-load-year": "3",
  };
}

const paths = [
  () => "/api/career/opportunities?page=1",
  () => "/api/career/stats",
  () => "/api/career/trending?limit=12",
  () => "/api/career/health",
  () => "/api/career/feed",
  () => `/api/career/opportunities/stress-${Math.floor(Math.random() * STRESS_MAX)}`,
];

export function setup() {
  if (!LOAD_TOKEN) {
    throw new Error("Set CAREER_LOAD_TEST_TOKEN to match Backend CAREER_LOAD_TEST_TOKEN");
  }
}

export default function () {
  const path = paths[Math.floor(Math.random() * paths.length)]();
  const res = http.get(`${BASE_URL}${path}`, { headers: loadHeaders() });
  const ok = check(res, {
    "2xx": (r) => r.status >= 200 && r.status < 300,
  });
  checkFailRate.add(!ok);
  sleep(0.05 + Math.random() * 0.15);
}
