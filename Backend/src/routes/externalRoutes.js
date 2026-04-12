const express = require("express");

function createExternalRoutes({ externalDataStore }) {
  const router = express.Router();

  function respondWithPage(res, pageKey) {
    try {
      const data = externalDataStore.getPage(pageKey);

      if (!data) {
        return res.status(404).json({
          success: false,
          source: "sqlite",
          error: `No external data configured for ${pageKey}`,
          pageKey,
        });
      }

      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({
        success: false,
        source: "sqlite",
        pageKey,
        error: error?.message || "Failed to read external sqlite data",
        hint: "Check sqlite DB accessibility and payload validity for this page key.",
      });
    }
  }

  router.get("/external/:category/:page", (req, res) => {
    const pageKey = `${req.params.category}/${req.params.page}`.trim();
    return respondWithPage(res, pageKey);
  });

  router.get("/external/:pageKey", (req, res) => {
    const pageKey = String(req.params.pageKey || "").trim();
    return respondWithPage(res, pageKey);
  });

  return router;
}

module.exports = {
  createExternalRoutes,
};
