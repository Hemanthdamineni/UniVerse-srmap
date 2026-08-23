const fs = require("fs");
const path = require("path");
const express = require("express");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

function loadAcademicCalendar() {
  const filePath = path.join(__dirname, "..", "data", "academicCalendar.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const error = new Error("Academic calendar payload is malformed");
    error.status = 500;
    error.code = "CALENDAR_PAYLOAD_INVALID";
    throw error;
  }
  return parsed;
}

function createAcademicCalendarRoutes({ logger } = {}) {
  const router = express.Router();

  let cachedCalendar = null;

  router.get("/academic-calendar", async (req, res) => {
    try {
      if (!cachedCalendar) {
        cachedCalendar = loadAcademicCalendar();
      }
      return sendApiSuccess(res, req, { success: true, data: cachedCalendar }, {
        source: "static",
      });
    } catch (error) {
      cachedCalendar = null;
      if (logger?.warn) {
        logger.warn({
          msg: "Academic calendar unavailable",
          errorCode: error.code || undefined,
          errorMessage: error.message,
        });
      }
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = {
  createAcademicCalendarRoutes,
  loadAcademicCalendar,
};
