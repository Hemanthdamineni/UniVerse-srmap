const express = require("express");
const { assertAdminAccess } = require("../utils/adminAccess");

function createContentRoutes({ contentStore, adminPassword = "" }) {
  const router = express.Router();

  function wrap(handler) {
    return async (req, res) => {
      try {
        const data = await handler(req, res);
        if (!res.headersSent) {
          res.json({ success: true, data });
        }
      } catch (error) {
        const status = error?.status || 500;
        res.status(status).json({
          success: false,
          error: error?.message || "Unknown error",
        });
      }
    };
  }

  router.post("/content/admin/verify", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return { verified: true };
  }));

  router.get("/content", wrap((req) => {
    return contentStore.listContent({
      type: req.query.type,
      category: req.query.category,
    });
  }));

  router.post("/content", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return contentStore.createContent(req.body || {});
  }));

  router.get("/content/:id", wrap((req) => {
    const content = contentStore.getContent(req.params.id);
    if (!content) {
      const error = new Error("Content not found");
      error.status = 404;
      throw error;
    }
    return content;
  }));

  router.put("/content/:id", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return contentStore.updateContent(req.params.id, req.body || {});
  }));

  router.delete("/content/:id", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return contentStore.deleteContent(req.params.id);
  }));

  router.get("/content/:id/resources", wrap((req) => {
    const content = contentStore.getContent(req.params.id);
    if (!content) {
      const error = new Error("Content not found");
      error.status = 404;
      throw error;
    }
    return contentStore.listResources(req.params.id);
  }));

  router.post("/content/:id/resources", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return contentStore.addResource(req.params.id, req.body || {});
  }));

  return router;
}

module.exports = {
  createContentRoutes,
};
