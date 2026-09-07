const express = require("express");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

/**
 * GET /api/deadlines — one chronological timeline merging Classroom coursework
 * (when connected), saved-opportunity deadlines, registered events, and
 * academic-calendar milestones (Batch B12 / T6.6.3).
 *
 * Query: ?horizonDays=60 &includePast=1
 */
function createDeadlineRoutes({ unifiedDeadlineService, sessionStore, adminPassword = "" }) {
  const router = express.Router();
  router.use(createUserContextMiddleware({ sessionStore, adminPassword }));
  router.use((req, res, next) => {
    if (!req.userContext?.isAuthenticated) {
      const error = new Error("Authentication required. Please sign in.");
      error.status = 401;
      return sendApiError(res, req, error);
    }
    return next();
  });

  router.get("/deadlines", async (req, res) => {
    try {
      const timeline = await unifiedDeadlineService.getTimeline(req.userContext, {
        horizonDays: Math.min(365, Math.max(7, Number.parseInt(String(req.query.horizonDays || "60"), 10) || 60)),
        includePast: req.query.includePast === "1" || req.query.includePast === "true",
      });
      return sendApiSuccess(res, req, timeline);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = { createDeadlineRoutes };
