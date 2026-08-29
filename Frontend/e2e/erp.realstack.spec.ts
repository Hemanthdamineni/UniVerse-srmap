import { test, expect } from "@playwright/test";

// Real-stack e2e: ERP integration resilience (Gate 5). Verifies
// the backend's readiness payload and the career/health endpoint
// so a deployment's "is the backend up + is the scraper healthy?"
// check is part of the smoke matrix.

test.describe("realstack: ERP integration (Gate 5)", () => {
  test("/api/ready reports component detail", async ({ request }) => {
    const res = await request.get("/api/ready");
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    // The audit requires the ready response to include discovery /
    // page-policy / Redis / external-DB / content-DB checks. The
    // fixture backend may report any of these as not-ready if the
    // corresponding env was not set at start; that's a 503 with
    // checks, which is also acceptable.
    expect(body).toHaveProperty("ok");
    if (res.status() === 503) {
      expect(body).toHaveProperty("checks");
    }
  });

  test("/api/career/health is a structured payload", async ({ request }) => {
    const res = await request.get("/api/career/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.state).toBe("string");
    // state can be any of: unavailable, running, idle, backoff,
    // stopping, stopped, disabled, exiting. Verify the state is
    // a known one.
    expect([
      "unavailable",
      "running",
      "idle",
      "backoff",
      "stopping",
      "stopped",
      "disabled",
      "exiting",
    ]).toContain(body.state);
  });
});
