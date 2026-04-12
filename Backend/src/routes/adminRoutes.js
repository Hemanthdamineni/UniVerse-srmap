const express = require("express");
const { resolveSessionId } = require("../utils/cookies");
const { assertAdminAccess } = require("../utils/adminAccess");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

function createAdminRoutes({ sessionStore, adminPassword = "" }) {
  const router = express.Router();

  router.get("/admin/access/status", async (req, res) => {
    try {
      return sendApiSuccess(res, req, {
        registerNo: req.adminContext?.registerNo || "",
        potentialAdmin: Boolean(req.adminContext?.potentialAdmin),
        isAdmin: Boolean(req.adminContext?.isElevated),
      });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/admin/access/unlock", async (req, res) => {
    try {
      if (!req.adminContext?.potentialAdmin) {
        const error = new Error("Admin privileges are not available for this account.");
        error.status = 403;
        throw error;
      }
      assertAdminAccess(req, adminPassword);
      const sessionId = resolveSessionId(req);
      await sessionStore.update(sessionId, {
        adminElevated: true,
        adminElevatedAt: new Date().toISOString(),
      });
      return sendApiSuccess(res, req, { isAdmin: true });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/admin/access/disable", async (req, res) => {
    try {
      const sessionId = resolveSessionId(req);
      if (sessionId) {
        await sessionStore.update(sessionId, {
          adminElevated: false,
          adminElevatedAt: null,
        });
      }
      return sendApiSuccess(res, req, { isAdmin: false });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = {
  createAdminRoutes,
};
