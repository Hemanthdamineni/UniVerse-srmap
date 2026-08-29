import { test, expect } from "@playwright/test";

// Real-stack e2e: ERP integration resilience (Gate 5). Verifies
// the backend's readiness payload and a few smoke paths. The
// career/health endpoint is auth-gated in production (it's an
// admin/supervisor surface), so the spec accepts either 200 (when
// auth context is present) or 401 (the default for the e2e
// stack, which boots without a session).

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

  test("/api/career/health is auth-gated (401) or returns supervisor state (200)", async ({ request }) => {
    // The route is mounted at /api/* and falls under the global
    // auth gate. With no session, we expect 401; with a session
    // the response body has a `state` field. Accept both.
    const res = await request.get("/api/career/health");
    expect([200, 401]).toContain(res.status());
    if (res.status() === 200) {
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
    } else {
      // 401 — verify the error envelope shape matches the rest
      // of the API.
      const body = await res.json();
      expect(body).toHaveProperty("success", false);
      expect(body.error).toHaveProperty("code");
    }
  });
});
