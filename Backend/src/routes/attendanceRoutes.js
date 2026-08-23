const express = require("express");
const {
  createApiContext,
  submitAttendanceCodeViaApi,
} = require("../services/erp/erpClient");
const { resolveSessionId } = require("../utils/cookies");

function createAttendanceRoutes({
  sessionStore,
  attendanceSnapshotStore,
  erpAggregationService,
}) {
  const router = express.Router();

  router.get("/attendance/history", async (req, res) => {
    try {
      const sessionId = resolveSessionId(req);
      if (!sessionId) {
        return res.status(401).json({ success: false, error: "Authentication required." });
      }
      if (!attendanceSnapshotStore || !erpAggregationService) {
        return res.status(503).json({ success: false, error: "Attendance history is not available." });
      }
      const userKey = await erpAggregationService.resolveUserKey(sessionId);
      const history = attendanceSnapshotStore.history(userKey) || [];
      return res.json({ success: true, data: history });
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({ success: false, error: error.message });
    }
  });

  router.post("/attendance/mark", async (req, res) => {
    const {
      sessionId = "",
      acode = "",
      dynamiclatdata = "0",
      dynamiclonxdata = "0",
    } = req.body || {};

    const normalizedSessionId = String(sessionId || resolveSessionId(req) || "").trim();
    const normalizedAcode = String(acode || "").trim();

    if (!normalizedSessionId || !normalizedAcode) {
      return res.status(400).json({
        success: false,
        error: "sessionId and acode are required",
      });
    }

    if (!/^[a-zA-Z0-9]{7}$/.test(normalizedAcode)) {
      return res.status(400).json({
        success: false,
        error: "Attendance code must be exactly 7 alphanumeric characters",
      });
    }

    try {
      const session = await sessionStore.getOrThrow(normalizedSessionId);
      const api = await createApiContext(session.storageState);

      try {
        const result = await submitAttendanceCodeViaApi(api, {
          acode: normalizedAcode.toUpperCase(),
          dynamiclatdata,
          dynamiclonxdata,
        });

        const nextStorageState = await api.storageState();
        await sessionStore.update(normalizedSessionId, { storageState: nextStorageState });

        const message = result.result || "Attendance request completed";
        const isSuccess =
          result.resultstatus === 1 ||
          /accepted|success|marked/i.test(message);

        if (!isSuccess) {
          return res.status(400).json({
            success: false,
            error: message || "Attendance code was not accepted",
            resultstatus: result.resultstatus,
            status: result.status,
          });
        }

        return res.json({
          success: true,
          message,
          resultstatus: result.resultstatus,
          status: result.status,
        });
      } finally {
        await api.dispose();
      }
    } catch (error) {
      const status = error.status || 500;
      return res.status(status).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = {
  createAttendanceRoutes,
};
