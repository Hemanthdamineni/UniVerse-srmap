const express = require("express");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");
const { normalizeDay, DAY_ORDER, SLOT_TIMES } = require("../services/erp/vacantRoomStore");

function createVacantRoomRoutes({ vacantRoomStore }) {
  const router = express.Router();

  router.get("/vacant-rooms", (req, res) => {
    try {
      const dayParam = String(req.query.day || "").trim();
      const slotParam = req.query.slot;

      if (!vacantRoomStore) {
        const error = new Error("Vacant room data is not available");
        error.status = 503;
        error.code = "VACANT_STORE_UNAVAILABLE";
        throw error;
      }

      // Defaults: today's weekday and the current slot when both are omitted.
      let day = dayParam ? normalizeDay(dayParam) : null;
      let slotIndex =
        slotParam === undefined || slotParam === "" ? null : Number.parseInt(String(slotParam), 10);

      if (!dayParam && !slotParam) {
        // India-time weekday/hour for defaults.
        const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
        const weekday = ist.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
        day = DAY_ORDER.includes(weekday) ? weekday : "monday";

        const minutesSinceMidnight = ist.getHours() * 60 + ist.getMinutes();
        const startsAt = [540, 600, 660, 720, 780, 840, 900, 960]; // 09:00..16:00
        const endsAt = [590, 650, 710, 770, 830, 890, 950, 1050]; // :50 ends, lab until 17:30
        slotIndex = startsAt.findIndex((start, i) => minutesSinceMidnight >= start && minutesSinceMidnight <= endsAt[i]);
        if (slotIndex === -1) slotIndex = minutesSinceMidnight < startsAt[0] ? 0 : 7;
      }

      const result = vacantRoomStore.vacantRooms({ day, slotIndex });
      if (!result.ok) {
        const error = new Error(result.reason);
        error.status = 400;
        error.code = "BAD_REQUEST";
        return sendApiError(res, req, error);
      }

      return sendApiSuccess(res, req, {
        success: true,
        data: result,
        meta: { slots: SLOT_TIMES },
      }, { source: "derived" });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = { createVacantRoomRoutes };
