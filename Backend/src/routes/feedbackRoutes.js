const express = require("express");
const { resolveSessionId, clearSessionCookie } = require("../utils/cookies");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

function shouldClearSessionCookie(error) {
  return String(error?.code || "").trim().toUpperCase() === "SESSION_EXPIRED";
}

function createFeedbackRoutes({ feedbackService }) {
  const router = express.Router();

  router.get("/feedback/end-semester/status", async (req, res) => {
    try {
      const sessionId = resolveSessionId(req);
      const data = await feedbackService.getStatus(sessionId);
      return sendApiSuccess(res, req, data);
    } catch (error) {
      if (shouldClearSessionCookie(error)) {
        clearSessionCookie(res, req);
      }
      return sendApiError(res, req, error);
    }
  });

  router.get("/feedback/end-semester/templates/random", (req, res) => {
    try {
      const data = feedbackService.getRandomTemplate();
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/feedback/end-semester/submit", async (req, res) => {
    try {
      const sessionId = resolveSessionId(req);
      const data = await feedbackService.submit(sessionId, {
        optionNo: req.body?.optionNo,
        comment: req.body?.comment,
        subjectIds: req.body?.subjectIds,
        requestId: req.requestId,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      if (shouldClearSessionCookie(error)) {
        clearSessionCookie(res, req);
      }
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = {
  createFeedbackRoutes,
};
