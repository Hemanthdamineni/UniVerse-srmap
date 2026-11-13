const test = require("node:test");
const assert = require("node:assert/strict");

// Required for eventsAuth's admin-role resolution to recognize the mock
// register number as an allowlisted admin.
process.env.ADMIN_REGISTER_NUMBERS = process.env.ADMIN_REGISTER_NUMBERS || "AP123456";

function makeMockIntranetStore(overrides = {}) {
  return {
    getDashboardFeed: ({ limit = 15 } = {}) => ({ feed: [], limit }),
    listItems: (opts = {}) => ({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    getUpcomingEvents: (limit = 20) => [],
    getItem: () => null,
    getOperationalStatus: () => ({
      lastRun: null,
      lastSuccess: null,
      sources: [],
      itemCounts: {},
      totalActiveItems: 0,
      lastAuth: null,
    }),
    resetCircuitBreaker: () => {},
    ...overrides,
  };
}

function makeUserContextStore({ isAdmin = false } = {}) {
  return {
    async getOrThrow() {
      return {
        loggedIn: true,
        adminElevated: isAdmin,
        profileData: {
          TableContent: {
            "Register No.": "AP123456",
            "Program / Section": "B.Tech Computer Science and Engineering / A",
          },
        },
      };
    },
  };
}

function invokeRouter(router, { method = "GET", url, headers = {} }) {
  return new Promise((resolve, reject) => {
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const parsed = new URL(url, "http://localhost");
    const req = {
      method,
      url: `${parsed.pathname}${parsed.search}`,
      originalUrl: `${parsed.pathname}${parsed.search}`,
      baseUrl: "",
      path: parsed.pathname,
      headers: lower,
      body: {},
      query: Object.fromEntries(parsed.searchParams.entries()),
      header: (n) => lower[String(n).toLowerCase()] || "",
      get: (n) => lower[String(n).toLowerCase()] || "",
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(n, v) { this.headers[n.toLowerCase()] = v; },
      status(c) { this.statusCode = c; return this; },
      json(p) { resolve({ status: this.statusCode, body: p }); return this; },
      send(p) { resolve({ status: this.statusCode, body: p }); return this; },
    };
    router.handle(req, res, (err) => (err ? reject(err) : resolve({ status: res.statusCode, body: null })));
  });
}

function makeRouter(store = makeMockIntranetStore(), overrides = {}) {
  delete require.cache[require.resolve("../src/routes/intranetRoutes")];
  const { createIntranetRoutes } = require("../src/routes/intranetRoutes");
  return createIntranetRoutes({
    intranetStore: store,
    sessionStore: makeUserContextStore(),
    adminPassword: "test-admin",
    intranetScraperSupervisorStatus: () => ({ state: "running", pid: 123 }),
    intranetScraperTriggerOnce: () => ({ accepted: true, mode: "oneshot" }),
    ...overrides,
  });
}

test("intranet router exposes the full dashboard/feed surface", () => {
  const router = makeRouter();
  const paths = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  for (const p of [
    "/intranet/feed",
    "/intranet/announcements",
    "/intranet/events",
    "/intranet/news",
    "/intranet/academic",
    "/intranet/documents",
    "/intranet/items",
    "/intranet/items/:id",
    "/intranet/status",
    "/intranet/scraper/trigger",
    "/intranet/scraper/reset/:source",
  ]) {
    assert.ok(paths.includes(p), `missing route ${p}`);
  }
});

test("GET /intranet/feed requires authentication", async () => {
  delete require.cache[require.resolve("../src/routes/intranetRoutes")];
  const { createIntranetRoutes } = require("../src/routes/intranetRoutes");
  const router = createIntranetRoutes({
    intranetStore: makeMockIntranetStore(),
    sessionStore: {
      async getOrThrow() {
        throw new Error("no session");
      },
    },
    adminPassword: "test-admin",
  });
  const res = await invokeRouter(router, { url: "/intranet/feed", headers: { cookie: "erp_session=s1" } });
  assert.equal(res.status, 401);
});

test("GET /intranet/feed returns the dashboard feed", async () => {
  const items = [{ id: "f1", title: "Notice" }];
  const router = makeRouter(makeMockIntranetStore({ getDashboardFeed: ({ limit }) => items }));
  const res = await invokeRouter(router, { url: "/intranet/feed?limit=5", headers: { cookie: "erp_session=s1" } });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data, items);
});

test("GET /intranet/announcements passes filters to listItems", async () => {
  let captured = null;
  const store = makeMockIntranetStore({
    listItems: (opts) => {
      captured = opts;
      return { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    },
  });
  const router = makeRouter(store);
  await invokeRouter(router, { url: "/intranet/announcements?department=CSE&query=campus&limit=10", headers: { cookie: "erp_session=s1" } });
  assert.equal(captured.contentType, "announcement");
  assert.equal(captured.audience, "shared");
  assert.equal(captured.department, "CSE");
  assert.equal(captured.query, "campus");
  assert.equal(captured.orderBy, "published_at");
});

test("GET /intranet/events?upcoming=true routes to getUpcomingEvents", async () => {
  let called = false;
  const store = makeMockIntranetStore({ getUpcomingEvents: () => { called = true; return [{ id: "e1" }]; } });
  const router = makeRouter(store);
  const res = await invokeRouter(router, { url: "/intranet/events?upcoming=true", headers: { cookie: "erp_session=s1" } });
  assert.equal(called, true);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
});

test("GET /intranet/items/:id returns 404 for missing items", async () => {
  const router = makeRouter();
  const res = await invokeRouter(router, { url: "/intranet/items/nope", headers: { cookie: "erp_session=s1" } });
  assert.equal(res.status, 404);
});

test("GET /intranet/items/:id blocks non-shared audience", async () => {
  const store = makeMockIntranetStore({
    getItem: () => ({ id: "x", audience: "student_specific", title: "personal" }),
  });
  const router = makeRouter(store);
  const res = await invokeRouter(router, { url: "/intranet/items/x", headers: { cookie: "erp_session=s1" } });
  assert.equal(res.status, 403);
});

test("GET /intranet/items/:id returns shared item detail", async () => {
  const store = makeMockIntranetStore({
    getItem: () => ({ id: "x", audience: "shared", title: "Public", body: "Body" }),
  });
  const router = makeRouter(store);
  const res = await invokeRouter(router, { url: "/intranet/items/x", headers: { cookie: "erp_session=s1" } });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.title, "Public");
});

test("GET /intranet/status is admin-only and combines db + scraper status", async () => {
  const dbStatus = { totalActiveItems: 7 };
  const router = makeRouter(
    makeMockIntranetStore({ getOperationalStatus: () => dbStatus }),
    { sessionStore: makeUserContextStore({ isAdmin: true }) }
  );
  const res = await invokeRouter(router, { url: "/intranet/status", headers: { cookie: "erp_session=s1" } });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.db.totalActiveItems, 7);
  assert.equal(res.body.data.scraper.state, "running");
});

test("GET /intranet/status is rejected for non-admins", async () => {
  const router = makeRouter(makeMockIntranetStore(), { sessionStore: makeUserContextStore({ isAdmin: false }) });
  const res = await invokeRouter(router, { url: "/intranet/status", headers: { cookie: "erp_session=s1" } });
  assert.equal(res.status, 403);
});

test("POST /intranet/scraper/trigger invokes the triggerOnce hook (admin)", async () => {
  let triggered = false;
  const router = makeRouter(makeMockIntranetStore(), {
    sessionStore: makeUserContextStore({ isAdmin: true }),
    intranetScraperTriggerOnce: () => { triggered = true; return { accepted: true, mode: "oneshot" }; },
  });
  const res = await invokeRouter(router, { url: "/intranet/scraper/trigger", method: "POST", headers: { cookie: "erp_session=s1" } });
  assert.equal(triggered, true);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.accepted, true);
});

test("POST /intranet/scraper/trigger is 503 when trigger unavailable", async () => {
  const router = makeRouter(makeMockIntranetStore(), {
    sessionStore: makeUserContextStore({ isAdmin: true }),
    intranetScraperTriggerOnce: null,
  });
  const res = await invokeRouter(router, { url: "/intranet/scraper/trigger", method: "POST", headers: { cookie: "erp_session=s1" } });
  assert.equal(res.status, 503);
});

test("POST /intranet/scraper/reset/:source calls resetCircuitBreaker", async () => {
  let reset = null;
  const router = makeRouter(
    makeMockIntranetStore({ resetCircuitBreaker: (s) => { reset = s; } }),
    { sessionStore: makeUserContextStore({ isAdmin: true }) }
  );
  const res = await invokeRouter(router, { url: "/intranet/scraper/reset/announcements", method: "POST", headers: { cookie: "erp_session=s1" } });
  assert.equal(reset, "announcements");
  assert.equal(res.status, 200);
});