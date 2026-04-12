const express = require("express");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");
const { createUserContextMiddleware } = require("../utils/eventsAuth");

function createHelpdeskRoutes({ helpdeskStore, sessionStore, adminPassword = "" }) {
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

  router.get("/helpdesk/tickets", (req, res) => {
    try {
      const data = helpdeskStore.listTickets({
        user: req.userContext,
        filters: {
          query: req.query.query,
          status: req.query.status,
          category: req.query.category,
          priority: req.query.priority,
        },
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/helpdesk/tickets", (req, res) => {
    try {
      const data = helpdeskStore.createTicket(req.body || {}, { user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/helpdesk/tickets/:ticketId", (req, res) => {
    try {
      const data = helpdeskStore.getTicket(req.params.ticketId, { user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.patch("/helpdesk/tickets/:ticketId", (req, res) => {
    try {
      const data = helpdeskStore.updateTicket(req.params.ticketId, req.body || {}, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/helpdesk/tickets/:ticketId/escalate", (req, res) => {
    try {
      const data = helpdeskStore.escalateTicket(req.params.ticketId, {
        user: req.userContext,
        reason: req.body?.reason,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/helpdesk/tickets/:ticketId/replies", (req, res) => {
    try {
      const data = helpdeskStore.addReply(req.params.ticketId, req.body || {}, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/helpdesk/faqs", (req, res) => {
    try {
      const includeHidden = req.userContext.role === "admin";
      const data = helpdeskStore.listFaqs({
        query: req.query.query,
        category: req.query.category,
        includeHidden,
      });
      return sendApiSuccess(res, req, { items: data });
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/helpdesk/faqs", (req, res) => {
    try {
      const data = helpdeskStore.createFaq(req.body || {}, { user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.put("/helpdesk/faqs/:faqId", (req, res) => {
    try {
      const data = helpdeskStore.updateFaq(req.params.faqId, req.body || {}, {
        user: req.userContext,
      });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.delete("/helpdesk/faqs/:faqId", (req, res) => {
    try {
      const data = helpdeskStore.deleteFaq(req.params.faqId, { user: req.userContext });
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = {
  createHelpdeskRoutes,
};
