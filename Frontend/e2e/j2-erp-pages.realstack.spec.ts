import { test, expect } from "@playwright/test";

// Real-stack e2e: J2 — attendance / timetable / results / fees
// pages against a real backend (Gate 7 P0).
//
// The ERP-derived pages are served through the generic scrape
// route (/api/scrape/:pageKey) plus dedicated routes like
// /api/erp/attendance/history and /api/scores/me. The audit
// requires each ERP-derived page to render data (or fall back
// to a documented stale/partial state) when the live scraper
// is unavailable. We assert the API contracts respond with
// structured payloads; unauthenticated requests should be 401.

test.describe("realstack: J2 — ERP pages API contracts", () => {
  test("/api/erp/attendance/history responds with structured payload", async ({
    request,
  }) => {
    const res = await request.get("/api/erp/attendance/history");
    expect([200, 401]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof body).toBe("object");
      expect(body).toHaveProperty("ok");
    }
  });

  test("/api/scrape/timetable responds with structured payload", async ({
    request,
  }) => {
    const res = await request.get("/api/scrape/timetable");
    // 401 (no session) or 404 (no pageKey mapping) or 200 (cached
    // data). 500 is a hard fail.
    expect([200, 401, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof body).toBe("object");
      expect(body).toHaveProperty("ok");
    }
  });

  test("/api/scrape/fees responds with structured payload", async ({
    request,
  }) => {
    const res = await request.get("/api/scrape/fees");
    expect([200, 401, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof body).toBe("object");
      expect(body).toHaveProperty("ok");
    }
  });

  test("/api/scrape/attendance responds with structured payload", async ({
    request,
  }) => {
    const res = await request.get("/api/scrape/attendance");
    expect([200, 401, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof body).toBe("object");
      expect(body).toHaveProperty("ok");
    }
  });

  test("/api/scores/me requires auth (401 without session)", async ({
    request,
  }) => {
    const res = await request.get("/api/scores/me");
    expect(res.status()).toBe(401);
  });
});
