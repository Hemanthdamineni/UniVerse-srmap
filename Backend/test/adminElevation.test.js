const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ADMIN_REGISTER_NUMBERS = "AP23110010419";

const { createUserContextMiddleware } = require("../src/utils/eventsAuth");
const { createAdminContextMiddleware } = require("../src/middleware/adminContext");
const { hasAdminAccess } = require("../src/utils/adminAccess");

function makeSession({ elevated = false } = {}) {
  return {
    loggedIn: true,
    adminElevated: elevated,
    profileData: { TableContent: { "Register No.": "AP23110010419", "Student Name": "Admin Candidate" } },
  };
}

async function contextFor(session) {
  const sessionStore = { async getOrThrow() { return session; } };
  const req = { headers: { cookie: "erp_session=session-1" }, header(name) { return this.headers[name.toLowerCase()] || ""; } };
  await new Promise((resolve) => createAdminContextMiddleware({ sessionStore })(req, {}, resolve));
  await new Promise((resolve) => createUserContextMiddleware({ sessionStore })(req, {}, resolve));
  return req;
}

test("allowlisted users are ordinary students until the server-side elevation flag is set", async () => {
  const req = await contextFor(makeSession({ elevated: false }));
  assert.equal(req.adminContext.potentialAdmin, true);
  assert.equal(req.adminContext.isElevated, false);
  assert.equal(req.userContext.role, "student");
  assert.equal(hasAdminAccess(req), false);
});

test("disabling elevation immediately removes the authoritative admin privilege", async () => {
  const elevated = await contextFor(makeSession({ elevated: true }));
  assert.equal(elevated.userContext.role, "admin");
  assert.equal(hasAdminAccess(elevated), true);

  const disabled = await contextFor(makeSession({ elevated: false }));
  assert.equal(disabled.userContext.role, "student");
  assert.equal(hasAdminAccess(disabled), false);
});
