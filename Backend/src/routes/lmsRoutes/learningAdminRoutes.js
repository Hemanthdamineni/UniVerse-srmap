const { toSafeString } = require("../../services/lms/lmsUtils");
const academicCalendar = require("../../services/core/academicCalendar");

const WEEK_MS = 7 * 86_400_000;

function registerLearningAdminRoutes(
  router,
  {
    createHandle,
    lmsStore,
    recommendationEngine,
    featureFlagService,
    ensureAdmin,
    renderGuidePdf,
    studentGraphService = null,
  }
) {
  // Graph + calendar context for revision weighting (B7 / T4.5).
  function revisionContext(user) {
    const atRiskCodes = [];
    try {
      const graph = studentGraphService?.getGraph?.(user);
      for (const subject of graph?.derived?.atRiskSubjects || []) {
        if (subject?.code) atRiskCodes.push(toSafeString(subject.code).toUpperCase());
      }
    } catch {
      /* the graph is optional — fall back to the plain schedule */
    }
    let examWindows = [];
    try {
      examWindows = academicCalendar.listExamWindows({ now: Date.now() });
    } catch {
      examWindows = [];
    }
    return { atRiskCodes, examWindows };
  }

  // Chronological, but within each ~week bucket an at-risk subject floats up.
  function weightRevisionQueue(rows, atRiskCodes) {
    const codes = new Set(atRiskCodes);
    const now = Date.now();
    const bucket = (iso) => Math.floor(((Date.parse(iso) || now) - now) / WEEK_MS);
    return rows
      .map((row) => ({ ...row, atRisk: codes.has(toSafeString(row.subjectCode).toUpperCase()) }))
      .sort((a, b) => {
        const byBucket = bucket(a.dueDate) - bucket(b.dueDate);
        if (byBucket !== 0) return byBucket;
        if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
        return (Date.parse(a.dueDate) || 0) - (Date.parse(b.dueDate) || 0);
      });
  }
  router.get("/lms/recommendations/next-step", (req, res, next) =>
    createHandle(req, res, next, async () => {
      const resource = lmsStore.getResource(req.query.resourceId, req.userContext.userId, {
        includeHiddenOwn: true,
        isAdmin: req.userContext.hasAdminAccess,
      });
      const related = lmsStore.getResources(
        {
          subjectCode: resource.subjectCode,
          unit: resource.unitNormalized,
          sort: "quality",
          limit: 6,
          page: 1,
        },
        { userId: req.userContext.userId }
      ).items.filter((item) => item.id !== resource.id);
      return related.slice(0, 3);
    })
  );

  router.get("/lms/recommendations/exam-prep", (req, res, next) =>
    createHandle(req, res, next, async () =>
      recommendationEngine.getExamPrepRecommendations({
        userId: req.userContext.userId,
        user: req.userContext,
        filters: {
          subjectCode: req.query.subjectCode,
          type: req.query.type,
        },
        limit: req.query.limit,
      })
    )
  );

  router.get("/lms/recommendations/roadmaps", (req, res, next) =>
    createHandle(req, res, next, async () =>
      recommendationEngine.getRoadmapRecommendations({
        userId: req.userContext.userId,
        user: req.userContext,
        limit: req.query.limit,
      })
    )
  );

  router.get("/lms/recommendations", (req, res, next) =>
    createHandle(req, res, next, async () =>
      recommendationEngine.getRecommendations({
        userId: req.userContext.userId,
        user: req.userContext,
        filters: {
          subjectCode: req.query.subjectCode,
          type: req.query.type,
        },
        limit: req.query.limit,
      })
    )
  );

  router.get("/lms/explore", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getExplore(req.userContext.userId))
  );

  router.get("/lms/subjects/:code/overview", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getSubjectOverview(req.params.code, req.userContext.userId)
    )
  );

  router.get("/lms/subjects/:code/presence", (req, res, next) =>
    createHandle(req, res, next, async () => ({
      subjectCode: toSafeString(req.params.code).toUpperCase(),
      count: lmsStore.getCurrentlyStudyingCount(req.params.code),
    }))
  );

  router.get("/lms/topics/graph", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getTopicGraph(req.query.subjectCode))
  );

  router.get("/lms/leaderboard/weekly", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getWeeklyLeaderboard())
  );

  router.get("/lms/progress", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getProgressSummary(req.userContext.userId))
  );

  router.get("/lms/progress/:subjectCode", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getProgressForSubject(req.userContext.userId, req.params.subjectCode)
    )
  );

  router.get("/lms/mastery", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getMastery(req.userContext.userId))
  );

  router.get("/lms/continue", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getContinueLearning(req.userContext.userId))
  );

  router.get("/lms/revision", (req, res, next) =>
    createHandle(req, res, next, async () => {
      const { atRiskCodes } = revisionContext(req.userContext);
      return weightRevisionQueue(lmsStore.getRevisionQueue(req.userContext.userId), atRiskCodes);
    })
  );

  router.post("/lms/revision/:resourceId/review", (req, res, next) =>
    createHandle(req, res, next, async () => {
      const { atRiskCodes, examWindows } = revisionContext(req.userContext);
      return lmsStore.submitRevisionReview(req.userContext.userId, req.params.resourceId, req.body.score, {
        atRiskCodes,
        examWindows,
      });
    })
  );

  router.get("/lms/streak", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getStreak(req.userContext.userId))
  );

  router.post("/lms/session/generate", (req, res, next) =>
    createHandle(req, res, next, async () => {
      const { atRiskCodes } = revisionContext(req.userContext);
      return lmsStore.generateLearningSession(req.userContext.userId, req.body.durationMinutes, {
        atRiskCodes,
      });
    })
  );

  router.get("/lms/me/contributions", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getUserContributions(req.userContext.userId))
  );

  router.get("/lms/me/bookmarks", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getBookmarkedResources(req.userContext.userId))
  );

  router.get("/lms/me/activity", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getActivity(req.userContext.userId))
  );

  router.get("/lms/me/requests", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getUserRequests(req.userContext.userId))
  );

  router.put("/lms/me/preferences", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.updateUserPreferences(req.userContext.userId, req.body)
    )
  );

  router.get("/lms/contributors/:userId", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getContributorProfile(req.params.userId))
  );

  router.get("/lms/admin/resource-flags", ensureAdmin, (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getResourceModerationQueue({
        state: req.query.state,
        query: req.query.query,
        page: req.query.page,
        limit: req.query.limit,
      })
    )
  );

  router.patch("/lms/admin/resources/:id/moderation", ensureAdmin, (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.moderateResource(req.params.id, req.body || {}, {
        userId: req.userContext.userId,
      })
    )
  );

  router.get("/lms/admin/flags", ensureAdmin, (req, res, next) =>
    createHandle(req, res, next, async () => featureFlagService.listFlags())
  );

  router.put("/lms/admin/flags/:key", ensureAdmin, (req, res, next) =>
    createHandle(req, res, next, async () =>
      featureFlagService.setFlag({
        key: req.params.key,
        enabled: req.body.enabled,
        rolloutType: req.body.rolloutType,
        rolloutValue: req.body.rolloutValue,
        description: req.body.description,
        updatedBy: req.userContext.userId,
      })
    )
  );
}

module.exports = { registerLearningAdminRoutes };
