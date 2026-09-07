const test = require("node:test");
const assert = require("node:assert/strict");

function makeMockCareerStore() {
  return {
    getDeadlineSoonBookmarked: () => [],
    getOpportunities: () => [],
    getProfile: () => ({ skills: [], preferredTypes: [], preferredLocations: [] }),
    getOpportunity: () => null,
    getSimilarOpportunities: () => [],
    getSubmissionById: () => null,
    getTrendingOpportunities: () => [],
    bookmarkOpportunity: () => ({ bookmarked: true }),
    dismissOpportunity: () => ({ dismissed: true }),
    trackApply: () => ({ tracked: true }),
    flagOpportunity: () => ({ flagged: true }),
    trackView: () => ({ tracked: true }),
    getApplications: () => [],
    createApplication: () => ({ id: "a1", status: "applied" }),
    updateApplicationStatus: () => ({ updated: true }),
    deleteApplication: () => ({ deleted: true }),
    submitOpportunity: () => ({ id: "s1", status: "pending" }),
    getPendingSubmissions: () => [],
    approveSubmission: () => {},
    getScraperHealth: () => [],
    getScraperRuns: () => [],
    getCareerStats: () => ({
      byType: [],
      totalActive: 0,
      totalBookmarks: 0,
      totalApplications: 0,
    }),
    updateProfile: () => ({ updated: true }),
    getSkillGaps: () => [],
    updateResume: () => ({ updated: true }),
    listResumeVersions: () => [],
    createResumeVersion: () => ({ id: "rv1", qualityScore: 75 }),
    analyzeResumeVersion: () => ({ score: 75, rubric: [] }),
    mergeResumeToProfile: () => ({ updated: true }),
    getOpportunityFit: () => ({ fitScore: 80, reasons: [] }),
  };
}

test("career router exposes feed, deadline-soon, opportunities, profile, and stats routes", () => {
  delete require.cache[require.resolve("../src/routes/careerRoutes")];
  const { createCareerRoutes } = require("../src/routes/careerRoutes");
  const sessionStore = {
    async getOrThrow() {
      return { loggedIn: true, profileData: { TableContent: {} } };
    },
  };
  const router = createCareerRoutes({
    careerStore: makeMockCareerStore(),
    sessionStore,
    adminPassword: "test-admin",
    eventsStore: { pushCareerNotification: () => {} },
    redisClient: null,
  });
  const paths = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  for (const p of [
    "/career/feed",
    "/career/deadline-soon",
    "/career/opportunities",
    "/career/opportunities/:id",
    "/career/profile",
    "/career/resumes",
    "/career/resumes/:resumeVersionId/analysis",
    "/career/resumes/:resumeVersionId/merge-to-profile",
    "/career/resumes/:resumeVersionId/fit/:opportunityId",
    "/career/opportunities/:id/fit",
    "/career/stats",
    "/career/health",
    "/career/permissions",
    "/career/trending",
  ]) {
    assert.ok(paths.includes(p), `missing route ${p}`);
  }
});

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

test("GET /career/opportunities?sort=fit ranks against the student graph", async () => {
  delete require.cache[require.resolve("../src/routes/careerRoutes")];
  const { createCareerRoutes } = require("../src/routes/careerRoutes");

  const CANDIDATES = [
    { id: "weak", title: "Systems role", type: "job", skills: ["Rust"], eligibleBranches: ["CSE"], eligibleYears: [3], tags: [], minCGPA: 6 },
    { id: "ineligible", title: "Any role", type: "job", skills: ["Python"], eligibleBranches: ["MECH"], eligibleYears: [3], tags: [] },
    { id: "strong", title: "Data Scientist Internship", type: "internship", skills: ["Python", "SQL"], eligibleBranches: ["CSE"], eligibleYears: [3], tags: [], minCGPA: 7 },
  ];

  const careerStore = {
    ...makeMockCareerStore(),
    getOpportunities: () => CANDIDATES,
  };

  const studentGraphService = {
    getGraph: () => ({
      skills: [{ skill: "Python" }, { skill: "SQL" }, { skill: "React" }],
      identity: { branch: "CSE", semester: 6 },
      academic: { results: { cgpa: 8.2 } },
      intent: { targetRoles: ["Data Scientist"] },
    }),
  };

  const router = createCareerRoutes({
    careerStore,
    studentGraphService,
    sessionStore: { async getOrThrow() { return { loggedIn: true, profileData: { TableContent: { "Register No.": "AP1", "Program / Section": "B.Tech Computer Science and Engineering / A" } } }; } },
    adminPassword: "x",
  });

  const res = await invokeRouter(router, {
    url: "/career/opportunities?sort=fit&limit=10",
    headers: { cookie: "erp_session=s1" },
  });

  assert.equal(res.status, 200);
  const ids = res.body.items.map((o) => o.id);
  assert.deepEqual(ids, ["strong", "weak"]); // ineligible dropped, strong first
  assert.ok(res.body.items[0].fit.fitScore >= res.body.items[1].fit.fitScore);
  assert.ok(res.body.items[0].fit.whyThis.length > 0);
  assert.equal(res.body.rankedTotal, 2);
});
