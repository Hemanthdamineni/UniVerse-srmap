// Finds the breaking point of the backend under the resource caps in
// docker-compose.capacity.yml. Ramps virtual users in steps (see
// stages.json) until p95 latency or the error rate crosses a threshold,
// then aborts — the last stage it reached is the answer to "how many
// concurrent users can this box serve."
//
// Run via Backend/scripts/capacity/run.sh, not directly — that script
// also starts the resource sampler and brings the constrained stack up.
import http from "k6/http";
import { check, sleep } from "k6";

const CONFIG = JSON.parse(open("./stages.json"));

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: CONFIG.startVUs,
      stages: CONFIG.stages,
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    // abortOnFail stops the run as soon as the box can't keep up, instead
    // of grinding through the rest of the ramp against a backend that's
    // already falling over.
    http_req_duration: [{ threshold: "p(95)<3000", abortOnFail: true }],
    http_req_failed: [{ threshold: "rate<0.10", abortOnFail: true }],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:15000";

// Deliberately NOT /api/v2/erp/page/* (dashboard, timetable, etc). Those
// require either a real logged-in ERP session or a dump captured with
// `npm run dump:erp` against real SRM AP credentials — neither of which
// this harness has or should try to obtain. This ramp instead hits the
// local-SQLite-backed endpoints (career portal, events, academic
// calendar, vacant rooms) that don't touch the live ERP at all. This is
// still real, representative load: it's the same Express/Redis/SQLite
// request path the ERP pages use once past the scrape step, so it
// measures genuine per-request CPU/memory cost.
//
// If you specifically need the *scrape* path's cost (headless Chromium
// via Playwright, the most expensive request type this backend serves),
// see the "Testing the scraper path" section in README.md — it needs a
// real dump and is measured separately on purpose.
const PAGES = [
  "/api/career/opportunities?page=1",
  "/api/career/stats",
  "/api/career/trending?limit=12",
  "/api/career/feed",
  "/api/academic-calendar",
  "/api/vacant-rooms",
  "/api/events",
];

// These endpoints require a logged-in session. One demo login in setup()
// (same demo-auth path the e2e stack uses — see docker-compose.capacity.yml
// for why) stands in for "a student who's already logged in," and every VU
// reuses that one session cookie — which also matches reality: logging in
// is rare, browsing is frequent.
export function setup() {
  const res = http.post(`${BASE_URL}/api/auth/dev-login`, JSON.stringify({}), {
    headers: { "Content-Type": "application/json" },
  });
  if (res.status !== 200) {
    throw new Error(
      `dev-login failed with status ${res.status}: ${res.body}. ` +
        "Is the capacity stack running with NODE_ENV=development and ENABLE_DEMO_LOGIN=1?"
    );
  }
  const cookies = res.headers["Set-Cookie"];
  if (!cookies) {
    throw new Error("dev-login succeeded but returned no Set-Cookie header");
  }
  // k6 exposes only the first Set-Cookie header via res.headers; grab the
  // session cookie's name=value pair (before the first ';').
  const cookiePair = cookies.split(",")[0].split(";")[0];
  return { cookie: cookiePair };
}

export default function (data) {
  const path = PAGES[Math.floor(Math.random() * PAGES.length)];
  const res = http.get(`${BASE_URL}${path}`, {
    headers: { Cookie: data.cookie },
  });

  check(res, { "status is 200": (r) => r.status === 200 });

  // Think time between page loads, same range as the existing suites.
  sleep(0.1 + Math.random() * 0.2);
}
