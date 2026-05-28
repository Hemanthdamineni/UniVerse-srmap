const express = require("express");
const { assertAdminAccess } = require("../utils/adminAccess");

function createContentRoutes({ contentStore, adminPassword = "" }) {
  const router = express.Router();

  function adminActor(req) {
    return {
      actorId: req.adminContext?.registerNo || req.get("x-admin-actor") || "admin",
      actorRole: "admin",
    };
  }

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
      lifecycleState: req.query.lifecycleState,
      includeAllStates: req.query.includeAllStates === "true",
      includeDeleted: req.query.includeDeleted === "true",
      page: req.query.page,
      limit: req.query.limit,
    });
  }));

  router.post("/content", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return contentStore.createContent(req.body || {}, { actor: adminActor(req), reason: "Admin created content" });
  }));

  router.get("/content/admin/workflow", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return contentStore.getWorkflowSpec();
  }));

  router.post("/content/bulk/preview", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return contentStore.previewBulkLifecycle({
      ids: req.body?.ids,
      action: req.body?.action,
    });
  }));

  router.post("/content/bulk/execute", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return contentStore.bulkTransitionContent(
      {
        ids: req.body?.ids,
        action: req.body?.action,
        reason: req.body?.reason || "Bulk lifecycle update",
      },
      adminActor(req)
    );
  }));

  router.get("/content/:id", wrap((req) => {
    const content = contentStore.getContent(req.params.id, {
      includeDeleted: req.query.includeDeleted === "true",
    });
    if (!content) {
      const error = new Error("Content not found");
      error.status = 404;
      throw error;
    }
    return content;
  }));

  router.put("/content/:id", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return contentStore.updateContent(req.params.id, req.body || {}, {
      actor: adminActor(req),
      reason: req.body?.reason || "Admin edited content",
    });
  }));

  router.get("/content/:id/history", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return { items: contentStore.listContentHistory(req.params.id, { limit: req.query.limit }) };
  }));

  router.patch("/content/:id/lifecycle", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return contentStore.transitionContent(
      req.params.id,
      {
        action: req.body?.action,
        reason: req.body?.reason || "Admin lifecycle transition",
      },
      adminActor(req)
    );
  }));

  router.delete("/content/:id", wrap((req) => {
    assertAdminAccess(req, adminPassword);
    return contentStore.deleteContent(req.params.id, adminActor(req));
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
