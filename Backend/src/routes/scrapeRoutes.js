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
    const semester = Number.parseInt(String(req.params.semester || ""), 10);
    if (!Number.isInteger(semester) || semester <= 0) {
      return sendApiError(res, req, {
        status: 400,
        message: "Valid semester number is required",
        code: "BAD_REQUEST",
      });
    }
    await handleScrapeRequest(
      res,
      req,
      `examination/earlier-internal-marks/semester/${semester}`
    );
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
