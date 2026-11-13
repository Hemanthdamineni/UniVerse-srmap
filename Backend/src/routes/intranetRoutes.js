const express = require("express");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");
const { createUserContextMiddleware } = require("../utils/eventsAuth");

function createIntranetRoutes({
  intranetStore,
  sessionStore,
  adminPassword = "",
  intranetScraperSupervisorStatus = null,
  intranetScraperTriggerOnce = null,
}) {
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore, adminPassword });
  router.use(userContext);

  function ensureAuthenticated(req, res, next) {
    if (!req.userContext || !req.userContext.isAuthenticated) {
      const error = new Error("Authentication required. Please sign in.");
      error.status = 401;
      return sendApiError(res, req, error);
    }
    return next();
  }

  function ensureAdmin(req, res, next) {
    if (!req.userContext?.hasAdminAccess) {
      const error = new Error("Admin access required.");
      error.status = 403;
      return sendApiError(res, req, error);
    }
    return next();
  }

  function wrap(handler) {
    return async (req, res) => {
      try {
        const data = await handler(req, res);
        if (!res.headersSent) {
          res.json({ success: true, data });
        }
      } catch (error) {
        return sendApiError(res, req, error);
      }
    };
  }

  // ── Dashboard feed ───────────────────────────────────────────────────────

  /**
   * GET /api/intranet/feed
   * Returns recent shared intranet content suitable for the dashboard.
   * Query params: limit (default 15)
   */
  router.get(
    "/intranet/feed",
    ensureAuthenticated,
    wrap((req) => {
      const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 15)));
      return intranetStore.getDashboardFeed({ limit });
    })
  );

  // ── Announcements ────────────────────────────────────────────────────────

  /**
   * GET /api/intranet/announcements
   * Query params: limit, page, department, query
   */
  router.get(
    "/intranet/announcements",
    ensureAuthenticated,
    wrap((req) => {
      const { limit, page, department, query } = req.query;
      return intranetStore.listItems({
        contentType: "announcement",
        audience: "shared",
        department: department || null,
        query: query || null,
        limit,
        page,
        orderBy: "published_at",
      });
    })
  );

  // ── Events ───────────────────────────────────────────────────────────────

  /**
   * GET /api/intranet/events
   * Query params: limit, page, department, query, upcoming (bool)
   */
  router.get(
    "/intranet/events",
    ensureAuthenticated,
    wrap((req) => {
      const { limit, page, department, query, upcoming } = req.query;
      if (upcoming === "true" || upcoming === "1") {
        return intranetStore.getUpcomingEvents(Number(limit ?? 20));
      }
      return intranetStore.listItems({
        contentType: "event",
        audience: "shared",
        department: department || null,
        query: query || null,
        limit,
        page,
        orderBy: "event_start",
      });
    })
  );

  // ── News ─────────────────────────────────────────────────────────────────

  /**
   * GET /api/intranet/news
   * Query params: limit, page, query
   */
  router.get(
    "/intranet/news",
    ensureAuthenticated,
    wrap((req) => {
      const { limit, page, query } = req.query;
      return intranetStore.listItems({
        contentType: "news",
        audience: "shared",
        query: query || null,
        limit,
        page,
        orderBy: "published_at",
      });
    })
  );

  // ── Academic ─────────────────────────────────────────────────────────────

  /**
   * GET /api/intranet/academic
   * Query params: limit, page, query
   */
  router.get(
    "/intranet/academic",
    ensureAuthenticated,
    wrap((req) => {
      const { limit, page, query } = req.query;
      return intranetStore.listItems({
        contentType: "academic",
        audience: "shared",
        query: query || null,
        limit,
        page,
        orderBy: "published_at",
      });
    })
  );

  // ── Documents / Notices ──────────────────────────────────────────────────

  /**
   * GET /api/intranet/documents
   * Query params: limit, page, query, contentType (document|notice|circular)
   */
  router.get(
    "/intranet/documents",
    ensureAuthenticated,
    wrap((req) => {
      const { limit, page, query, contentType } = req.query;
      const validTypes = ["document", "notice", "circular"];
      return intranetStore.listItems({
        contentType: validTypes.includes(contentType) ? contentType : null,
        audience: "shared",
        query: query || null,
        limit,
        page,
        orderBy: "published_at",
      });
    })
  );

  // ── Generic list (all shared content) ────────────────────────────────────

  /**
   * GET /api/intranet/items
   * Query params: limit, page, contentType, department, sourceKey, query, orderBy
   */
  router.get(
    "/intranet/items",
    ensureAuthenticated,
    wrap((req) => {
      const { limit, page, contentType, department, sourceKey, query, orderBy } = req.query;
      const validOrderBy = ["published_at", "event_start", "last_seen_at", "first_seen_at"];
      return intranetStore.listItems({
        contentType: contentType || null,
        audience: "shared",
        department: department || null,
        sourceKey: sourceKey || null,
        query: query || null,
        limit,
        page,
        orderBy: validOrderBy.includes(orderBy) ? orderBy : "published_at",
        includeBody: false,
      });
    })
  );

  // ── Single item ──────────────────────────────────────────────────────────

  /**
   * GET /api/intranet/items/:id
   */
  router.get(
    "/intranet/items/:id",
    ensureAuthenticated,
    wrap((req) => {
      const item = intranetStore.getItem(req.params.id);
      if (!item) {
        const error = new Error("Item not found");
        error.status = 404;
        throw error;
      }
      // Enforce audience: only shared content is accessible via this API.
      if (item.audience !== "shared") {
        const error = new Error("This content is not available through the platform API.");
        error.status = 403;
        throw error;
      }
      return item;
    })
  );

  // ── Operational status (admin) ────────────────────────────────────────────

  /**
   * GET /api/intranet/status
   * Returns scraper health, item counts, and last run info.
   */
  router.get(
    "/intranet/status",
    ensureAuthenticated,
    ensureAdmin,
    wrap(() => {
      const dbStatus = intranetStore.getOperationalStatus();
      const scraperStatus = intranetScraperSupervisorStatus?.() ?? null;
      return { db: dbStatus, scraper: scraperStatus };
    })
  );

  /**
   * POST /api/intranet/scraper/trigger
   * Manually trigger an immediate intranet scrape run.
   */
  router.post(
    "/intranet/scraper/trigger",
    ensureAuthenticated,
    ensureAdmin,
    wrap(() => {
      if (!intranetScraperTriggerOnce) {
        const error = new Error("Scraper trigger not available");
        error.status = 503;
        throw error;
      }
      return intranetScraperTriggerOnce();
    })
  );

  /**
   * POST /api/intranet/scraper/reset/:source
   * Reset circuit breaker for a source.
   */
  router.post(
    "/intranet/scraper/reset/:source",
    ensureAuthenticated,
    ensureAdmin,
    wrap((req) => {
      intranetStore.resetCircuitBreaker(req.params.source);
      return { reset: req.params.source };
    })
  );

  return router;
}

module.exports = { createIntranetRoutes };
