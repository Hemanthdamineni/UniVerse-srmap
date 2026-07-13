const test = require("node:test");
const assert = require("node:assert/strict");

const { createScrapeRoutes } = require("../src/routes/scrapeRoutes");

function getSessionExpiredError() {
  const error = new Error("ERP session expired. Please sign in again.");
  error.status = 401;
  error.code = "SESSION_EXPIRED";
  return error;
}

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
    clearCookie(name, options = {}) {
      this.setHeader(
        "Set-Cookie",
        `${name}=; Max-Age=0; Path=${options.path || "/"}`
      );
      return this;
    },
  };
}

test("scrape route clears auth cookie when ERP session expires", async () => {
  const router = createScrapeRoutes({
    erpAggregationService: {
      async getPage() {
        throw getSessionExpiredError();
      },
    },
    erpLiveService: null,
  });

  const handler = findRouteHandler(router, "/scrape/:pageKey");
  const req = createMockRequest({
    params: { pageKey: "dashboard" },
    headers: {
      cookie: "erp_session=test-session",
    },
  });
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 401);
  assert.match(String(res.getHeader("set-cookie") || ""), /erp_session=; Max-Age=0; Path=\//i);
  assert.equal(res.body?.error?.code, "SESSION_EXPIRED");
});

test("profile route clears auth cookie when ERP profile refresh sees session expiry", async () => {
  const erpClient = require("../src/services/erp/erpClient");
  const originalCreateApiContext = erpClient.createApiContext;
  const originalFetchProfileViaApi = erpClient.fetchProfileViaApi;

  erpClient.createApiContext = async () => ({
    async storageState() {
      return {};
    },
    async dispose() {},
  });
  erpClient.fetchProfileViaApi = async () => {
    throw getSessionExpiredError();
  };

  delete require.cache[require.resolve("../src/routes/authRoutes")];

  try {
    const { createAuthRoutes } = require("../src/routes/authRoutes");
    const router = createAuthRoutes({
      sessionStore: {
        async getOrThrow() {
          return {
            storageState: {},
            profileData: null,
            username: "student",
          };
        },
      },
    });

    const handler = findRouteHandler(router, "/profile");
    const req = createMockRequest({
      query: { sessionId: "test-session" },
      headers: {
        cookie: "erp_session=test-session",
      },
    });
    const res = createMockResponse();

    await handler(req, res);

    assert.equal(res.statusCode, 401);
    assert.match(String(res.getHeader("set-cookie") || ""), /erp_session=; Max-Age=0; Path=\//i);
    assert.equal(res.body?.error?.code, "SESSION_EXPIRED");
  } finally {
    erpClient.createApiContext = originalCreateApiContext;
    erpClient.fetchProfileViaApi = originalFetchProfileViaApi;
    delete require.cache[require.resolve("../src/routes/authRoutes")];
  }
});
