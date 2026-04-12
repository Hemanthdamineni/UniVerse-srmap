import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    cached_pages: {
      executor: "constant-arrival-rate",
      rate: 120,
      timeUnit: "1s",
      duration: "2m",
      preAllocatedVUs: 30,
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<1500"],
    http_req_failed: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const PAGES = [
  "dashboard",
  "academic/time-table",
  "academic/attendance-details",
  "examination/current-semester-results",
  "examination/earlier-internal-marks",
];

export default function () {
  const page = PAGES[Math.floor(Math.random() * PAGES.length)];
  const res = http.get(`${BASE_URL}/api/v2/erp/page/${page}`);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "source is cache or dump": (r) => {
      try {
        const body = JSON.parse(r.body);
        return ["cache-fresh", "cache-stale", "dump", "live"].includes(body.source);
      } catch {
        return false;
      }
    },
  });

  sleep(0.1);
}
