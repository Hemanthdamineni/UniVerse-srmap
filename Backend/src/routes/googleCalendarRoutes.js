const express = require("express");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

/**
 * Google Calendar sync (Batch B10 / Story 6.3).
 *
 * GET  /api/integrations/google/status       — availability + connection state
 * GET  /api/integrations/google/connect      — { url } to the consent screen
 * GET  /api/integrations/google/callback     — OAuth redirect target (no auth; state is the auth)
 * POST /api/integrations/google/sync         — sync timetable + deadlines now
 * POST /api/integrations/google/disconnect   — revoke + delete our calendar
 */
function createGoogleCalendarRoutes({
  calendarSyncService,
  classroomService = null,
  erpAcademicSnapshotStore = null,
  careerStore = null,
  appBaseUrl = "",
  sessionStore,
  adminPassword = "",
}) {
  const router = express.Router();

  // Callback is hit by Google, not the SPA — no session cookie, the signed
  // `state` carries + authorises the user id.
  router.get("/integrations/google/callback", async (req, res) => {
    const redirectBase = appBaseUrl || "";
    try {
      await calendarSyncService.handleCallback({ code: String(req.query.code || ""), state: String(req.query.state || "") });
      res.redirect(`${redirectBase}/settings?google=connected`);
    } catch (error) {
      res.redirect(`${redirectBase}/settings?google=error`);
    }
  });

  router.use(createUserContextMiddleware({ sessionStore, adminPassword }));
  router.use((req, res, next) => {
    if (!req.userContext?.isAuthenticated) {
      const error = new Error("Authentication required. Please sign in.");
      error.status = 401;
      return sendApiError(res, req, error);
    }
    return next();
  });

  router.get("/integrations/google/status", (req, res) => {
    try {
      return sendApiSuccess(res, req, calendarSyncService.status(req.userContext.userId));
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/integrations/google/connect", (req, res) => {
    try {
      return sendApiSuccess(res, req, { url: calendarSyncService.buildAuthUrl(req.userContext.userId) });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/integrations/google/sync", async (req, res) => {
    try {
      const userId = req.userContext.userId;
      const timetable = erpAcademicSnapshotStore?.getTimetable?.(userId);
      const result = { timetable: null, deadlines: null };
      if (timetable) result.timetable = await calendarSyncService.syncTimetable(userId, timetable);
      if (careerStore?.getBookmarkDeadlineReminderCandidates) {
        const deadlines = careerStore
          .getBookmarkDeadlineReminderCandidates(30)
          .filter((r) => r.userId === userId && r.deadline)
          .map((r) => ({
            erpKey: `dl:opp:${r.opportunityId}`,
            title: `Closes: ${r.title}`,
            date: r.deadline,
            description: "Saved opportunity deadline.",
          }));
        result.deadlines = await calendarSyncService.syncDeadlines(userId, deadlines);
      }
      return sendApiSuccess(res, req, result);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/integrations/google/disconnect", async (req, res) => {
    try {
      return sendApiSuccess(res, req, await calendarSyncService.disconnect(req.userContext.userId));
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  // Batch B12 — Classroom is part of the same Google connection; this reports
  // whether it's enabled server-side and whether the current grant covers it.
  router.get("/integrations/google/classroom/status", (req, res) => {
    try {
      const status = classroomService
        ? classroomService.status(req.userContext.userId)
        : { available: false, connected: false, needsReconnect: false };
      return sendApiSuccess(res, req, status);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = { createGoogleCalendarRoutes };
