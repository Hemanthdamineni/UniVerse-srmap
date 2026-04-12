const express = require("express");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");
const { createUserContextMiddleware } = require("../utils/eventsAuth");

function createCareerRoutes({ careerStore, sessionStore, adminPassword = "" }) {
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore, adminPassword });
  router.use(userContext);

  function ensureAuthenticated(req, res, next) {
    if (!req.userContext || !req.userContext.isAuthenticated) {
      const error = new Error("Authentication required. Please sign in.");
      error.status = 401;
      return sendApiError(res, req, error);
    }
    next();
  }

  router.use(ensureAuthenticated);

  router.get("/career/opportunities", (req, res) => {
    try {
      const data = careerStore.listOpportunities({
        user: req.userContext,
        filters: {
          query: req.query.query,
          type: req.query.type,
          status: req.query.status,
        },
      });
      return sendApiSuccess(res, req, { items: data });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/career/opportunities", (req, res) => {
    try {
      const data = careerStore.createOpportunity(req.body || {}, { user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.put("/career/opportunities/:opportunityId", (req, res) => {
    try {
      const data = careerStore.updateOpportunity(req.params.opportunityId, req.body || {}, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.delete("/career/opportunities/:opportunityId", (req, res) => {
    try {
      const data = careerStore.deleteOpportunity(req.params.opportunityId, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/career/opportunities/:opportunityId/save", (req, res) => {
    try {
      const data = careerStore.saveOpportunity(req.params.opportunityId, { user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.delete("/career/opportunities/:opportunityId/save", (req, res) => {
    try {
      const data = careerStore.unsaveOpportunity(req.params.opportunityId, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/career/opportunities/:opportunityId/apply", (req, res) => {
    try {
      const data = careerStore.applyToOpportunity(req.params.opportunityId, req.body || {}, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/career/profile", (req, res) => {
    try {
      const data = careerStore.getProfile({ user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.put("/career/profile", (req, res) => {
    try {
      const data = careerStore.updateProfile(req.body || {}, { user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/career/interviews/slots", (req, res) => {
    try {
      const data = careerStore.listInterviewSlots({ user: req.userContext });
      return sendApiSuccess(res, req, { items: data });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/career/interviews/slots", (req, res) => {
    try {
      const data = careerStore.createInterviewSlot(req.body || {}, { user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.put("/career/interviews/slots/:slotId", (req, res) => {
    try {
      const data = careerStore.updateInterviewSlot(req.params.slotId, req.body || {}, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.delete("/career/interviews/slots/:slotId", (req, res) => {
    try {
      const data = careerStore.deleteInterviewSlot(req.params.slotId, { user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/career/interviews/bookings", (req, res) => {
    try {
      const data = careerStore.listInterviewBookings({ user: req.userContext });
      return sendApiSuccess(res, req, { items: data });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/career/interviews/bookings", (req, res) => {
    try {
      const data = careerStore.bookInterviewSlot(req.body || {}, { user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.delete("/career/interviews/bookings/:bookingId", (req, res) => {
    try {
      const data = careerStore.cancelInterviewBooking(req.params.bookingId, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/career/alumni", (req, res) => {
    try {
      const data = careerStore.listAlumni({
        user: req.userContext,
        query: req.query.query,
        batch: req.query.batch,
      });
      return sendApiSuccess(res, req, { items: data });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/career/alumni", (req, res) => {
    try {
      const data = careerStore.createAlumni(req.body || {}, { user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.put("/career/alumni/:alumniId", (req, res) => {
    try {
      const data = careerStore.updateAlumni(req.params.alumniId, req.body || {}, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.delete("/career/alumni/:alumniId", (req, res) => {
    try {
      const data = careerStore.deleteAlumni(req.params.alumniId, { user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/career/alumni/:alumniId/requests", (req, res) => {
    try {
      const data = careerStore.requestAlumniConnection(req.params.alumniId, req.body || {}, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = {
  createCareerRoutes,
};
