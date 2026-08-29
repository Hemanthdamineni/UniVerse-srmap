import { test, expect } from "@playwright/test";

// Real-stack e2e: helpdesk ticket lifecycle (J6 partial). Verifies
// the public ticket-creation path works against a real backend
// (the audit's "happy path + one failure case" requirement). The
// full J6 journey (SLA view, escalation, admin triage) requires a
// logged-in session and is out of scope for this scaffold.

test.describe("realstack: helpdesk ticket creation (J6 partial)", () => {
  test("POST /api/helpdesk/tickets with valid body returns 201 + ticketId", async ({ request }) => {
    const res = await request.post("/api/helpdesk/tickets", {
      data: {
        category: "Other",
        priority: "medium",
        subject: "Smoke test ticket",
        description: "Created by Frontend/e2e/helpdesk.realstack.spec.ts",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("success", true);
    expect(body).toHaveProperty("data");
    expect(body.data).toHaveProperty("id");
    expect(body.data).toHaveProperty("status");
  });

  test("POST /api/helpdesk/tickets with missing required field returns 400", async ({ request }) => {
    const res = await request.post("/api/helpdesk/tickets", {
      data: {
        category: "Other",
        // subject and description intentionally missing
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("success", false);
    expect(body).toHaveProperty("error");
  });
});
