const { createLoginAttemptId, createLoginAttemptTrace } = require("../loginDiagnostics");
const { LOGIN_URL } = require("../../config/env");
const { createApiContext } = require("./apiContext");
const { assertFreshPreAuthAttempt } = require("./preAuth");
const { submitLoginViaApi, submitLoginInBrowser } = require("./authSubmit");
const { verifyAuthenticatedShellFromStorageState, probeProfileFromStorageState } = require("./authProbe");
const { parseLoginBootstrap } = require("./loginForm");
const { classifyLoginResponse, makeAuthError } = require("./sessionState");

function buildFailureResult({ storageState, loginAttemptId, classifier, failureCode, status, message }) {
  return {
    success: false,
    storageState,
    loginAttemptId,
    classifier,
    failureCode,
    status,
    message,
  };
}

async function finalizeAuthenticatedLogin({
  storageState,
  username,
  finalUrl,
  loginAttemptId,
  trace,
  probeProfileFn,
}) {
  const profileStartedAt = Date.now();
  const profileAttempt = await probeProfileFn(storageState, finalUrl);
  trace.recordStage({
    stage: "profile_probe",
    startedAt: profileStartedAt,
    classifier: profileAttempt.classifier,
    finalUrl: profileAttempt.finalUrl || finalUrl,
    storageStateBefore: storageState,
    storageStateAfter: profileAttempt.storageState,
    error: profileAttempt.error || null,
    artifactPayload:
      profileAttempt.profileStatus !== "ready"
        ? {
            html: profileAttempt.rawHtml || "",
            finalUrl: profileAttempt.finalUrl || finalUrl,
            classifier: profileAttempt.classifier,
          }
        : null,
  });

  if (profileAttempt.profileStatus === "ready") {
    return {
      success: true,
      storageState: profileAttempt.storageState,
      profileData: profileAttempt.profileData,
      profileStatus: "ready",
      loginAttemptId,
    };
  }

  return {
    success: true,
    storageState: profileAttempt.storageState,
    profileStatus: "deferred",
    loginAttemptId,
  };
}

async function loginWithCaptcha(
  { storageState, username, password, captcha, loginBootstrap, preAuthAttempt, sessionId = "" },
  overrides = {}
) {
  const deps = {
    submitLoginViaApiFn: overrides.submitLoginViaApiFn || submitLoginViaApi,
    submitLoginInBrowserFn: overrides.submitLoginInBrowserFn || submitLoginInBrowser,
    verifyAuthenticatedShellFn:
      overrides.verifyAuthenticatedShellFn || verifyAuthenticatedShellFromStorageState,
    probeProfileFn: overrides.probeProfileFn || probeProfileFromStorageState,
    traceFactory: overrides.traceFactory || createLoginAttemptTrace,
    nowFn: overrides.nowFn || (() => Date.now()),
  };
  const loginAttemptId =
    String(preAuthAttempt?.loginAttemptId || "").trim() || createLoginAttemptId();
  const trace = deps.traceFactory({
    loginAttemptId,
    sessionId,
    secrets: [username, password, captcha],
  });

  assertFreshPreAuthAttempt(preAuthAttempt, loginAttemptId, deps.nowFn);

  let activeBootstrap = loginBootstrap || null;
  if (!activeBootstrap) {
    const bootstrapApi = await createApiContext(storageState, { referer: LOGIN_URL });
    try {
      const bootstrapStartedAt = Date.now();
      const loginPageResp = await bootstrapApi.get("StudentLoginPage");
      const loginHtml = await loginPageResp.text();
      activeBootstrap = {
        ...parseLoginBootstrap(loginHtml),
        loginHtml,
      };
      trace.recordStage({
        stage: "bootstrap_page",
        startedAt: bootstrapStartedAt,
        classifier: "login_page",
        httpStatus: loginPageResp.status(),
        finalUrl: typeof loginPageResp.url === "function" ? loginPageResp.url() : LOGIN_URL,
        storageStateBefore: storageState,
        storageStateAfter: await bootstrapApi.storageState(),
      });
    } finally {
      await bootstrapApi.dispose();
    }
  }

  const normalizedAuth = {
    storageState,
    loginBootstrap: activeBootstrap,
    username: String(username),
    password: String(password),
    captcha: String(captcha),
  };

  const attempts = [];
  let latestStorageState = storageState;
  let observedUpstreamState = false;

  try {
    const submitStartedAt = Date.now();
    const apiLoginResult = await deps.submitLoginViaApiFn(normalizedAuth);
    latestStorageState = apiLoginResult.storageState;
    const submitClassification = classifyLoginResponse(apiLoginResult.html, {
      hasSidebar: apiLoginResult.hasSidebar,
      finalUrl: apiLoginResult.finalUrl,
    });
    observedUpstreamState = true;
    trace.recordStage({
      stage: "direct_submit",
      startedAt: submitStartedAt,
      classifier: submitClassification.classifier,
      httpStatus: apiLoginResult.httpStatus,
      finalUrl: apiLoginResult.finalUrl,
      storageStateBefore: storageState,
      storageStateAfter: apiLoginResult.storageState,
      artifactPayload:
        submitClassification.classifier === "authenticated_shell"
          ? null
          : {
              html: apiLoginResult.html,
              finalUrl: apiLoginResult.finalUrl,
              httpStatus: apiLoginResult.httpStatus,
              submissionMeta: apiLoginResult.submissionMeta,
            },
    });

    if (submitClassification.failureCode) {
      trace.finish({
        outcome: "failure",
        statusCode: submitClassification.status,
        errorCode: submitClassification.failureCode,
        classifier: submitClassification.classifier,
      });
      return buildFailureResult({
        storageState: latestStorageState,
        loginAttemptId,
        classifier: submitClassification.classifier,
        failureCode: submitClassification.failureCode,
        status: submitClassification.status,
        message: submitClassification.message,
      });
    }

    if (submitClassification.authenticated) {
      const loginResult = await finalizeAuthenticatedLogin({
        storageState: apiLoginResult.storageState,
        username,
        finalUrl: apiLoginResult.finalUrl,
        loginAttemptId,
        trace,
        probeProfileFn: deps.probeProfileFn,
      });
      trace.finish({
        outcome: "success",
        statusCode: 200,
        profileStatus: loginResult.profileStatus,
        classifier: submitClassification.classifier,
      });
      return loginResult;
    }

    const verifyStartedAt = Date.now();
    const directVerification = await deps.verifyAuthenticatedShellFn(apiLoginResult.storageState);
    latestStorageState = directVerification.storageState || latestStorageState;
    observedUpstreamState = true;
    trace.recordStage({
      stage: "auth_verification",
      startedAt: verifyStartedAt,
      classifier: directVerification.classifier,
      httpStatus: directVerification.httpStatus,
      finalUrl: directVerification.finalUrl,
      storageStateBefore: apiLoginResult.storageState,
      storageStateAfter: latestStorageState,
      artifactPayload:
        directVerification.authenticated
          ? null
          : {
              html: directVerification.html || "",
              finalUrl: directVerification.finalUrl,
              httpStatus: directVerification.httpStatus,
            },
    });

    if (directVerification.authenticated) {
      const loginResult = await finalizeAuthenticatedLogin({
        storageState: latestStorageState,
        username,
        finalUrl: directVerification.finalUrl,
        loginAttemptId,
        trace,
        probeProfileFn: deps.probeProfileFn,
      });
      trace.finish({
        outcome: "success",
        statusCode: 200,
        profileStatus: loginResult.profileStatus,
        classifier: directVerification.classifier,
      });
      return loginResult;
    }

    attempts.push(`direct submit could not verify auth (${directVerification.classifier})`);
  } catch (error) {
    attempts.push(`direct submit failed: ${error.message || "Unknown direct submit error"}`);
  }

  try {
    const browserStartedAt = Date.now();
    const browserLoginResult = await deps.submitLoginInBrowserFn(normalizedAuth);
    latestStorageState = browserLoginResult.storageState;
    const browserClassification = classifyLoginResponse(browserLoginResult.html, {
      hasSidebar: browserLoginResult.hasSidebar,
      finalUrl: browserLoginResult.finalUrl,
      httpStatus: browserLoginResult.httpStatus,
    });
    observedUpstreamState = true;
    trace.recordStage({
      stage: "browser_submit",
      startedAt: browserStartedAt,
      classifier: browserClassification.classifier,
      httpStatus: browserLoginResult.httpStatus,
      finalUrl: browserLoginResult.finalUrl,
      storageStateBefore: storageState,
      storageStateAfter: browserLoginResult.storageState,
      artifactPayload:
        browserClassification.classifier === "authenticated_shell"
          ? null
          : {
              html: browserLoginResult.html,
              finalUrl: browserLoginResult.finalUrl,
              submissionMeta: browserLoginResult.submissionMeta,
            },
    });

    if (browserClassification.failureCode) {
      trace.finish({
        outcome: "failure",
        statusCode: browserClassification.status,
        errorCode: browserClassification.failureCode,
        classifier: browserClassification.classifier,
      });
      return buildFailureResult({
        storageState: latestStorageState,
        loginAttemptId,
        classifier: browserClassification.classifier,
        failureCode: browserClassification.failureCode,
        status: browserClassification.status,
        message: browserClassification.message,
      });
    }

    if (browserClassification.authenticated) {
      const loginResult = await finalizeAuthenticatedLogin({
        storageState: browserLoginResult.storageState,
        username,
        finalUrl: browserLoginResult.finalUrl,
        loginAttemptId,
        trace,
        probeProfileFn: deps.probeProfileFn,
      });
      trace.finish({
        outcome: "success",
        statusCode: 200,
        profileStatus: loginResult.profileStatus,
        classifier: browserClassification.classifier,
      });
      return loginResult;
    }

    const verifyStartedAt = Date.now();
    const browserVerification = await deps.verifyAuthenticatedShellFn(browserLoginResult.storageState);
    latestStorageState = browserVerification.storageState || latestStorageState;
    observedUpstreamState = true;
    trace.recordStage({
      stage: "auth_verification",
      startedAt: verifyStartedAt,
      classifier: browserVerification.classifier,
      httpStatus: browserVerification.httpStatus,
      finalUrl: browserVerification.finalUrl,
      storageStateBefore: browserLoginResult.storageState,
      storageStateAfter: latestStorageState,
      artifactPayload:
        browserVerification.authenticated
          ? null
          : {
              html: browserVerification.html || "",
              finalUrl: browserVerification.finalUrl,
              httpStatus: browserVerification.httpStatus,
            },
    });

    if (browserVerification.authenticated) {
      const loginResult = await finalizeAuthenticatedLogin({
        storageState: latestStorageState,
        username,
        finalUrl: browserVerification.finalUrl,
        loginAttemptId,
        trace,
        probeProfileFn: deps.probeProfileFn,
      });
      trace.finish({
        outcome: "success",
        statusCode: 200,
        profileStatus: loginResult.profileStatus,
        classifier: browserVerification.classifier,
      });
      return loginResult;
    }

    attempts.push(`browser submit could not verify auth (${browserVerification.classifier})`);
  } catch (error) {
    attempts.push(`browser submit failed: ${error.message || "Unknown browser submit error"}`);
  }

  const combined = makeAuthError(
    observedUpstreamState ? "LOGIN_VERIFICATION_FAILED" : "UPSTREAM_UNAVAILABLE",
    observedUpstreamState
      ? "Unable to verify ERP login. Please refresh captcha and try again."
      : "ERP login is temporarily unavailable. Please try again.",
    502,
    {
      loginAttemptId,
      attempts,
    }
  );
  trace.finish({
    outcome: "failure",
    statusCode: combined.status,
    errorCode: combined.code,
    classifier: observedUpstreamState ? "unknown_upstream_state" : "upstream_unavailable",
  });
  throw combined;
}

module.exports = {
  buildFailureResult,
  finalizeAuthenticatedLogin,
  loginWithCaptcha,
};
