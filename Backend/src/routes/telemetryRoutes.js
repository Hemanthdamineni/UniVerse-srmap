const express = require("express");
const { FEATURE_FRONTEND_PERF_TELEMETRY } = require("../config/env");
const { recordFrontendTelemetry } = require("../services/campus/feedbackServices");
const { sendApiError } = require("../utils/apiResponse");
const { createUserContextMiddleware } = require("../utils/eventsAuth");

function createTelemetryRoutes({ sessionStore, adminPassword = "" } = {}) {
  const router = express.Router();
  if (sessionStore) {
    router.use(createUserContextMiddleware({ sessionStore, adminPassword }));
  }

  router.post("/telemetry/frontend", async (req, res) => {
    if (!FEATURE_FRONTEND_PERF_TELEMETRY) {
      return res.status(204).send();
    }
    if (!req.userContext?.isAuthenticated) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    try {
      const payload = req.body && typeof req.body === "object" ? req.body : {};
      recordFrontendTelemetry(payload);
      return res.status(202).json({
        success: true,
        requestId: req.requestId || null,
      });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = {
  createTelemetryRoutes,
};
