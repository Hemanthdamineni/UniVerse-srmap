const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { canModerateCareerSubmissions } = require("../src/utils/careerAccess");

describe("careerAccess", () => {
  test("allows admin access flag", () => {
    assert.strictEqual(canModerateCareerSubmissions({ hasAdminAccess: true, role: "student" }), true);
  });

  test("default roles include faculty and department_head", () => {
    assert.strictEqual(canModerateCareerSubmissions({ role: "faculty" }), true);
    assert.strictEqual(canModerateCareerSubmissions({ role: "department_head" }), true);
    assert.strictEqual(canModerateCareerSubmissions({ role: "student" }), false);
    assert.strictEqual(canModerateCareerSubmissions(null), false);
  });
});
