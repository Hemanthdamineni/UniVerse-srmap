const { LOGIN_PREAUTH_TTL_MS } = require("../../config/env");
const { makeAuthError } = require("./sessionState");

function assertFreshPreAuthAttempt(preAuthAttempt, loginAttemptId, nowFn = () => Date.now()) {
  const issuedAt = Number(preAuthAttempt?.issuedAt || 0);
  if (!issuedAt) {
    throw makeAuthError("CAPTCHA_EXPIRED", "Captcha expired. Please refresh and try again.", 401, {
      loginAttemptId,
    });
  }

  const ageMs = Math.max(0, nowFn() - issuedAt);
  if (ageMs > LOGIN_PREAUTH_TTL_MS) {
    throw makeAuthError("CAPTCHA_EXPIRED", "Captcha expired. Please refresh and try again.", 401, {
      loginAttemptId,
      issuedAt,
      expiresInMs: LOGIN_PREAUTH_TTL_MS,
      expiresAt: new Date(issuedAt + LOGIN_PREAUTH_TTL_MS).toISOString(),
    });
  }
}

module.exports = {
  assertFreshPreAuthAttempt,
};
