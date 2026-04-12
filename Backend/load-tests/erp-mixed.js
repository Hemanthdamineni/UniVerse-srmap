import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    mixed: {
      executor: "constant-vus",
      vus: 80,
      duration: "3m",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<1800"],
    http_req_failed: ["rate<0.02"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const SESSION_ID = __ENV.SESSION_ID || "";
const MIXED_PAGES = [
  "dashboard",
  "academic/time-table",
  "academic/attendance-details",
  "examination/current-semester-results",
  "finance/online-payment-verification",
  "examination/exam-registration",
];

export default function () {
  const page = MIXED_PAGES[Math.floor(Math.random() * MIXED_PAGES.length)];
  const sessionQuery = SESSION_ID ? `?sessionId=${encodeURIComponent(SESSION_ID)}` : "";
  const res = http.get(`${BASE_URL}/api/v2/erp/page/${page}${sessionQuery}`);

  check(res, {
    "status 200": (r) => r.status === 200,
  });

  sleep(0.15);
}
