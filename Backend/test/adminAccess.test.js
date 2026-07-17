const test = require("node:test");
const assert = require("node:assert/strict");

const { assertAdminAccess, hasAdminAccess } = require("../src/utils/adminAccess");

test("admin access denies password auth when no admin password is configured", () => {
  const request = {
    body: {},
    query: {},
    get() {
      return "";
    },
  };

  assert.equal(hasAdminAccess(request, ""), false);
  assert.throws(
    () => assertAdminAccess(request, ""),
    (error) =>
      error.status === 503 &&
      error.message === "Admin authentication is not configured"
  );
});

test("admin access still allows elevated platform admin sessions without password auth", () => {
  const request = {
    adminContext: { isElevated: true },
    body: {},
    query: {},
    get() {
      return "";
    },
  };

  assert.equal(hasAdminAccess(request, ""), true);
  assert.doesNotThrow(() => assertAdminAccess(request, ""));
});

test("admin access enforces configured password", () => {
  const request = {
    body: {},
    query: {},
    get(name) {
      return name === "x-admin-password" ? "secret" : "";
    },
  };

  assert.equal(hasAdminAccess(request, "secret"), true);
  assert.equal(hasAdminAccess(request, "other"), false);
});
