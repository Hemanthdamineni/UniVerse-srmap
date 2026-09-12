const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizePath } = require("../src/services/campus/feedbackServices");

test("metric route labels retain templates but collapse raw attacker-controlled URLs", () => {
  assert.equal(normalizePath("/api/events/:eventId/registrations/:registrationId"), "/api/events/:eventId/registrations/:registrationId");
  assert.equal(normalizePath("/api/events/attacker-controlled-slug-123"), "unmatched");
  assert.equal(normalizePath("/api/" + "x".repeat(10_000)), "unmatched");
  assert.equal(normalizePath("/health"), "/health");
});
