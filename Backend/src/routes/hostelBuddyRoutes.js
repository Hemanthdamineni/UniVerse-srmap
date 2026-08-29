// Hostel Buddy Finder API (Gate 7 — J2-adjacent).
//
// All routes are auth-gated (the userContext middleware is already
// mounted on the app); unauthenticated callers receive 401. The
// audit-relevant surface:
//   - GET  /api/hostel-buddy/governance  (public metadata)
//   - GET  /api/hostel-buddy/blocks       (active blocks list)
//   - GET  /api/hostel-buddy/me           (caller's saved entry)
//   - PUT  /api/hostel-buddy/me           (upsert caller entry)
//   - DELETE /api/hostel-buddy/me         (clear caller entry)
//   - GET  /api/hostel-buddy/matches      (other students in same
//                                          room + block as caller)

const express = require("express");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

const GOVERNANCE = {
  label: "Hostel Buddy Finder",
  owner: "Student roommate discovery (campus community)",
  routeNamespace: "/api/hostel-buddy",
  retentionPolicy:
    "Entries are retained until the student removes them or until the end of the academic session. Contact info is shared only with students in the same room and block.",
};

function createHostelBuddyRoutes({ hostelBuddyStore }) {
  const router = express.Router();

  function getUserId(req) {
    return (
      req?.userContext?.userId ||
      req?.user?.id ||
      req?.userId ||
      null
    );
  }

  function getUserName(req) {
    return (
      req?.userContext?.name ||
      req?.user?.name ||
      req?.userName ||
      null
    );
  }

  function getUserDepartment(req) {
    return (
      req?.userContext?.department ||
      req?.user?.department ||
      null
    );
  }

  function requireStore() {
    if (!hostelBuddyStore) {
      const error = new Error("Hostel buddy store is not available");
      error.status = 503;
      error.code = "HOSTEL_BUDDY_UNAVAILABLE";
      throw error;
    }
  }

  router.get("/hostel-buddy/governance", (req, res) => { require("fs").appendFileSync("/tmp/route-hits.log", "GOVERNANCE-HANDLER-CALLED " + new Date().toISOString() + "\n");
    try {
      return sendApiSuccess(res, req, { governance: GOVERNANCE });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/hostel-buddy/blocks", (req, res) => {
    try {
      requireStore();
      const items = hostelBuddyStore.listBlocks();
      return sendApiSuccess(res, req, { items });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/hostel-buddy/me", (req, res) => {
    try {
      requireStore();
      const userId = getUserId(req);
      if (!userId) {
        return sendApiSuccess(res, req, { entry: null });
      }
      const entry = hostelBuddyStore.getEntryByUserId(userId);
      return sendApiSuccess(res, req, { entry });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.put("/hostel-buddy/me", (req, res) => {
    try {
      requireStore();
      const userId = getUserId(req);
      if (!userId) {
        const error = new Error("Authentication required");
        error.status = 401;
        throw error;
      }
      const body = req.body || {};
      const name = getUserName(req) || body.name;
      const department = getUserDepartment(req) || body.department;
      const roomNo = String(body.roomNo || "").trim().toUpperCase();
      const blockId = String(body.blockId || "").trim();
      const contactInfo = body.contactInfo
        ? String(body.contactInfo).trim()
        : null;
      const entry = hostelBuddyStore.upsertEntry({
        userId,
        name: name || "Anonymous",
        department,
        roomNo,
        blockId,
        contactInfo,
      });
      return sendApiSuccess(res, req, { entry });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.delete("/hostel-buddy/me", (req, res) => {
    try {
      requireStore();
      const userId = getUserId(req);
      if (!userId) {
        const error = new Error("Authentication required");
        error.status = 401;
        throw error;
      }
      const result = hostelBuddyStore.removeEntry(userId);
      return sendApiSuccess(res, req, result);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/hostel-buddy/matches", (req, res) => {
    try {
      requireStore();
      const userId = getUserId(req);
      if (!userId) {
        return sendApiSuccess(res, req, { items: [], governance: GOVERNANCE });
      }
      const me = hostelBuddyStore.getEntryByUserId(userId);
      if (!me) {
        return sendApiSuccess(res, req, { items: [], governance: GOVERNANCE });
      }
      const items = hostelBuddyStore.listMatches({
        userId,
        blockId: me.blockId,
        roomNo: me.roomNo,
      });
      // Strip contact info from the matches list unless the match
      // has chosen to share it (hasContact === true).
      const safeItems = items.map((item) => ({
        ...item,
        contactInfo: item.hasContact ? item.contactInfo : null,
      }));
      return sendApiSuccess(res, req, { items: safeItems, governance: GOVERNANCE });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = { createHostelBuddyRoutes, HOSTEL_BUDDY_GOVERNANCE: GOVERNANCE };
