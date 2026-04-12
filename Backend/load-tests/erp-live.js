import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    live_pages: {
      executor: "ramping-arrival-rate",
      startRate: 20,
      timeUnit: "1s",
      preAllocatedVUs: 20,
      maxVUs: 300,
      stages: [
        { duration: "1m", target: 60 },
        { duration: "1m", target: 120 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<2500"],
    http_req_failed: ["rate<0.05"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const SESSION_ID = __ENV.SESSION_ID || "";
const LIVE_PAGES = [
  "finance/online-payment-verification",
  "finance/payment-acknowledgment",
  "examination/exam-registration",
  "examination/exam-registration-details",
];

export default function () {
  const page = LIVE_PAGES[Math.floor(Math.random() * LIVE_PAGES.length)];
  const sessionQuery = SESSION_ID ? `?sessionId=${encodeURIComponent(SESSION_ID)}` : "";
  const res = http.get(`${BASE_URL}/api/v2/erp/page/${page}${sessionQuery}`);

  check(res, {
    "response shape": (r) => {
      if (r.status !== 200) return true;
      try {
        const body = JSON.parse(r.body);
        return typeof body.success === "boolean" && typeof body.pageKey === "string";
      } catch {
        return false;
      }
    },
  });

  sleep(0.2);
}
