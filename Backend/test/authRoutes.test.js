const test = require("node:test");
const assert = require("node:assert/strict");

function findRouteHandler(router, path, method = "get") {
  const layer = router.stack.find(
    (entry) =>
      entry.route &&
      entry.route.path === path &&
      entry.route.methods &&
      entry.route.methods[method]
  );

  assert.ok(layer, `Expected route ${method.toUpperCase()} ${path} to exist`);
  return layer.route.stack[0].handle;
}

function createMockRequest({ params = {}, query = {}, body = {}, headers = {} } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value])
  );

  return {
    params,
    query,
    body,
    headers: normalizedHeaders,
    header(name) {
      return normalizedHeaders[String(name || "").toLowerCase()] || "";
    },
  };
}

function createMockResponse() {
  const headers = new Map();

  return {
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    status(code) {
      this.statusCode = Number(code);
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    cookie(name, value) {
      this.setHeader("Set-Cookie", `${name}=${value}`);
      return this;
    },
    clearCookie(name, options = {}) {
      this.setHeader(
        "Set-Cookie",
        `${name}=; Max-Age=0; Path=${options.path || "/"}`
      );
      return this;
    },
  };
}

test("captcha route returns pre-auth attempt metadata", async () => {
  const erpClient = require("../src/services/erp/erpClient");
  const originalFetchCaptcha = erpClient.fetchCaptcha;

  erpClient.fetchCaptcha = async () => ({
    captchaBase64: "data:image/png;base64,AAA",
    storageState: { cookies: [] },
    loginBootstrap: { formAction: "StudentLoginToPortal" },
    issuedAt: 1000,
    expiresInMs: 15000,
    expiresAt: "2026-04-04T07:00:15.000Z",
    loginAttemptId: "attempt-captcha",
  });

  delete require.cache[require.resolve("../src/routes/authRoutes")];

  try {
    const updates = [];
    const { createAuthRoutes } = require("../src/routes/authRoutes");
    const router = createAuthRoutes({
      sessionStore: {
        async create() {
          return "session-1";
        },
        async update(sessionId, payload) {
          updates.push({ sessionId, payload });
        },
      },
    });

    const handler = findRouteHandler(router, "/captcha");
    const req = createMockRequest();
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.loginAttemptId, "attempt-captcha");
    assert.equal(res.body?.issuedAt, 1000);
    assert.equal(res.body?.expiresInMs, 15000);
    assert.equal(updates[0].payload.preAuthAttempt.loginAttemptId, "attempt-captcha");
  } finally {
    erpClient.fetchCaptcha = originalFetchCaptcha;
    delete require.cache[require.resolve("../src/routes/authRoutes")];
  }
});

test("login route returns deferred profile success", async () => {
  const erpClient = require("../src/services/erp/erpClient");
  const originalLoginWithCaptcha = erpClient.loginWithCaptcha;

  erpClient.loginWithCaptcha = async () => ({
    success: true,
    storageState: { cookies: [{ name: "JSESSIONID" }] },
    profileStatus: "deferred",
    loginAttemptId: "attempt-login",
  });

  delete require.cache[require.resolve("../src/routes/authRoutes")];

  try {
    const updates = [];
    const { createAuthRoutes } = require("../src/routes/authRoutes");
    const router = createAuthRoutes({
      sessionStore: {
        async getOrThrow() {
          return {
            storageState: { cookies: [] },
            loginBootstrap: { formAction: "StudentLoginToPortal" },
            preAuthAttempt: {
              loginAttemptId: "attempt-login",
              issuedAt: Date.now(),
            },
            profileData: null,
            username: "",
          };
        },
        async create() {
          return "session-rotated";
        },
        async update(sessionId, payload) {
          updates.push({ sessionId, payload });
        },
        async delete() {},
      },
    });

    const handler = findRouteHandler(router, "/login", "post");
    const req = createMockRequest({
      body: {
        sessionId: "session-1",
        username: "student",
        password: "secret",
        captcha: "abc123",
      },
    });
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.profileStatus, "deferred");
    assert.equal(updates[0].payload.loggedIn, true);
    assert.equal(updates[0].payload.preAuthAttempt, null);
  } finally {
    erpClient.loginWithCaptcha = originalLoginWithCaptcha;
    delete require.cache[require.resolve("../src/routes/authRoutes")];
  }
});

test("login route preserves backend auth failure codes", async () => {
  const erpClient = require("../src/services/erp/erpClient");
  const originalLoginWithCaptcha = erpClient.loginWithCaptcha;

  erpClient.loginWithCaptcha = async () => ({
    success: false,
    storageState: { cookies: [] },
    loginAttemptId: "attempt-failure",
    failureCode: "INVALID_CAPTCHA",
    status: 401,
    message: "Invalid captcha. Please try again.",
  });

  delete require.cache[require.resolve("../src/routes/authRoutes")];

  try {
    const { createAuthRoutes } = require("../src/routes/authRoutes");
    const router = createAuthRoutes({
      sessionStore: {
        async getOrThrow() {
          return {
            storageState: { cookies: [] },
            loginBootstrap: { formAction: "StudentLoginToPortal" },
            preAuthAttempt: {
              loginAttemptId: "attempt-failure",
              issuedAt: Date.now(),
            },
          };
        },
        async update() {},
      },
    });

    const handler = findRouteHandler(router, "/login", "post");
    const req = createMockRequest({
      body: {
        sessionId: "session-1",
        username: "student",
        password: "secret",
        captcha: "wrong",
      },
    });
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body?.error?.code, "INVALID_CAPTCHA");
    assert.equal(res.body?.loginAttemptId, "attempt-failure");
  } finally {
    erpClient.loginWithCaptcha = originalLoginWithCaptcha;
    delete require.cache[require.resolve("../src/routes/authRoutes")];
  }
});

test("forgot-password initiate route returns OTP success", async () => {
  const erpClient = require("../src/services/erp/erpClient");
  const originalInitiatePasswordReset = erpClient.initiatePasswordReset;

  erpClient.initiatePasswordReset = async () => ({
    success: true,
    status: 200,
    message: "OTP sent successfully.",
    storageState: { cookies: [{ name: "JSESSIONID" }] },
    loginAttemptId: "forgot-attempt",
  });

  delete require.cache[require.resolve("../src/routes/authRoutes")];

  try {
    const updates = [];
    const { createAuthRoutes } = require("../src/routes/authRoutes");
    const router = createAuthRoutes({
      sessionStore: {
        async getOrThrow() {
          return {
            storageState: { cookies: [] },
            loginBootstrap: { formAction: "StudentLoginToPortal" },
            preAuthAttempt: {
              loginAttemptId: "forgot-attempt",
              issuedAt: Date.now(),
            },
          };
        },
        async update(sessionId, payload) {
          updates.push({ sessionId, payload });
        },
      },
    });

    const handler = findRouteHandler(router, "/forgot", "post");
    const req = createMockRequest({
      body: {
        type: "initiate",
        sessionId: "session-1",
        username: "ap24110000000",
        captcha: "ab12",
      },
    });
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.loginAttemptId, "forgot-attempt");
    assert.equal(updates[0].payload.storageState.cookies[0].name, "JSESSIONID");
  } finally {
    erpClient.initiatePasswordReset = originalInitiatePasswordReset;
    delete require.cache[require.resolve("../src/routes/authRoutes")];
  }
});

test("forgot-password change route preserves invalid-password errors", async () => {
  const erpClient = require("../src/services/erp/erpClient");
  const originalCompletePasswordReset = erpClient.completePasswordReset;

  erpClient.completePasswordReset = async () => {
    const error = new Error("Password must be at least 8 characters long.");
    error.status = 422;
    error.code = "INVALID_PASSWORD";
    throw error;
  };

  delete require.cache[require.resolve("../src/routes/authRoutes")];

  try {
    const { createAuthRoutes } = require("../src/routes/authRoutes");
    const router = createAuthRoutes({
      sessionStore: {
        async getOrThrow() {
          return {};
        },
        async update() {},
      },
    });

    const handler = findRouteHandler(router, "/forgot", "post");
    const req = createMockRequest({
      body: {
        type: "change",
        username: "ap24110000000",
        otp: "123456",
        newPassword: "short",
      },
    });
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 422);
    assert.equal(res.body?.error?.code, "INVALID_PASSWORD");
  } finally {
    erpClient.completePasswordReset = originalCompletePasswordReset;
    delete require.cache[require.resolve("../src/routes/authRoutes")];
  }
});

test("heartbeat extends the local session and skips upstream probes when fresh", async () => {
  const erpClient = require("../src/services/erp/erpClient");
  const originalProbe = erpClient.verifyAuthenticatedShellFromStorageState;
  let probeCalls = 0;
  erpClient.verifyAuthenticatedShellFromStorageState = async () => {
    probeCalls += 1;
    return { authenticated: true, storageState: { cookies: [] } };
  };

  delete require.cache[require.resolve("../src/routes/authRoutes")];

  try {
    const updates = [];
    const { createAuthRoutes } = require("../src/routes/authRoutes");
    const router = createAuthRoutes({
      sessionStore: {
        async getOrThrow() {
          return {
            loggedIn: true,
            storageState: { cookies: [] },
            lastUpstreamProbeAt: Date.now() - 1000,
            lastUpstreamAlive: true,
          };
        },
        async update(sessionId, payload) {
          updates.push({ sessionId, payload });
        },
      },
    });

    const handler = findRouteHandler(router, "/heartbeat");
    const req = createMockRequest({
      headers: { cookie: "erp_session=session-heartbeat" },
    });
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.alive, true);
    assert.equal(res.body?.probed, false);
    assert.equal(probeCalls, 0);
    assert.ok(Number(updates[0]?.payload?.lastHeartbeatAt) > 0);
  } finally {
    erpClient.verifyAuthenticatedShellFromStorageState = originalProbe;
    delete require.cache[require.resolve("../src/routes/authRoutes")];
  }
});

test("heartbeat probes upstream after the probe interval and reports dead sessions", async () => {
  const erpClient = require("../src/services/erp/erpClient");
  const originalProbe = erpClient.verifyAuthenticatedShellFromStorageState;
  let probeCalls = 0;
  erpClient.verifyAuthenticatedShellFromStorageState = async (storageState) => {
    probeCalls += 1;
    assert.ok(storageState, "probe receives the session storage state");
    return { authenticated: false, storageState };
  };

  delete require.cache[require.resolve("../src/routes/authRoutes")];

  try {
    const updates = [];
    const { createAuthRoutes } = require("../src/routes/authRoutes");
    const router = createAuthRoutes({
      sessionStore: {
        async getOrThrow() {
          return {
            loggedIn: true,
            storageState: { cookies: [{ name: "JSESSIONID" }] },
            lastUpstreamProbeAt: Date.now() - 10 * 60 * 1000,
            lastUpstreamAlive: true,
          };
        },
        async update(sessionId, payload) {
          updates.push({ sessionId, payload });
        },
      },
    });

    const handler = findRouteHandler(router, "/heartbeat");
    const req = createMockRequest({
      headers: { cookie: "erp_session=session-heartbeat" },
    });
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.alive, false);
    assert.equal(res.body?.probed, true);
    assert.equal(probeCalls, 1);
    assert.equal(updates[0]?.payload?.lastUpstreamAlive, false);
  } finally {
    erpClient.verifyAuthenticatedShellFromStorageState = originalProbe;
    delete require.cache[require.resolve("../src/routes/authRoutes")];
  }
});

test("heartbeat rejects sessions that are not logged in", async () => {
  delete require.cache[require.resolve("../src/routes/authRoutes")];

  try {
    const { createAuthRoutes } = require("../src/routes/authRoutes");
    const router = createAuthRoutes({
      sessionStore: {
        async getOrThrow() {
          return { loggedIn: false, storageState: null };
        },
        async update() {},
      },
    });

    const handler = findRouteHandler(router, "/auth/heartbeat");
    const req = createMockRequest();
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.equal(res.body?.error?.code, "UNAUTHORIZED");
  } finally {
    delete require.cache[require.resolve("../src/routes/authRoutes")];
  }
});

test("login route answers with LOGIN_TIMEOUT once the deadline elapses", async () => {
  const erpClient = require("../src/services/erp/erpClient");
  const originalLoginWithCaptcha = erpClient.loginWithCaptcha;
  erpClient.loginWithCaptcha = () => new Promise(() => {});

  delete require.cache[require.resolve("../src/config/env")];
  delete require.cache[require.resolve("../src/routes/authRoutes")];
  const previousDeadline = process.env.LOGIN_DEADLINE_MS;
  process.env.LOGIN_DEADLINE_MS = "80";

  try {
    const { createAuthRoutes } = require("../src/routes/authRoutes");
    const router = createAuthRoutes({
      sessionStore: {
        async getOrThrow() {
          return {
            storageState: { cookies: [] },
            preAuthAttempt: {
              loginAttemptId: "attempt-timeout",
              issuedAt: Date.now(),
            },
          };
        },
        async update() {},
      },
    });

    const handler = findRouteHandler(router, "/login", "post");
    const req = createMockRequest({
      body: {
        sessionId: "session-1",
        username: "student",
        password: "secret",
        captcha: "abc123",
      },
    });
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 504);
    assert.equal(res.body?.error?.code, "LOGIN_TIMEOUT");
  } finally {
    if (previousDeadline === undefined) delete process.env.LOGIN_DEADLINE_MS;
    else process.env.LOGIN_DEADLINE_MS = previousDeadline;
    erpClient.loginWithCaptcha = originalLoginWithCaptcha;
    delete require.cache[require.resolve("../src/config/env")];
    delete require.cache[require.resolve("../src/routes/authRoutes")];
  }
});
