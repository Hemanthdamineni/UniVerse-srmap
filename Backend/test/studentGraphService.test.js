const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ADMIN_REGISTER_NUMBERS = "AP23110010419";

const {
  StudentGraphService,
  SimpleTtlCache,
  CONTRACT_VERSION,
} = require("../src/services/core/studentGraphService");
const { createStudentGraphRoutes } = require("../src/routes/studentGraphRoutes");

/* ---------- fakes ---------- */

function fakeUnifiedProfileStore(profile) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    buildUnifiedProfile() {
      calls += 1;
      if (profile === "throw") throw new Error("no profile");
      return profile;
    },
  };
}

function fakeAttendanceStore(subjects) {
  return {
    history() {
      if (!subjects) return [];
      return [{ date: "2026-09-01", subjects }];
    },
  };
}

const RICH_PROFILE = {
  user: { userId: "AP23110010001", name: "Rich Student" },
  skills: [
    { skill: "Python", source: "resume", confidence: 0.9 },
    { skill: "React", source: "courses", confidence: 0.7 },
    { skill: "SQL", source: "manual" },
    { skill: "", source: "junk" }, // dropped
  ],
  achievements: [{ id: "a1" }, { id: "a2" }],
  events: { registeredCount: 4, organizedCount: 1 },
  lms: {
    progress: { completed: 6 },
    mastery: [{ topic: "dsa" }, { topic: "os" }],
    contributions: { resources: 2, guides: 1, roadmaps: 0 },
  },
  career: {
    completeness: 70,
    skillGaps: [
      { skill: "Docker", demand: 12 },
      "Kubernetes",
    ],
  },
};

const ATTENDANCE = [
  { subjectCode: "CSE101", subjectDescription: "DSA", attendancePercentage: "68", classesConducted: "40", present: "27" },
  { subjectCode: "CSE102", subjectDescription: "OS", attendancePercentage: "76", classesConducted: "40", present: "31" },
  { subjectCode: "MAT101", subjectDescription: "Maths", attendancePercentage: "92", classesConducted: "40", present: "37" },
];

/* ---------- unit tests ---------- */

test("assembles a full graph from rich inputs", () => {
  const svc = new StudentGraphService({
    unifiedProfileStore: fakeUnifiedProfileStore(RICH_PROFILE),
    attendanceSnapshotStore: fakeAttendanceStore(ATTENDANCE),
  });

  const g = svc.getGraph({ userId: "AP23110010001", name: "Rich Student", branch: "CSE", year: 3 });

  assert.equal(g.contractVersion, CONTRACT_VERSION);
  assert.equal(g.warm, false);
  assert.equal(g.identity.registerNo, "AP23110010001");
  assert.equal(g.identity.semester, 3);

  // skills: the blank one is dropped
  assert.deepEqual(g.skills.map((s) => s.skill), ["Python", "React", "SQL"]);

  // attendance: statuses + overall
  const dsa = g.academic.attendance.subjects.find((s) => s.code === "CSE101");
  assert.equal(dsa.status, "breach"); // 68 < 75
  const os = g.academic.attendance.subjects.find((s) => s.code === "CSE102");
  assert.equal(os.status, "borderline"); // 75 <= 76 < 78
  const mat = g.academic.attendance.subjects.find((s) => s.code === "MAT101");
  assert.equal(mat.status, "safe");
  assert.equal(g.academic.attendance.overallPct, Math.round(((68 + 76 + 92) / 3) * 10) / 10);

  // derived: at-risk + recover count, borderline, skill gaps, readiness
  assert.equal(g.derived.atRiskSubjects.length, 1);
  assert.equal(g.derived.atRiskSubjects[0].code, "CSE101");
  assert.ok(g.derived.atRiskSubjects[0].classesToRecover > 0);
  assert.equal(g.derived.borderlineSubjects[0].code, "CSE102");
  assert.deepEqual(g.derived.skillGaps.map((x) => x.skill).sort(), ["Docker", "Kubernetes"]);
  assert.ok(g.derived.readinessScore > 0 && g.derived.readinessScore <= 100);
  assert.ok(g.derived.readinessBreakdown.skills > 0);

  assert.equal(g.sources.attendance, "snapshot");
  assert.equal(g.sources.skills, "store");
  assert.equal(g.sources.curriculum, "unavailable"); // no erpReader wired
});

test("classesToRecover: consecutive attendance needed to reach 75%", () => {
  const svc = new StudentGraphService({ unifiedProfileStore: fakeUnifiedProfileStore(RICH_PROFILE) });
  // present 27 / conducted 40 = 67.5%. (0.75*40 - 27) / 0.25 = 12
  assert.equal(svc._classesToRecover(27, 40), 12);
  assert.equal(svc._classesToRecover(30, 40), 0); // already at 75
  assert.equal(svc._classesToRecover(null, 40), null);
});

test("handles a sparse student (no profile, no attendance) without throwing", () => {
  const svc = new StudentGraphService({
    unifiedProfileStore: fakeUnifiedProfileStore("throw"),
    attendanceSnapshotStore: fakeAttendanceStore(null),
  });

  const g = svc.getGraph({ userId: "AP23110099999", name: "New Student" });

  assert.equal(g.identity.registerNo, "AP23110099999");
  assert.deepEqual(g.skills, []);
  assert.equal(g.academic.attendance, null);
  assert.equal(g.academic.results, null);
  assert.deepEqual(g.derived.atRiskSubjects, []);
  assert.deepEqual(g.derived.skillGaps, []);
  assert.equal(g.derived.readinessScore, 0);
  assert.equal(g.sources.skills, "unavailable");
  assert.equal(g.sources.attendance, "unavailable");
});

test("caches warm reads and invalidate() forces a rebuild", () => {
  const ups = fakeUnifiedProfileStore(RICH_PROFILE);
  const svc = new StudentGraphService({ unifiedProfileStore: ups });
  const user = { userId: "AP23110010001", name: "Rich Student" };

  const first = svc.getGraph(user);
  assert.equal(first.warm, false);
  assert.equal(ups.calls, 1);

  const second = svc.getGraph(user);
  assert.equal(second.warm, true);
  assert.equal(ups.calls, 1); // served from cache

  svc.invalidate(user);
  const third = svc.getGraph(user);
  assert.equal(third.warm, false);
  assert.equal(ups.calls, 2);

  // recompute:true also bypasses
  svc.getGraph(user, { recompute: true });
  assert.equal(ups.calls, 3);
});

test("invalidate accepts a bare user id string", () => {
  const svc = new StudentGraphService({ unifiedProfileStore: fakeUnifiedProfileStore(RICH_PROFILE) });
  svc.getGraph({ userId: "AP1" });
  assert.equal(svc.invalidate("AP1"), true);
  assert.equal(svc.invalidate("nope"), false);
});

test("getGraph rejects an unauthenticated user", () => {
  const svc = new StudentGraphService({ unifiedProfileStore: fakeUnifiedProfileStore(RICH_PROFILE) });
  assert.throws(() => svc.getGraph({}), { status: 401 });
  assert.throws(() => svc.getGraph(null), { status: 401 });
});

test("pulls curriculum + results from an injected erpReader", () => {
  const svc = new StudentGraphService({
    unifiedProfileStore: fakeUnifiedProfileStore(RICH_PROFILE),
    erpReader: {
      getCurriculum: () => ({
        completedCredits: 90,
        subjects: [
          { code: "CSE101", name: "DSA", credit: "4", semester: "3" },
          { code: "CSE102", name: "OS", credit: "3", semester: "3" },
        ],
      }),
      getResults: () => ({
        cgpa: "8.4",
        stale: true,
        sgpaBySemester: [{ semester: "1", sgpa: "8.1" }, { semester: "2", sgpa: "8.6" }],
        currentSubjects: [{ code: "CSE101", grade: "A", result: "Pass" }],
      }),
    },
  });

  const g = svc.getGraph({ userId: "AP1" });
  assert.equal(g.academic.curriculum.totalCredits, 7);
  assert.equal(g.academic.curriculum.completedCredits, 90);
  assert.equal(g.sources.curriculum, "cache");
  assert.equal(g.academic.results.cgpa, 8.4);
  assert.equal(g.sources.results, "stale");
  assert.equal(g.academic.results.sgpaBySemester.length, 2);
  // readiness now blends attendance-less academic on CGPA alone
  assert.ok(g.derived.readinessBreakdown.academic > 0);
});

test("SimpleTtlCache expires entries", () => {
  const c = new SimpleTtlCache({ ttlMs: 5 });
  c.set("k", 1);
  assert.equal(c.get("k"), 1);
  const until = Date.now() + 15;
  while (Date.now() < until) { /* spin briefly */ }
  assert.equal(c.get("k"), null);
});

/* ---------- route tests ---------- */

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
  const sessions = { "s1": { loggedIn: true, profileData } };
  return {
    async getOrThrow(id) {
      if (!sessions[id]) throw new Error("missing session");
      return sessions[id];
    },
    async update() {},
  };
}

test("route: GET /student-graph requires auth, then serves + caches", async () => {
  const svc = new StudentGraphService({ unifiedProfileStore: fakeUnifiedProfileStore(RICH_PROFILE) });
  const router = createStudentGraphRoutes({
    studentGraphService: svc,
    sessionStore: sessionStoreWith({
      TableContent: {
        "Register No.": "AP23110010001",
        "Student Name": "Route Student",
        "Program / Section": "B.Tech Computer Science and Engineering / A",
      },
    }),
    adminPassword: "x",
  });

  const anon = await invokeRouter(router, { url: "/student-graph" });
  assert.equal(anon.status, 401);

  const first = await invokeRouter(router, {
    url: "/student-graph",
    headers: { cookie: "erp_session=s1" },
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.contractVersion, CONTRACT_VERSION);
  assert.equal(first.body.warm, false);
  assert.equal(first.body.identity.registerNo, "AP23110010001");

  const second = await invokeRouter(router, {
    url: "/student-graph",
    headers: { cookie: "erp_session=s1" },
  });
  assert.equal(second.body.warm, true);

  const recomputed = await invokeRouter(router, {
    method: "POST",
    url: "/student-graph/recompute",
    headers: { cookie: "erp_session=s1" },
  });
  assert.equal(recomputed.status, 200);
  assert.equal(recomputed.body.warm, false);
});
