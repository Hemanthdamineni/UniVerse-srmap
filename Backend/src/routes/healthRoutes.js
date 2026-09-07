const express = require("express");
const { nowIso } = require("../utils/logger");
const { sendApiError } = require("../utils/apiResponse");

function createHealthRoutes({
  sessionStore,
  discoveryRepository,
  pagePolicyStore,
  redisClient,
  externalDataStore,
  contentStore,
  integrityService,
  careerStore = null,
}) {
  const router = express.Router();

  router.get("/health", async (_req, res) => {
    res.json({
      ok: true,
      now: nowIso(),
      status: "live",
    });
  });

  router.get("/live", async (_req, res) => {
    res.json({
      ok: true,
      now: nowIso(),
      status: "live",
    });
  });

  router.get("/ready", async (req, res) => {
    try {
      const integrity = integrityService?.evaluate ? integrityService.evaluate() : null;
      const checks = {
        discoveryLoaded: Boolean(discoveryRepository?.getHealth?.().loaded),
        pagePolicyLoaded: Boolean(pagePolicyStore?.getHealth?.().policyPath),
        redisReady: process.env.REDIS_URL || process.env.REDIS_SENTINEL_URLS
          ? Boolean(redisClient?.isReady)
          : true,
        externalDbReady: externalDataStore?.ping ? externalDataStore.ping() : true,
        contentDbReady: contentStore?.ping ? contentStore.ping() : true,
        integrityEvaluated: integrity ? true : false,
        integrityOk: integrity ? Boolean(integrity.ok) : true,
      };

      const readinessChecks = {
        discoveryLoaded: checks.discoveryLoaded,
        pagePolicyLoaded: checks.pagePolicyLoaded,
        redisReady: checks.redisReady,
        externalDbReady: checks.externalDbReady,
        contentDbReady: checks.contentDbReady,
      };

      const ok = Object.values(readinessChecks).every(Boolean);
      if (!ok) {
        const error = new Error("Service dependencies are not ready");
        error.status = 503;
        error.code = "NOT_READY";
        return sendApiError(res, req, error, { extra: { checks } });
      }

      return res.json({
        ok: true,
        now: nowIso(),
        status: "ready",
        checks,
        integrity,
      });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = {
  createHealthRoutes,
};
