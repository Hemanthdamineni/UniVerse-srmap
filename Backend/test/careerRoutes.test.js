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
