const test = require("node:test");
const assert = require("node:assert/strict");

const { createEventsRoutes } = require("../src/routes/eventsRoutes");

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
      setHeader(n, v) {
        this.headers[n.toLowerCase()] = v;
      },
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(p) {
        resolve({ status: this.statusCode, body: p });
        return this;
      },
      send(p) {
        resolve({ status: this.statusCode, body: p });
        return this;
      },
    };
    router.handle(req, res, (err) => (err ? reject(err) : resolve({ status: res.statusCode, body: null })));
  });
}

const sessionStore = {
  async getOrThrow() {
    return {
      loggedIn: true,
      profileData: {
        TableContent: {
          "Register No.": "AP1",
          "Program / Section": "B.Tech Computer Science and Engineering / A",
        },
      },
    };
  },
};

const UPCOMING = [
  {
    id: "weak",
    title: "Open Mic Evening",
    description: "Campus cultural evening.",
    category: "Cultural",
    department: "Student Union",
    tags: ["music"],
    startAt: new Date(Date.now() + 15 * 86_400_000).toISOString(),
    registrationDeadline: new Date(Date.now() + 12 * 86_400_000).toISOString(),
  },
  {
    id: "strong",
    title: "AI/ML Hackathon",
    description: "Build ML tools with Python and React.",
    category: "Technical",
    department: "Computer Science and Engineering",
    tags: ["React", "Python", "hackathon"],
    competitionConfig: { rounds: [] },
    startAt: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    registrationDeadline: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  },
];

function makeEventsStore() {
  return {
    listEvents: () => UPCOMING.map((e) => ({ ...e })),
    registrationsByUser: new Map(),
    eventById: new Map(),
  };
}

test("events router registers the /events collection route", () => {
  const router = createEventsRoutes({ eventsStore: makeEventsStore(), sessionStore, adminPassword: "x" });
  const paths = router.stack.filter((l) => l.route).map((l) => l.route.path);
  assert.ok(paths.includes("/events"));
});

test("GET /events?sort=fit ranks upcoming events against the student graph", async () => {
  const studentGraphService = {
    getGraph: () => ({
      skills: [{ skill: "Python" }, { skill: "React" }],
      identity: { branch: "CSE", program: "Computer Science and Engineering", semester: 6 },
      derived: { skillGaps: [{ skill: "Docker" }], atRiskSubjects: [] },
      intent: { targetRoles: ["ML Engineer"], interestAreas: ["Machine Learning"] },
    }),
  };

  const router = createEventsRoutes({
    eventsStore: makeEventsStore(),
    sessionStore,
    studentGraphService,
    adminPassword: "x",
  });

  const res = await invokeRouter(router, {
    url: "/events?sort=fit",
    headers: { cookie: "erp_session=s1" },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  const ids = res.body.data.map((e) => e.id);
  assert.deepEqual(ids, ["strong", "weak"]);
  assert.ok(res.body.data[0].fit.fitScore >= res.body.data[1].fit.fitScore);
  assert.ok(res.body.data[0].fit.whyThis.length > 0);
});

test("GET /events without the graph service falls back to the plain list", async () => {
  const router = createEventsRoutes({ eventsStore: makeEventsStore(), sessionStore, adminPassword: "x" });
  const res = await invokeRouter(router, {
    url: "/events?sort=fit",
    headers: { cookie: "erp_session=s1" },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.data.map((e) => e.id),
    ["weak", "strong"],
  );
  assert.ok(res.body.data.every((e) => e.fit === undefined));
});
