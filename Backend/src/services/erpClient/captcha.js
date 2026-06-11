const { LOGIN_PREAUTH_TTL_MS } = require("../../config/env");
const { createLoginAttemptId, createLoginAttemptTrace } = require("../loginDiagnostics");
const { createApiContext } = require("./apiContext");
const { parseLoginBootstrap } = require("./loginForm");

async function fetchCaptcha(options = {}) {
  const loginAttemptId =
    String(options?.loginAttemptId || "").trim() || createLoginAttemptId();
  const trace = createLoginAttemptTrace({ loginAttemptId });
  const api = await createApiContext();
  try {
    const bootstrapStartedAt = Date.now();
    const loginResp = await api.get("StudentLoginPage");
    const loginHtml = await loginResp.text();
    const loginBootstrap = {
      ...parseLoginBootstrap(loginHtml),
      loginHtml,
    };
    const storageAfterBootstrap = await api.storageState();
    trace.recordStage({
      stage: "bootstrap_page",
      startedAt: bootstrapStartedAt,
      classifier: "login_page",
      httpStatus: loginResp.status(),
      finalUrl: typeof loginResp.url === "function" ? loginResp.url() : LOGIN_URL,
      storageStateAfter: storageAfterBootstrap,
    });

    const captchaStartedAt = Date.now();
    const captchaResp = await api.get(loginBootstrap.captchaUrl);
    const captchaBuffer = await captchaResp.body();
    const latestStorageState = await api.storageState();

    if (!captchaResp.ok() || !captchaBuffer.length) {
      const error = new Error(
        `ERP captcha fetch failed with status ${captchaResp.status()} from ${loginBootstrap.captchaUrl}`
      );
      error.status = 502;
      trace.recordStage({
        stage: "captcha_fetch",
        startedAt: captchaStartedAt,
        classifier: "unknown_upstream_state",
        httpStatus: captchaResp.status(),
        finalUrl: loginBootstrap.captchaUrl,
        storageStateBefore: storageAfterBootstrap,
        storageStateAfter: latestStorageState,
        error,
      });
      throw error;
    }

    trace.recordStage({
      stage: "captcha_fetch",
      startedAt: captchaStartedAt,
      classifier: "login_page",
      httpStatus: captchaResp.status(),
      finalUrl: loginBootstrap.captchaUrl,
      storageStateBefore: storageAfterBootstrap,
      storageStateAfter: latestStorageState,
    });

    const issuedAt = Date.now();

    return {
      captchaBase64: `data:image/png;base64,${captchaBuffer.toString("base64")}`,
      storageState: latestStorageState,
      loginBootstrap,
      issuedAt,
      expiresInMs: LOGIN_PREAUTH_TTL_MS,
      expiresAt: new Date(issuedAt + LOGIN_PREAUTH_TTL_MS).toISOString(),
      loginAttemptId,
    };
  } finally {
    await api.dispose();
  }
}

module.exports = {
  fetchCaptcha,
};
