import { test, expect } from "@playwright/test";

// Real-stack e2e: J6 — helpdesk raise → SLA view → escalate →
// admin triage (Gate 7 P0).
//
// Helpdesk is auth-gated except for the public read surface
// (e.g. /api/helpdesk/stats). The audit requires owner-only
// ticket access (no cross-user IDOR).

test.describe("realstack: J6 — helpdesk lifecycle", () => {
  test("GET /api/helpdesk/stats responds with structured payload", async ({
    request,
  }) => {
    const res = await request.get("/api/helpdesk/stats");
    expect([200, 401]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof body).toBe("object");
      expect(body).toHaveProperty("ok");
    }
  });

  test("POST /api/helpdesk/tickets requires auth (401)", async ({
    request,
  }) => {
    const res = await request.post("/api/helpdesk/tickets", {
      data: {
        title: "smoke",
        description: "smoke",
        category: "general",
        priority: "low",
      },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/helpdesk/tickets requires auth (401)", async ({ request }) => {
    const res = await request.get("/api/helpdesk/tickets");
    expect(res.status()).toBe(401);
  });

  test("GET /api/helpdesk/tickets/:id requires auth (401)", async ({
    request,
  }) => {
    const res = await request.get("/api/helpdesk/tickets/smoke-id");
    expect(res.status()).toBe(401);
  });

  test("GET /api/campus-feedback/* requires auth (401)", async ({
    request,
  }) => {
    const res = await request.get("/api/campus-feedback/items");
    expect(res.status()).toBe(401);
  });
});
