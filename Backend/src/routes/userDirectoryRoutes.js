const express = require("express");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

/**
 * GET /api/users/resolve?ids=AP1,AP2,…  — register-number → display-name lookup
 * for organizer surfaces (leaderboards, judge / shortlist lists, competition
 * audit trails). Unknown ids come back with `name: null` (B3 / T5.4.6).
 *
 * Capped at 200 ids per call. Auth required.
 */
function createUserDirectoryRoutes({ userDirectory, sessionStore, adminPassword = "" }) {
  const router = express.Router();
  router.use(createUserContextMiddleware({ sessionStore, adminPassword, userDirectory }));

  router.get("/users/resolve", (req, res) => {
    try {
      if (!req.userContext?.isAuthenticated) {
        const error = new Error("Authentication required. Please sign in.");
        error.status = 401;
        return sendApiError(res, req, error);
      }
      const ids = String(req.query.ids || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 200);
      return sendApiSuccess(res, req, { items: userDirectory.resolve(ids) });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = { createUserDirectoryRoutes };
