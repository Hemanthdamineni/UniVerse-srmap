const express = require("express");
const { resolveSessionId, clearSessionCookie } = require("../utils/cookies");
const { sendApiError, setStandardHeaders } = require("../utils/apiResponse");

function shouldClearSessionCookie(error) {
  return String(error?.code || "").trim().toUpperCase() === "SESSION_EXPIRED";
}

function createScrapeRoutes({ erpAggregationService, erpLiveService }) {
  const router = express.Router();

  async function handleScrapeRequest(res, req, pageKey) {
    try {
      const sessionId = resolveSessionId(req);
      const modeOverride = String(req.query.mode || "").trim().toLowerCase();

      const payload = await erpAggregationService.getPage({
        pageKey,
        sessionId,
        modeOverride,
      });

      setStandardHeaders(res, req, {
        source: payload?.source,
        policyMode: payload?.policyMode,
      });
      return res.json(payload.data);
    } catch (error) {
      if (shouldClearSessionCookie(error)) {
        clearSessionCookie(res, req);
      }
      return sendApiError(res, req, error);
    }
  }

  router.get("/scrape/:pageKey", async (req, res) => {
    await handleScrapeRequest(res, req, req.params.pageKey);
  });

  router.get("/scrape/:category/:page", async (req, res) => {
    const pageKey = `${req.params.category}/${req.params.page}`;
    await handleScrapeRequest(res, req, pageKey);
  });

  router.get("/scrape/examination/earlier-internal-marks/semester/:semester", async (req, res) => {
    try {
      if (!erpLiveService) {
        const error = new Error("Live ERP service unavailable");
        error.status = 503;
        throw error;
      }

      const sessionId = resolveSessionId(req);
      if (!sessionId) {
        const error = new Error("sessionId is required");
        error.status = 401;
        throw error;
      }

      const semester = Number.parseInt(String(req.params.semester || ""), 10);
      if (!Number.isInteger(semester) || semester <= 0) {
        const error = new Error("Valid semester number is required");
        error.status = 400;
        throw error;
      }

      const payload = await erpLiveService.fetchEarlierInternalMarksSemester(sessionId, semester);
      setStandardHeaders(res, req, {
        source: "live",
        policyMode: "live-only",
      });
      return res.json(payload);
    } catch (error) {
      if (shouldClearSessionCookie(error)) {
        clearSessionCookie(res, req);
      }
      return sendApiError(res, req, error, {
        extra: {
          pageKey: "examination/earlier-internal-marks/semester",
        },
      });
    }
  });

  // Backward compatibility for existing frontend calls like:
  // /api/dashboard and /api/academic/timetable
  router.get("/:category/:page", async (req, res) => {
    const pageKey = `${req.params.category}/${req.params.page}`;
    await handleScrapeRequest(res, req, pageKey);
  });

  router.get("/:pageKey", async (req, res) => {
    await handleScrapeRequest(res, req, req.params.pageKey);
  });

  return router;
}

module.exports = {
  createScrapeRoutes,
};
