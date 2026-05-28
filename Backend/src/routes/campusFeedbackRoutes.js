const express = require("express");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");
const { createUserContextMiddleware } = require("../utils/eventsAuth");

function createCampusFeedbackRoutes({ campusFeedbackStore, sessionStore, adminPassword = "" }) {
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore, adminPassword });
  router.use(userContext);

  function ensureAuthenticated(req, res, next) {
    if (!req.userContext || !req.userContext.isAuthenticated) {
      const error = new Error("Authentication required. Please sign in.");
      error.status = 401;
      return sendApiError(res, req, error);
    }
    return next();
  }

  router.use(ensureAuthenticated);

  router.get("/campus-feedback/governance", (req, res) => {
    try {
      return sendApiSuccess(res, req, campusFeedbackStore.getGovernance());
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/campus-feedback/:type/options", (req, res) => {
    try {
      const data = campusFeedbackStore.listOptions(req.params.type, {
        includeInactive: req.userContext.role === "admin",
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/campus-feedback/:type/options", (req, res) => {
    try {
      const data = campusFeedbackStore.createOption(req.params.type, req.body || {}, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/campus-feedback/:type/submissions", (req, res) => {
    try {
      const data = campusFeedbackStore.submitFeedback(req.params.type, req.body || {}, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/campus-feedback/:type/legacy-import", (req, res) => {
    try {
      const data = campusFeedbackStore.importLegacyFeedback(req.params.type, req.body || {}, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/campus-feedback/me/submissions", (req, res) => {
    try {
      const data = campusFeedbackStore.listMine({
        user: req.userContext,
        type: req.query.type,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/campus-feedback/admin/submissions", (req, res) => {
    try {
      const data = campusFeedbackStore.listAdmin({
        user: req.userContext,
        type: req.query.type,
        status: req.query.status,
        limit: req.query.limit,
        offset: req.query.offset,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.patch("/campus-feedback/admin/submissions/:feedbackId", (req, res) => {
    try {
      const data = campusFeedbackStore.moderate(req.params.feedbackId, req.body || {}, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = {
  createCampusFeedbackRoutes,
};
