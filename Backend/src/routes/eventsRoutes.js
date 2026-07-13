const express = require("express");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const { EVENT_STATES } = require("../services/events/eventsStore");

function createEventsRoutes({ eventsStore, sessionStore, competitionStore, adminPassword = "" }) {
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore, adminPassword });
  router.use(userContext);

  function ensureAuthenticated(req) {
    if (!req.userContext || !req.userContext.isAuthenticated) {
      const error = new Error("Authentication required. Please sign in.");
      error.status = 401;
      throw error;
    }
  }

  function wrap(handler) {
    return async (req, res) => {
      try {
        const data = await handler(req, res);
        if (!res.headersSent) {
          res.json({ success: true, data });
        }
      } catch (error) {
        const status = error.status || 500;
        res.status(status).json({ success: false, error: error.message || "Unknown error" });
      }
    };
  }

  router.get("/events", wrap((req) => {
    ensureAuthenticated(req);
    const filters = {
      query: req.query.query,
      category: req.query.category,
      department: req.query.department,
      status: req.query.status,
      visibility: req.query.visibility,
      type: req.query.type,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      myEvents: req.query.myEvents === "true",
      registered: req.query.registered === "true",
      createdBy: req.query.createdBy,
    };

    return eventsStore.listEvents({ user: req.userContext, filters });
  }));

  router.get("/events/calendar", wrap((req) => {
    ensureAuthenticated(req);
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status || EVENT_STATES.PUBLISHED,
      department: req.query.department,
    };

    const list = eventsStore.listEvents({ user: req.userContext, filters });
    return list.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.startAt,
      end: event.endAt,
      extendedProps: {
        category: event.category,
        department: event.department,
        featured: event.featured,
        visibility: event.visibility,
        status: event.status,
      },
    }));
  }));

  router.get("/events/my-registrations", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.listMyRegistrations({ user: req.userContext });
  }));

  router.get("/events/my-registered", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.listMyRegistrations({ user: req.userContext });
  }));

  router.get("/events/my-created", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.listMyCreated({ user: req.userContext });
  }));

  router.get("/events/analytics", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.analytics({ user: req.userContext });
  }));

  router.get("/events/notifications", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.listNotifications(req.userContext.userId);
  }));

  router.post("/events/notifications/reminders", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.createReminderNotifications();
  }));

  router.patch("/events/notifications/:notificationId/read", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.markNotificationRead(req.params.notificationId, req.userContext.userId);
  }));

  router.post("/events", wrap((req) => {
    ensureAuthenticated(req);
    if (competitionStore && req.body?.competitionConfig) {
      competitionStore.checkActiveCompetitionCount(req.userContext.userId);
    }
    return eventsStore.createEvent(req.body || {}, { user: req.userContext });
  }));

  router.post("/events/bulk-action", wrap((req) => {
    ensureAuthenticated(req);
    const { eventIds, action } = req.body || {};
    return eventsStore.bulkAction(eventIds, action, { user: req.userContext });
  }));

  router.get("/events/:eventId", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.getEvent(req.params.eventId, { user: req.userContext });
  }));

  router.put("/events/:eventId", wrap((req) => {
    ensureAuthenticated(req);
    if (competitionStore && req.body?.competitionConfig) {
      competitionStore.checkActiveCompetitionCount(req.userContext.userId);
    }
    return eventsStore.updateEvent(req.params.eventId, req.body || {}, { user: req.userContext });
  }));

  router.put("/events/:eventId/co-organizers", wrap((req) => {
    ensureAuthenticated(req);
    const raw = Array.isArray(req.body?.coOrganizers) ? req.body.coOrganizers : [];
    const coOrganizers = raw.map((item) => String(item || "").trim()).filter(Boolean);
    return eventsStore.updateEvent(
      req.params.eventId,
      { coOrganizers },
      { user: req.userContext }
    );
  }));

  router.delete("/events/:eventId", wrap((req) => {
    ensureAuthenticated(req);
    eventsStore.deleteEvent(req.params.eventId, { user: req.userContext });
    return { deleted: true, eventId: req.params.eventId };
  }));

  router.post("/events/:eventId/duplicate", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.duplicateEvent(req.params.eventId, { user: req.userContext });
  }));

  router.patch("/events/:eventId/status", wrap((req) => {
    ensureAuthenticated(req);
    const { status } = req.body || {};
    return eventsStore.transitionEvent(req.params.eventId, status, { user: req.userContext });
  }));

  router.patch("/events/:eventId/approval", wrap((req) => {
    ensureAuthenticated(req);
    const { approved, notes } = req.body || {};
    return eventsStore.approveEvent(req.params.eventId, {
      user: req.userContext,
      approved: Boolean(approved),
      notes,
    });
  }));

  router.post("/events/:eventId/register", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.register(req.params.eventId, req.body || {}, { user: req.userContext });
  }));

  router.post("/events/:eventId/cancel-registration", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.cancelRegistration(req.params.eventId, {
      user: req.userContext,
      reason: req.body?.reason,
    });
  }));

  router.delete("/events/:eventId/register", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.cancelRegistration(req.params.eventId, {
      user: req.userContext,
      reason: req.body?.reason || "Cancelled by attendee",
    });
  }));

  router.post("/events/:eventId/check-in", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.checkIn(req.params.eventId, {
      actor: req.userContext,
      code: String(req.body?.code || ""),
    });
  }));

  router.get("/events/:eventId/attendees.csv", wrap((req, res) => {
    ensureAuthenticated(req);
    const csv = eventsStore.exportAttendeesCsv(req.params.eventId, { user: req.userContext });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=event-${req.params.eventId}-attendees.csv`
    );
    res.send(csv);
  }));

  router.post("/events/:eventId/messages", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.sendBulkMessage(req.params.eventId, {
      user: req.userContext,
      subject: req.body?.subject,
      message: req.body?.message,
    });
  }));

  router.post("/events/:eventId/feedback", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.submitFeedback(req.params.eventId, {
      user: req.userContext,
      rating: req.body?.rating,
      comments: req.body?.comments,
      answers: req.body?.answers,
    });
  }));

  router.post("/events/:eventId/gallery", wrap((req) => {
    ensureAuthenticated(req);
    return eventsStore.addGalleryPhoto(req.params.eventId, {
      user: req.userContext,
      url: req.body?.url,
      caption: req.body?.caption,
    });
  }));

  router.get("/events/:eventId/ical", wrap((req, res) => {
    ensureAuthenticated(req);
    const body = eventsStore.createIcal(req.params.eventId);
    res.setHeader("Content-Type", "text/calendar");
    res.setHeader("Content-Disposition", `attachment; filename=event-${req.params.eventId}.ics`);
    res.send(body);
  }));

  return router;
}

module.exports = {
  createEventsRoutes,
};
