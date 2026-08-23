const express = require("express");
const { resolveSessionId, clearSessionCookie } = require("../utils/cookies");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

function shouldClearSessionCookie(error) {
  return String(error?.code || "").trim().toUpperCase() === "SESSION_EXPIRED";
}

function ensureUiMapLoaded(uiMapStore) {
  if (!uiMapStore?.getHealth?.().loaded) {
    const error = new Error("UI mapping unavailable");
    error.status = 503;
    error.code = "UI_MAP_UNAVAILABLE";
    throw error;
  }
}

function createErpV2Routes({ erpAggregationService, uiMapStore, actionExecutor, dataSink }) {
  const router = express.Router();

  function parseModeOverride(req) {
    return String(req.query.mode || req.body?.mode || "").trim().toLowerCase();
  }

  // Fire-and-forget side-channel: lets auxiliary stores (attendance snapshots,
  // vacant-room occupancy) learn from successful live fetches without ever
  // affecting the ERP response path.
  function notifyDataSink(pageKey, sessionId, payload) {
    if (!dataSink?.onLivePageFetched || !payload || payload.source !== "live") return;
    try {
      Promise.resolve(
        dataSink.onLivePageFetched({
          pageKey: String(pageKey),
          sessionId: String(sessionId || ""),
          payload: payload.data,
        })
      ).catch(() => {});
    } catch {
      // sink notification must never break the response
    }
  }

  async function handlePage(res, req, pageKey) {
    try {
      const sessionId = resolveSessionId(req);
      const modeOverride = parseModeOverride(req);

      const data = await erpAggregationService.getPage({
        pageKey,
        sessionId,
        modeOverride,
      });

      notifyDataSink(pageKey, sessionId, data);

      return sendApiSuccess(res, req, data, {
        source: data?.source,
        policyMode: data?.policyMode,
      });
    } catch (error) {
      if (shouldClearSessionCookie(error)) {
        clearSessionCookie(res, req);
      }
      return sendApiError(res, req, error, { extra: { pageKey } });
    }
  }

  router.get("/v2/erp/page/:category/:page", async (req, res) => {
    const pageKey = `${req.params.category}/${req.params.page}`;
    await handlePage(res, req, pageKey);
  });

  router.get("/v2/erp/page/:pageKey", async (req, res) => {
    await handlePage(res, req, req.params.pageKey);
  });

  router.post("/v2/erp/batch", async (req, res) => {
    try {
      const sessionId = resolveSessionId(req);
      const modeOverride = parseModeOverride(req);
      const pageKeys = Array.isArray(req.body?.pageKeys) ? req.body.pageKeys : [];

      const data = await erpAggregationService.getBatch({
        pageKeys,
        sessionId,
        modeOverride,
      });

      if (data && typeof data === "object") {
        for (const [pageKey, pageData] of Object.entries(data)) {
          notifyDataSink(pageKey, sessionId, pageData);
        }
      }

      return sendApiSuccess(res, req, { success: true, data });
    } catch (error) {
      if (shouldClearSessionCookie(error)) {
        clearSessionCookie(res, req);
      }
      return sendApiError(res, req, error);
    }
  });

  router.get("/v2/erp/ui/:category/:page", (req, res) => {
    try {
      ensureUiMapLoaded(uiMapStore);

      const pageKey = `${req.params.category}/${req.params.page}`;
      const data = uiMapStore.getUiHints(pageKey);
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/v2/erp/ui/:pageKey", (req, res) => {
    try {
      ensureUiMapLoaded(uiMapStore);

      const data = uiMapStore.getUiHints(req.params.pageKey);
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/v2/erp/schema/:category/:page", (req, res) => {
    try {
      ensureUiMapLoaded(uiMapStore);

      const pageKey = `${req.params.category}/${req.params.page}`;
      const data = uiMapStore.getRenderSchema(pageKey);
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.get("/v2/erp/schema/:pageKey", (req, res) => {
    try {
      ensureUiMapLoaded(uiMapStore);

      const data = uiMapStore.getRenderSchema(req.params.pageKey);
      return sendApiSuccess(res, req, data);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  router.post("/v2/erp/action/execute", async (req, res) => {
    try {
      if (!actionExecutor) {
        const error = new Error("Action executor unavailable");
        error.status = 503;
        error.code = "ACTION_EXECUTOR_UNAVAILABLE";
        throw error;
      }

      const body = req.body || {};
      const sessionId = String(body.sessionId || resolveSessionId(req) || "").trim();

      const result = await actionExecutor.execute({
        pageKey: body.pageKey,
        actionId: body.actionId,
        payload: body.payload,
        sessionId,
        expectedMethod: body.method,
        expectedUrl: body.url,
      });

      return sendApiSuccess(res, req, result);
    } catch (error) {
      return sendApiError(res, req, error);
    }
  });

  return router;
}

module.exports = {
  createErpV2Routes,
};
