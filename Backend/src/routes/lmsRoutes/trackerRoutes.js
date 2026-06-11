const { resolveSessionId } = require("../../utils/cookies");

function registerTrackerRoutes(router, { createHandle, lmsTrackerService }) {
  if (!lmsTrackerService) return;

  router.get("/lms/tracker/overview", (req, res, next) =>
    createHandle(req, res, next, async () => {
      const sessionId = resolveSessionId(req);
      return lmsTrackerService.getOverview({ sessionId, user: req.userContext });
    })
  );

  router.get("/lms/tracker/insights", (req, res, next) =>
    createHandle(req, res, next, async () => {
      const sessionId = resolveSessionId(req);
      return lmsTrackerService.getInsights({ sessionId, user: req.userContext });
    })
  );

  router.get("/lms/tracker/unified-insights", (req, res, next) =>
    createHandle(req, res, next, async () => {
      const sessionId = resolveSessionId(req);
      return lmsTrackerService.getUnifiedInsights({ sessionId, user: req.userContext });
    })
  );

  router.get("/lms/tracker/history", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsTrackerService.getHistory({
        user: req.userContext,
        snapshotType: req.query.type,
        limit: req.query.limit,
      })
    )
  );

  router.get("/lms/tracker/recommendation-events", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsTrackerService.getRecommendationEvents({
        user: req.userContext,
        limit: req.query.limit,
      })
    )
  );

  router.post("/lms/tracker/recommendation-events", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsTrackerService.recordRecommendationEvent({
        user: req.userContext,
        payload: req.body || {},
      })
    )
  );
}

module.exports = { registerTrackerRoutes };
