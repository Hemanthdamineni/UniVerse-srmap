const express = require("express");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

function createRecommendationRoutes({ unifiedProfileStore, sessionStore, adminPassword = "" }) {
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore, adminPassword });
  router.use(userContext);

  function ensureAuthenticated(req, res, next) {
    if (!req.userContext?.isAuthenticated) {
      const error = new Error("Authentication required. Please sign in.");
      error.status = 401;
      return sendApiError(res, req, error);
    }
    return next();
  }

  function wrap(handler) {
    return (req, res) => {
      try {
        const data = handler(req, res);
        return sendApiSuccess(res, req, data);
      } catch (error) {
        return sendApiError(res, req, error);
      }
    };
  }

  router.use(ensureAuthenticated);

  router.get("/recommendations/home", wrap((req) =>
    unifiedProfileStore.getRecommendations(req.userContext, {
      domain: "home",
      limit: req.query.limit,
      surface: req.query.surface || "home",
    })
  ));

  router.get("/recommendations/lms", wrap((req) =>
    unifiedProfileStore.getRecommendations(req.userContext, {
      domain: "lms",
      limit: req.query.limit,
      surface: req.query.surface || "lms",
    })
  ));

  router.get("/recommendations/career", wrap((req) =>
    unifiedProfileStore.getRecommendations(req.userContext, {
      domain: "career",
      limit: req.query.limit,
      surface: req.query.surface || "career",
    })
  ));

  router.get("/recommendations/events", wrap((req) =>
    unifiedProfileStore.getRecommendations(req.userContext, {
      domain: "events",
      limit: req.query.limit,
      surface: req.query.surface || "events",
    })
  ));

  router.post("/recommendations/feedback", wrap((req) =>
    unifiedProfileStore.recordRecommendationFeedback(req.userContext, {
      impressionId: req.body?.impressionId,
      action: req.body?.action,
      metadata: req.body?.metadata || {},
    })
  ));

  return router;
}

module.exports = {
  createRecommendationRoutes,
};
