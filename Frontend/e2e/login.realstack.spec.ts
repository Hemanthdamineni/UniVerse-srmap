import { test, expect } from "@playwright/test";

// Real-stack e2e: backend + frontend wiring. The auth gate
// applies to all /api/* routes except the explicit allowlist
// (captcha, live, ready, metrics, telemetry). The career/health
// endpoint is auth-gated — the spec accepts the 401 envelope.

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

  test("/api/career/health is auth-gated (401) or returns supervisor state (200)", async ({ request }) => {
    // The career/health endpoint is mounted at /api/* under the
    // global auth gate; the e2e stack boots without a session, so
    // the unauthenticated response is 401. When the route is hit
    // with a session it returns a supervisor state payload.
    const res = await request.get("/api/career/health");
    expect([200, 401]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      // state can be 'unavailable' (no venv) or 'running' (with venv) —
      // both are valid for a real-stack test of the endpoint.
      expect(["unavailable", "running", "stopped", "backoff", "disabled", "idle"]).toContain(body.state);
    } else {
      const body = await res.json();
      expect(body).toHaveProperty("success", false);
      expect(body.error).toHaveProperty("code");
    }
  });

  test("frontend index page renders without auth", async ({ page }) => {
    // The frontend is served by Vite (or the static prototype
    // build); for the real-stack profile the static prototype flag
    // is NOT set, so the page should serve the real SPA shell.
    const res = await page.goto("/");
    expect(res?.ok()).toBe(true);
  });
});
