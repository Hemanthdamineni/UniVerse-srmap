const fs = require("fs");
const path = require("path");
const express = require("express");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

function loadFacultyCabins() {
  const filePath = path.join(__dirname, "..", "data", "facultyCabins.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    const error = new Error("Faculty cabin payload is malformed");
    error.status = 500;
    error.code = "FACULTY_PAYLOAD_INVALID";
    throw error;
  }
  return parsed.filter((row) => row && row.faculty && row.location);
}

function createFacultyCabinRoutes({ logger } = {}) {
  const router = express.Router();

  let cachedCabins = null;

  router.get("/faculty-cabins", async (req, res) => {
    try {
      if (!cachedCabins) {
        cachedCabins = loadFacultyCabins();
      }
      return sendApiSuccess(res, req, { success: true, data: cachedCabins }, {
        source: "static",
      });
    } catch (error) {
      cachedCabins = null;
      if (logger?.warn) {
        logger.warn({
          msg: "Faculty cabin data unavailable",
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
  createFacultyCabinRoutes,
  loadFacultyCabins,
};
