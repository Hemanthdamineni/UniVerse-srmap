const test = require("node:test");
const assert = require("node:assert/strict");

const { createScrapeRoutes } = require("../src/routes/scrapeRoutes");

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

function createMockRequest({ params = {}, query = {}, headers = {} } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value])
  );

  return {
    params,
    query,
    body: {},
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
      this.setHeader("Set-Cookie", `${name}=; Max-Age=0; Path=${options.path || "/"}`);
      return this;
    },
  };
}

test("semester marks route goes through the aggregation cache layer", async () => {
  const getPageCalls = [];
  const router = createScrapeRoutes({
    erpAggregationService: {
      async getPage(args) {
        getPageCalls.push(args);
        return {
          source: "cache-fresh",
          policyMode: "cached-first",
          data: { records: [{ course: "CS301" }] },
        };
      },
    },
    erpLiveService: null,
  });

  const handler = findRouteHandler(
    router,
    "/scrape/examination/earlier-internal-marks/semester/:semester"
  );
  const res = createMockResponse();

  await handler(
    createMockRequest({
      params: { semester: "3" },
      query: {},
      headers: { cookie: "erp_session=test-session" },
    }),
    res
  );

  assert.equal(res.statusCode, 200);
  assert.equal(getPageCalls.length, 1);
  assert.equal(getPageCalls[0].pageKey, "examination/earlier-internal-marks/semester/3");
  assert.equal(getPageCalls[0].sessionId, "test-session");
  // Response body stays identical to the old live-only endpoint shape.
  assert.deepEqual(res.body, { records: [{ course: "CS301" }] });
});

test("semester marks route rejects non-positive semester numbers with 400", async () => {
  const router = createScrapeRoutes({
    erpAggregationService: {
      async getPage() {
        throw new Error("getPage must not be called for an invalid semester");
      },
    },
    erpLiveService: null,
  });

  const handler = findRouteHandler(
    router,
    "/scrape/examination/earlier-internal-marks/semester/:semester"
  );
  const res = createMockResponse();

  await handler(createMockRequest({ params: { semester: "0" }, query: {} }), res);

  assert.equal(res.statusCode, 400);
});
