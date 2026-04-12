const express = require("express");
const { FEATURE_FRONTEND_PERF_TELEMETRY } = require("../config/env");
const { recordFrontendTelemetry } = require("../services/metricsService");
const { sendApiError } = require("../utils/apiResponse");

function createTelemetryRoutes() {
  const router = express.Router();

  router.post("/telemetry/frontend", async (req, res) => {
    if (!FEATURE_FRONTEND_PERF_TELEMETRY) {
      return res.status(204).send();
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
