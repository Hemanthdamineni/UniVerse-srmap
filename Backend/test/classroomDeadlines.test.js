const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

process.env.GOOGLE_CLIENT_ID = "cid";
process.env.GOOGLE_CLIENT_SECRET = "secret";
process.env.GOOGLE_OAUTH_REDIRECT = "https://erp.test/cb";
process.env.ADMIN_REGISTER_NUMBERS = "AP23110010419";

const oauth = require("../src/config/googleOAuth");
const { GoogleTokenStore } = require("../src/services/core/googleTokenStore");
const { ClassroomService, dueToIso } = require("../src/services/core/classroomService");
const { UnifiedDeadlineService, parseDdMmYyyy } = require("../src/services/core/unifiedDeadlineService");
const { createDeadlineRoutes } = require("../src/routes/deadlineRoutes");

function freshTokenStore() {
  return new GoogleTokenStore({
    dbPath: path.join(os.tmpdir(), `cls-${process.pid}-${Date.now()}-${Math.random()}.sqlite`),
  });
}

const CLASSROOM_SCOPE = "https://www.googleapis.com/auth/classroom.courses.readonly";

/** Mock Classroom REST. */
function mockClassroom() {
  const fetchImpl = async (url) => {
    if (url.includes("/courses?")) {
      return { ok: true, status: 200, json: async () => ({ courses: [{ id: "c1", name: "Compilers", alternateLink: "https://classroom.google.com/c/c1" }] }) };
    }
    if (url.includes("/courseWork?")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          courseWork: [
            { id: "w1", title: "Lab 3", state: "PUBLISHED", dueDate: { year: 2026, month: 10, day: 5 }, dueTime: { hours: 18, minutes: 0 }, alternateLink: "https://classroom.google.com/c/c1/a/w1" },
            { id: "w2", title: "Done already", state: "PUBLISHED", dueDate: { year: 2026, month: 9, day: 20 } },
          ],
        }),
      };
    }
    if (url.includes("/studentSubmissions")) {
      return { ok: true, status: 200, json: async () => ({ studentSubmissions: [{ courseWorkId: "w2", state: "TURNED_IN" }] }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  return { fetchImpl };
}

function connectWithScope(store, userId, scope) {
  store.save(userId, {
    accessToken: "acc",
    refreshToken: "ref",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    scope,
  });
}

/* ---------- scopes ---------- */

test("requestedScopes: calendar only by default, +classroom when enabled", () => {
  delete process.env.GOOGLE_CLASSROOM_ENABLED;
  assert.equal(oauth.requestedScopes().some((s) => s.includes("classroom")), false);
  process.env.GOOGLE_CLASSROOM_ENABLED = "1";
  assert.equal(oauth.requestedScopes().some((s) => s.includes("classroom")), true);
  assert.equal(oauth.isClassroomConfigured(), true);
  delete process.env.GOOGLE_CLASSROOM_ENABLED;
});

/* ---------- classroom service ---------- */

test("classroomService: unavailable without the flag, usable with flag + scope", () => {
  const store = freshTokenStore();
  const svc = new ClassroomService({ tokenStore: store });

  delete process.env.GOOGLE_CLASSROOM_ENABLED;
  assert.equal(svc.available(), false);

  process.env.GOOGLE_CLASSROOM_ENABLED = "1";
  assert.equal(svc.available(), true);
  assert.equal(svc.isUsable("u1"), false); // not connected

  connectWithScope(store, "u1", "https://www.googleapis.com/auth/calendar.events"); // calendar only
  assert.equal(svc.isUsable("u1"), false);
  assert.equal(svc.status("u1").needsReconnect, true);

  connectWithScope(store, "u1", `calendar.events ${CLASSROOM_SCOPE}`);
  assert.equal(svc.isUsable("u1"), true);
  assert.equal(svc.status("u1").connected, true);
  delete process.env.GOOGLE_CLASSROOM_ENABLED;
});

test("listCoursework normalizes, skips submitted work, and caches", async () => {
  process.env.GOOGLE_CLASSROOM_ENABLED = "1";
  const store = freshTokenStore();
  connectWithScope(store, "u1", `x ${CLASSROOM_SCOPE}`);
  let calls = 0;
  const { fetchImpl } = mockClassroom();
  const counting = async (...a) => { calls++; return fetchImpl(...a); };
  const svc = new ClassroomService({ tokenStore: store, fetchImpl: counting });

  const items = await svc.listCoursework("u1");
  assert.equal(items.length, 2); // list keeps everything; the timeline drops submitted
  const lab3 = items.find((i) => i.title === "Lab 3");
  assert.equal(lab3.course, "Compilers");
  assert.equal(lab3.source, "classroom");
  assert.equal(lab3.submitted, false);
  assert.equal(lab3.dueAt, "2026-10-05T18:00:00.000Z");
  assert.equal(items.find((i) => i.title === "Done already").submitted, true);

  const before = calls;
  await svc.listCoursework("u1"); // cached
  assert.equal(calls, before);
  delete process.env.GOOGLE_CLASSROOM_ENABLED;
});

test("dueToIso + parseDdMmYyyy", () => {
  assert.equal(dueToIso({ year: 2026, month: 3, day: 1 }, { hours: 9, minutes: 30 }), "2026-03-01T09:30:00.000Z");
  assert.equal(dueToIso(null), null);
  assert.equal(parseDdMmYyyy("05.10.2026"), "2026-10-05T23:59:00.000Z");
  assert.equal(parseDdMmYyyy("2026-10-05"), null);
});

/* ---------- unified timeline ---------- */

test("getTimeline merges sources, sorts, filters horizon/past, and dedupes", async () => {
  const soon = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const later = new Date(Date.now() + 10 * 86_400_000).toISOString();
  const past = new Date(Date.now() - 10 * 86_400_000).toISOString();
  const farFuture = new Date(Date.now() + 400 * 86_400_000).toISOString();

  const classroomService = {
    isUsable: () => true,
    listCoursework: async () => [
      { id: "cw:c1:w1", title: "Lab 3", course: "Compilers", dueAt: later, submitted: false, source: "classroom" },
      { id: "cw:c1:w9", title: "Old lab", dueAt: past, submitted: false, source: "classroom" },
    ],
  };
  const careerStore = {
    getBookmarkDeadlineReminderCandidates: () => [
      { userId: "u1", opportunityId: "o1", title: "Frontend Internship", deadline: soon },
      { userId: "u2", opportunityId: "o2", title: "Not mine", deadline: soon },
    ],
  };
  const eventsStore = {
    registrationsByUser: new Map([["u1", [{ eventId: "e1" }]]]),
    eventById: new Map([["e1", { id: "e1", title: "Hack Night", startAt: farFuture }]]),
  };

  const svc = new UnifiedDeadlineService({ classroomService, careerStore, eventsStore });
  const { items, sources } = await svc.getTimeline({ userId: "u1" }, { horizonDays: 60 });

  const ids = items.map((i) => i.id);
  assert.ok(ids.includes("opp:o1"));
  assert.ok(ids.includes("cw:c1:w1"));
  assert.ok(!ids.includes("cw:c1:w9")); // past dropped
  assert.ok(!ids.includes("event:e1")); // beyond 60-day horizon
  assert.ok(!ids.includes("opp:o2")); // other user
  // sorted ascending
  const times = items.map((i) => Date.parse(i.dueAt));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.equal(sources.opportunities, "ok");
  assert.equal(sources.classroom, "ok");
});

test("getTimeline works with no collaborators (academic calendar only)", async () => {
  const svc = new UnifiedDeadlineService({});
  const res = await svc.getTimeline({ userId: "u1" }, { horizonDays: 365, includePast: true });
  assert.equal(res.sources.classroom, "unavailable");
  assert.ok(Array.isArray(res.items));
});

/* ---------- route ---------- */

function invokeRouter(router, { method = "GET", url, headers = {} }) {
  return new Promise((resolve, reject) => {
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const parsed = new URL(url, "http://localhost");
    const req = {
      method, url: `${parsed.pathname}${parsed.search}`, originalUrl: `${parsed.pathname}${parsed.search}`,
      baseUrl: "", path: parsed.pathname, headers: lower, body: {},
      query: Object.fromEntries(parsed.searchParams.entries()),
      header: (n) => lower[String(n).toLowerCase()] || "", get: (n) => lower[String(n).toLowerCase()] || "",
    };
    const res = {
      statusCode: 200, headers: {},
      setHeader(n, v) { this.headers[n.toLowerCase()] = v; },
      status(c) { this.statusCode = c; return this; },
      json(p) { resolve({ status: this.statusCode, body: p }); return this; },
      send(p) { resolve({ status: this.statusCode, body: p }); return this; },
    };
    router.handle(req, res, (err) => (err ? reject(err) : resolve({ status: res.statusCode, body: null })));
  });
}

test("GET /api/deadlines requires auth and returns the timeline", async () => {
  const svc = new UnifiedDeadlineService({
    careerStore: {
      getBookmarkDeadlineReminderCandidates: () => [
        { userId: "AP1", opportunityId: "o1", title: "X", deadline: new Date(Date.now() + 86_400_000).toISOString() },
      ],
    },
  });
  const router = createDeadlineRoutes({
    unifiedDeadlineService: svc,
    sessionStore: {
      async getOrThrow(id) {
        if (id !== "s1") throw new Error("no session");
        return { loggedIn: true, profileData: { TableContent: { "Register No.": "AP1", "Program / Section": "B.Tech CSE / A" } } };
      },
    },
    adminPassword: "x",
  });

  assert.equal((await invokeRouter(router, { url: "/deadlines" })).status, 401);

  const ok = await invokeRouter(router, { url: "/deadlines", headers: { cookie: "erp_session=s1" } });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.items.some((i) => i.id === "opp:o1"));
  assert.ok(ok.body.generatedAt);
});
