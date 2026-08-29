import { test, expect } from "@playwright/test";

// Real-stack e2e: helpdesk ticket lifecycle (J6 partial). Verifies
// the route contracts against a real backend. Ticket creation
// requires an authenticated session in the production code path
// (the audit's P1 "owner-only ticket access"); for the scaffold
// we verify the auth-gated rejection shape and the request
// envelope that the SPA will see.

test.describe("realstack: helpdesk ticket creation (J6 partial)", () => {
  test("POST /api/helpdesk/tickets without auth is 401 with error envelope", async ({ request }) => {
    const res = await request.post("/api/helpdesk/tickets", {
      data: {
        category: "Other",
        priority: "medium",
        subject: "Smoke test ticket",
        description: "Created by Frontend/e2e/helpdesk.realstack.spec.ts",
      },
    });
    // The route is auth-gated; the SPA's ticket creation flow
    // requires an authenticated session. Verify the rejection
    // envelope, not the success path (that's covered by unit
    // tests in Backend/test/helpdeskStore.test.js).
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("success", false);
    expect(body.error).toHaveProperty("code");
    expect(typeof body.requestId === "string" || body.requestId === null).toBe(true);
  });

  test("POST /api/helpdesk/tickets without auth has consistent shape regardless of body", async ({ request }) => {
    // The auth gate fires before body validation, so even a
    // malformed payload returns 401 (not 400). Verify the shape
    // is the auth envelope, not the validation envelope.
    const res = await request.post("/api/helpdesk/tickets", {
      data: {
        category: "Other",
        // subject and description intentionally missing
      },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("success", false);
    expect(body.error).toHaveProperty("code");
    expect(body.error.code).not.toBe("BAD_REQUEST");
  });
});
