import { test, expect } from "@playwright/test";

// Real-stack e2e scaffold (Gate 7 P0). Boots against an actual
// backend instance started by Backend/scripts/e2e-stack/start.sh.
// The "real" journey specs (J1–J8 per the prod-readiness split
// plan) will live alongside this; for now this file proves the
// infrastructure works: a real backend on /api/health and
// /api/career/health, and the frontend can reach the API through
// the same-origin proxy.

test.describe("realstack: backend + frontend wiring", () => {
  test("/api/live returns ok", async ({ request }) => {
    const res = await request.get("/api/live");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("live");
  });

  test("/api/ready returns 200 (or 503 NOT_READY with payload)", async ({ request }) => {
    const res = await request.get("/api/ready");
    // The audit accepts either 200 (everything ready) or 503
    // (NOT_READY with detail). The fixture-seeded backend may report
    // discovery/policy ready but Redis unready (we run with the
    // in-memory driver). Both are valid.
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("/api/career/health reports supervisor state", async ({ request }) => {
    const res = await request.get("/api/career/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    // state can be 'unavailable' (no venv) or 'running' (with venv) —
    // both are valid for a real-stack test of the endpoint.
    expect(["unavailable", "running", "stopped", "backoff", "disabled", "idle"]).toContain(body.state);
  });

  test("frontend index page renders without auth", async ({ page }) => {
    // The frontend is served by Vite (or the static prototype
    // build); for the real-stack profile the static prototype flag
    // is NOT set, so the page should serve the real SPA shell.
    const res = await page.goto("/");
    expect(res?.ok()).toBe(true);
  });
});
