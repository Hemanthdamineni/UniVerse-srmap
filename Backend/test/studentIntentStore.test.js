const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

process.env.ADMIN_REGISTER_NUMBERS = "AP23110010419";

const { StudentIntentStore, emptyIntent } = require("../src/services/core/studentIntentStore");
const { StudentGraphService } = require("../src/services/core/studentGraphService");
const { createStudentGraphRoutes, buildProvenance } = require("../src/routes/studentGraphRoutes");

function freshStore() {
  return new StudentIntentStore({
    dbPath: path.join(os.tmpdir(), `student-intent-${process.pid}-${Date.now()}-${Math.random()}.sqlite`),
  });
}

const USER = { userId: "AP23110010001", name: "Intent Student", branch: "CSE", year: 3 };

/* ---------- store ---------- */

test("get() returns a fully-shaped empty row for an unknown student", () => {
  const store = freshStore();
  const intent = store.get(USER);
  assert.deepEqual(intent, emptyIntent("AP23110010001"));
  assert.equal(intent.status, "none");
  assert.deepEqual(intent.consent, { derivedSignals: false, leaderboards: false, publicProfile: false });
});

test("update() merge-writes, cleans lists, and moves status to complete", () => {
  const store = freshStore();
  const saved = store.update(USER, {
    targetRoles: ["  Backend Engineer ", "backend engineer", "", "Data Scientist"],
    interestAreas: ["Systems"],
    graduationYear: String(new Date().getFullYear() + 1),
    placementIntent: "PLACEMENT",
    consent: { derivedSignals: true },
  });

  assert.deepEqual(saved.targetRoles, ["Backend Engineer", "Data Scientist"]); // dedup + trim + drop blank
  assert.equal(saved.interestAreas.length, 1);
  assert.equal(saved.graduationYear, new Date().getFullYear() + 1);
  assert.equal(saved.placementIntent, "placement");
  assert.equal(saved.consent.derivedSignals, true);
  assert.equal(saved.consent.leaderboards, false);
  assert.equal(saved.status, "complete");
  assert.ok(saved.onboardedAt);

  // partial update leaves untouched fields
  const again = store.update(USER, { interestAreas: ["Systems", "ML"] });
  assert.deepEqual(again.targetRoles, ["Backend Engineer", "Data Scientist"]);
  assert.deepEqual(again.interestAreas, ["Systems", "ML"]);
});

test("skip leaves a usable 'skipped' row, not an empty one (T3.2.3)", () => {
  const store = freshStore();
  const saved = store.update(USER, { skipped: true });
  assert.equal(saved.status, "skipped");
  assert.ok(saved.onboardedAt);
  // a later real save promotes it
  const promoted = store.update(USER, { targetRoles: ["SRE"] });
  assert.equal(promoted.status, "complete");
});

test("invalid graduation year and placement intent are rejected, not stored raw", () => {
  const store = freshStore();
  const saved = store.update(USER, { graduationYear: "1990", placementIntent: "world domination" });
  assert.equal(saved.graduationYear, null);
  assert.equal(saved.placementIntent, "");
});

test("clear() forgets everything (T3.3.3)", () => {
  const store = freshStore();
  store.update(USER, { targetRoles: ["SRE"], consent: { leaderboards: true } });
  const cleared = store.clear(USER);
  assert.equal(cleared.status, "none");
  assert.deepEqual(store.get(USER), emptyIntent("AP23110010001"));
});

test("list fields are capped", () => {
  const store = freshStore();
  const many = Array.from({ length: 40 }, (_, i) => `role-${i}`);
  const saved = store.update(USER, { targetRoles: many });
  assert.ok(saved.targetRoles.length <= 12);
});

test("store requires an authenticated user", () => {
  const store = freshStore();
  assert.throws(() => store.get({}), { status: 401 });
  assert.throws(() => store.update(null, {}), { status: 401 });
});

/* ---------- graph integration ---------- */

function fakeUnifiedProfileStore() {
  return {
    buildUnifiedProfile: () => ({
      user: { userId: USER.userId },
      skills: [{ skill: "Python", source: "resume", confidence: 0.9 }],
      achievements: [],
      events: { registeredCount: 0, organizedCount: 0 },
      lms: {},
      career: { completeness: 0, skillGaps: [] },
    }),
  };
}

test("graph folds declared intent skills + surfaces intent/consent", () => {
  const intentStore = freshStore();
  intentStore.update(USER, {
    targetRoles: ["ML Engineer"],
    skills: ["PyTorch", "python"], // python already known (case-insensitive) -> not duplicated
    consent: { derivedSignals: true },
  });

  const svc = new StudentGraphService({
    unifiedProfileStore: fakeUnifiedProfileStore(),
    studentIntentStore: intentStore,
  });
  const g = svc.getGraph(USER);

  assert.equal(g.intent.status, "complete");
  assert.deepEqual(g.intent.targetRoles, ["ML Engineer"]);
  assert.equal(g.consent.derivedSignals, true);

  const skillNames = g.skills.map((s) => s.skill.toLowerCase());
  assert.ok(skillNames.includes("pytorch"));
  assert.equal(skillNames.filter((s) => s === "python").length, 1);
  const pytorch = g.skills.find((s) => s.skill === "PyTorch");
  assert.equal(pytorch.source, "declared");
});

test("graph without an intent store still builds (B4-only deployments)", () => {
  const svc = new StudentGraphService({ unifiedProfileStore: fakeUnifiedProfileStore() });
  const g = svc.getGraph(USER);
  assert.equal(g.intent.status, "none");
  assert.deepEqual(g.consent, { derivedSignals: false, leaderboards: false, publicProfile: false });
});

test("buildProvenance lists identity, skills, derived, and declared rows with sources", () => {
  const intentStore = freshStore();
  intentStore.update(USER, { targetRoles: ["ML Engineer"], graduationYear: new Date().getFullYear() + 1 });
  const svc = new StudentGraphService({
    unifiedProfileStore: fakeUnifiedProfileStore(),
    studentIntentStore: intentStore,
  });

  const prov = buildProvenance(svc.getGraph(USER));
  assert.ok(Array.isArray(prov.rows));
  assert.ok(prov.rows.some((r) => r.category === "Skills" && r.label === "Python"));
  assert.ok(prov.rows.some((r) => r.category === "You told us" && r.label === "Target roles"));
  assert.ok(prov.rows.some((r) => r.category === "Derived" && /readiness/i.test(r.label)));
  for (const row of prov.rows) assert.ok(row.source, `row "${row.label}" has a source`);
});

/* ---------- routes ---------- */

function invokeRouter(router, { method = "GET", url, headers = {}, body = {} }) {
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
      body,
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

function sessionStoreWith(profileData) {
  const sessions = { s1: { loggedIn: true, profileData } };
  return {
    async getOrThrow(id) {
      if (!sessions[id]) throw new Error("missing session");
      return sessions[id];
    },
    async update() {},
  };
}

test("routes: PUT intent → GET intent → GET provenance → DELETE derived", async () => {
  const intentStore = freshStore();
  const svc = new StudentGraphService({
    unifiedProfileStore: fakeUnifiedProfileStore(),
    studentIntentStore: intentStore,
  });
  const router = createStudentGraphRoutes({
    studentGraphService: svc,
    studentIntentStore: intentStore,
    sessionStore: sessionStoreWith({
      TableContent: {
        "Register No.": "AP23110010001",
        "Student Name": "Route Student",
        "Program / Section": "B.Tech Computer Science and Engineering / A",
      },
    }),
    adminPassword: "x",
  });
  const auth = { cookie: "erp_session=s1" };

  const anon = await invokeRouter(router, { method: "PUT", url: "/student-graph/intent", body: {} });
  assert.equal(anon.status, 401);

  const put = await invokeRouter(router, {
    method: "PUT",
    url: "/student-graph/intent",
    headers: auth,
    body: { targetRoles: ["SRE"], placementIntent: "placement", consent: { derivedSignals: true } },
  });
  assert.equal(put.status, 200);
  assert.equal(put.body.status, "complete");
  assert.deepEqual(put.body.targetRoles, ["SRE"]);

  const get = await invokeRouter(router, { url: "/student-graph/intent", headers: auth });
  assert.deepEqual(get.body.targetRoles, ["SRE"]);
  assert.equal(get.body.consent.derivedSignals, true);

  // the graph read reflects intent
  const graph = await invokeRouter(router, { url: "/student-graph", headers: auth });
  assert.deepEqual(graph.body.intent.targetRoles, ["SRE"]);

  const prov = await invokeRouter(router, { url: "/student-graph/provenance", headers: auth });
  assert.ok(prov.body.rows.some((r) => r.label === "Target roles"));

  const del = await invokeRouter(router, { method: "DELETE", url: "/student-graph/derived", headers: auth });
  assert.equal(del.status, 200);
  assert.equal(del.body.cleared, true);

  const after = await invokeRouter(router, { url: "/student-graph/intent", headers: auth });
  assert.equal(after.body.status, "none");
});
