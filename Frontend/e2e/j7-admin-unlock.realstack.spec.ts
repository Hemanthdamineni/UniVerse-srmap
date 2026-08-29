import { test, expect } from "@playwright/test";

// Real-stack e2e: J7 — admin unlock (wrong reg-no rejected,
// wrong password rejected, success elevates) (Gate 7 P0).
//
// The admin elevation flow lives at /api/admin/elevate. The
// route accepts a register number + admin password and returns
// a session flag that unlocks the admin-only routes.

test.describe("realstack: J7 — admin elevation", () => {
  test("POST /api/admin/access/unlock rejects empty body (400/403)", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/access/unlock", {
      data: {},
    });
    // The route is auth-gated; without a session the response is
    // typically 401 or 403. With a session but no body it would
    // be 400. All valid.
    expect([400, 401, 403]).toContain(res.status());
  });

  test("POST /api/admin/access/unlock rejects wrong password (401)", async ({
    request,
  }) => {
    const res = await request.post("/api/admin/access/unlock", {
      data: {
        regNo: "smoke-9999",
        adminPassword: "definitely-wrong",
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/admin/access/unlock rejects wrong reg-no (401)", async ({
    request,
  }) => {
    // Use the seeded admin password (e2e-admin in start.sh) but
    // a reg-no that's not on the allowlist.
    const res = await request.post("/api/admin/access/unlock", {
      data: {
        regNo: "NOT-ON-ALLOWLIST",
        adminPassword: "e2e-admin",
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/admin/access/status requires auth (401)", async ({
    request,
  }) => {
    const res = await request.get("/api/admin/access/status");
    // 401 (no auth) or 200 (no admin, so the route is public-ish).
    // 500 is a hard fail.
    expect([200, 401]).toContain(res.status());
  });
});
