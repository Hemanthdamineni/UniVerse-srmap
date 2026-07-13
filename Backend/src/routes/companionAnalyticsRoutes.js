const express = require("express");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

function createCompanionAnalyticsRoutes({ analyticsStore, sessionStore, adminPassword = "" }) {
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore, adminPassword });
  router.use(userContext);

  function requireAdmin(req) {
    if (!req.adminContext?.isElevated && !req.userContext?.hasAdminAccess) {
      const error = new Error("Admin access required");
      error.status = 403;
      throw error;
    }
  }

  router.post("/analytics/events", (req, res) => {
    try {
      const data = analyticsStore.recordEvent(req.body || {}, {
        userId: req.userContext?.isAuthenticated ? req.userContext.userId : null,
        role: req.userContext?.role || "guest",
        sessionId: req.userContext?.sessionId || null,
      });
      return sendApiSuccess(res, req, { recorded: true, id: data.id });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/analytics/companion/report", (req, res) => {
    try {
      requireAdmin(req);
      const data = analyticsStore.getReport({
        days: req.query.days,
        limit: req.query.limit,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = {
  createCompanionAnalyticsRoutes,
};
