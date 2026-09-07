const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

process.env.ADMIN_REGISTER_NUMBERS = "AP23110010419";

const { CompanionAnalyticsStore } = require("../src/services/career/careerServices");
const { createCompanionAnalyticsRoutes } = require("../src/routes/companionAnalyticsRoutes");

function createStore() {
  return new CompanionAnalyticsStore({
    dbPath: path.join(os.tmpdir(), `companion-analytics-${process.pid}-${Date.now()}-${Math.random()}.sqlite`),
  });
}

function createSessionStore() {
  const sessions = {
    "session-1": {
      loggedIn: true,
      profileData: {
        TableContent: {
          "Register No.": "AP23110010001",
          "Student Name": "Student One",
          "Student E-Mail": "student@example.edu",
          "Program / Section": "B.Tech Computer Science and Engineering / A",
        },
      },
    },
    "admin-session": {
      loggedIn: true,
      adminElevated: true,
      profileData: {
        TableContent: {
          "Register No.": "AP23110010419",
          "Student Name": "Admin User",
          "Student E-Mail": "admin@example.edu",
          "Program / Section": "Admin",
        },
      },
    },
  };
  return {
    async getOrThrow(sessionId) {
      const session = sessions[sessionId];
      if (!session) throw new Error("missing session");
      return session;
    },
    async update(sessionId, data) {
      if (sessions[sessionId]) {
        Object.assign(sessions[sessionId], data);
      }
    },
  };
}

function invokeRouter(router, { method = "GET", url, headers = {}, body = {} }) {
  return new Promise((resolve, reject) => {
    const normalizedHeaders = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
    );
    const parsed = new URL(url, "http://localhost");
    const req = {
      method,
      url: `${parsed.pathname}${parsed.search}`,
      originalUrl: `${parsed.pathname}${parsed.search}`,
      baseUrl: "",
      path: parsed.pathname,
      headers: normalizedHeaders,
      body,
      query: Object.fromEntries(parsed.searchParams.entries()),
      header(name) {
        return normalizedHeaders[String(name).toLowerCase()] || "";
      },
      get(name) {
        return normalizedHeaders[String(name).toLowerCase()] || "";
      },
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };

    router.handle(req, res, (error) => {
      if (error) reject(error);
      else resolve({ status: res.statusCode, body: null });
    });
  });
}

test("CompanionAnalyticsStore records events and reports adoption and recommendation CTR", () => {
  const store = createStore();
  store.recordEvent(
    {
      event: "events_recommendations_viewed",
      route: "/events",
      properties: { count: 2 },
    },
    { userId: "student-1", role: "student", sessionId: "session-1" }
  );
  store.recordEvent(
    {
      event: "events_recommendation_clicked",
      route: "/events",
      properties: { eventId: "event-1" },
    },
    { userId: "student-1", role: "student", sessionId: "session-1" }
  );
  store.recordEvent(
    {
      event: "resume_analyzed",
      route: "/career/me/profile",
      properties: { score: 82 },
    },
    { userId: "student-2", role: "student", sessionId: "session-2" }
  );

  const report = store.getReport({ days: 30, limit: 10 });
  assert.equal(report.contractVersion, "companion-analytics-report-v1");
  assert.equal(report.totals.totalEvents, 3);
  assert.equal(report.totals.activeActors, 2);
  assert.equal(report.recommendationCtr.impressions, 1);
  assert.equal(report.recommendationCtr.clicks, 1);
  assert.equal(report.recommendationCtr.rate, 1);
  assert.ok(report.byCategory.some((item) => item.category === "recommendation"));
  assert.ok(report.funnel.some((item) => item.eventName === "resume_analyzed"));
});

test("route_view feeds a page-view report and stays out of the product-event budget", () => {
  const store = createStore();

  // A heavy navigator: 200 route_views must not lock them out of product events.
  for (let i = 0; i < 200; i++) {
    store.recordEvent(
      { event: "route_view", route: i % 2 === 0 ? "/dashboard" : "/events" },
      { userId: "student-1", role: "student", sessionId: "session-1" }
    );
  }
  // Still allowed to record a real product event afterwards.
  assert.doesNotThrow(() =>
    store.recordEvent({ event: "submission_started" }, { userId: "student-1", sessionId: "session-1" })
  );

  store.recordEvent(
    { event: "route_view", route: "/dashboard" },
    { userId: "student-2", role: "student", sessionId: "session-2" }
  );

  const report = store.getReport({ days: 30, limit: 50 });
  assert.equal(report.pageViews.totalViews, 201);
  assert.equal(report.pageViews.distinctRoutes, 2);
  const dashboard = report.pageViews.byRoute.find((r) => r.route === "/dashboard");
  assert.ok(dashboard, "dashboard route present in byRoute");
  assert.equal(dashboard.views, 101);
  assert.equal(dashboard.actors, 2);
  assert.ok(report.byCategory.some((item) => item.category === "navigation"));
});

test("Companion analytics routes collect events and protect reports behind admin access", async () => {
  const store = createStore();
  const router = createCompanionAnalyticsRoutes({
    analyticsStore: store,
    sessionStore: createSessionStore(),
    adminPassword: "test-admin",
  });

  const collected = await invokeRouter(router, {
    method: "POST",
    url: "/analytics/events",
    headers: { cookie: "erp_session=session-1" },
    body: {
      event: "lms_exam_prep_recommendations_viewed",
      route: "/resources",
      properties: { count: 3 },
    },
  });
  assert.equal(collected.status, 200);
  assert.equal(collected.body.recorded, true);

  const denied = await invokeRouter(router, {
    url: "/analytics/companion/report",
    headers: { cookie: "erp_session=session-1", "x-user-role": "student" },
  });
  assert.equal(denied.status, 403);

  const report = await invokeRouter(router, {
    url: "/analytics/companion/report?days=30",
    headers: { cookie: "erp_session=admin-session" },
  });
  assert.equal(report.status, 200);
  assert.equal(report.body.totals.totalEvents, 1);
  assert.equal(report.body.topEvents[0].eventName, "lms_exam_prep_recommendations_viewed");
});

test("CompanionAnalyticsStore requires an actor and bounds event schema, volume, and retention", () => {
  const store = createStore();
  assert.throws(() => store.recordEvent({ event: "submission_started" }, {}), { status: 401 });
  assert.throws(
    () => store.recordEvent({ event: "attacker_controlled_metric" }, { sessionId: "session-1" }),
    { status: 400 }
  );

  for (let index = 0; index < 120; index += 1) {
    store.recordEvent({ event: "submission_started" }, { sessionId: "session-1" });
  }
  assert.throws(
    () => store.recordEvent({ event: "submission_started" }, { sessionId: "session-1" }),
    { status: 429 }
  );

  store.db.prepare(
    `INSERT INTO companion_analytics_events
     (id, eventName, category, propertiesJson, occurredAt, receivedAt)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run("old-event", "submission_started", "events", "{}", "2020-01-01T00:00:00.000Z", "2020-01-01T00:00:00.000Z");
  store.recordEvent({ event: "submission_started" }, { userId: "fresh-user" });
  assert.equal(store.db.prepare("SELECT COUNT(*) AS count FROM companion_analytics_events WHERE id = ?").get("old-event").count, 0);
});
