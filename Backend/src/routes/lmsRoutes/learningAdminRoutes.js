const { toSafeString } = require("../../services/lmsUtils");

function registerLearningAdminRoutes(
  router,
  {
    createHandle,
    lmsStore,
    recommendationEngine,
    featureFlagService,
    ensureAdmin,
    renderGuidePdf,
  }
) {
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

  router.get("/lms/recommendations", (req, res, next) =>
    createHandle(req, res, next, async () =>
      recommendationEngine.getRecommendations({
        userId: req.userContext.userId,
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
    createHandle(req, res, next, async () => lmsStore.getRevisionQueue(req.userContext.userId))
  );

  router.post("/lms/revision/:resourceId/review", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.submitRevisionReview(req.userContext.userId, req.params.resourceId, req.body.score)
    )
  );

  router.get("/lms/streak", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getStreak(req.userContext.userId))
  );

  router.post("/lms/session/generate", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.generateLearningSession(req.userContext.userId, req.body.durationMinutes)
    )
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

  router.get("/lms/me/export/:guideId", async (req, res, next) => {
    try {
      const guide = await lmsStore.getGuide(req.params.guideId, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      });
      const pdf = await renderGuidePdf(guide);
      res.setHeader("content-type", "application/pdf");
      res.setHeader("content-disposition", `attachment; filename="${guide.title.replace(/[^a-z0-9]+/gi, "-")}.pdf"`);
      return res.send(pdf);
    } catch (error) {
      return next(error);
    }
  });

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
