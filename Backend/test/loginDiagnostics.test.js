const test = require("node:test");
const assert = require("node:assert/strict");

const {
  redactSensitiveText,
  sanitizeArtifactPayload,
} = require("../src/services/core/sessionServices");

test("redactSensitiveText removes secrets and common identifiers", () => {
  const sanitized = redactSensitiveText(
    "session 123e4567-e89b-12d3-a456-426614174000 user student@example.com reg 1234567890 secretValue",
    ["secretValue"]
  );

  assert.equal(sanitized.includes("secretValue"), false);
  assert.equal(sanitized.includes("123e4567-e89b-12d3-a456-426614174000"), false);
  assert.equal(sanitized.includes("student@example.com"), false);
  assert.equal(sanitized.includes("1234567890"), false);
});

test("sanitizeArtifactPayload redacts nested login artifacts", () => {
  const sanitized = sanitizeArtifactPayload(
    {
      html: "<div>student@example.com</div>",
      request: {
        username: "student",
        password: "secret",
      },
      error: new Error("Failed for student"),
    },
    ["student", "secret"]
  );

  assert.equal(String(sanitized.html).includes("student@example.com"), false);
  assert.equal(String(sanitized.request.username).includes("student"), false);
  assert.equal(String(sanitized.request.password).includes("secret"), false);
  assert.equal(String(sanitized.error.message).includes("student"), false);
});
