function registerGuideRoadmapRoutes(
  router,
  {
    createHandle,
    lmsStore,
    toBoolean,
    renderGuidePdf,
  }
) {
  router.get("/lms/collections", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.listCollections(req.userContext.userId))
  );

  router.post("/lms/collections", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.createCollection(
        req.userContext.userId,
        req.body.name,
        req.body.description,
        req.body.isPublic
      )
    )
  );

  router.get("/lms/collections/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getCollection(req.params.id, req.userContext.userId)
    )
  );

  router.post("/lms/collections/:id/items", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.addToCollection(req.params.id, req.body.resourceId, req.userContext.userId)
    )
  );

  router.delete("/lms/collections/:id/items/:resourceId", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.removeFromCollection(req.params.id, req.params.resourceId, req.userContext.userId)
    )
  );

  router.get("/lms/guides", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.listGuides(
        {
          subjectCode: req.query.subjectCode,
          includeDrafts: toBoolean(req.query.includeDrafts),
        },
        { userId: req.userContext.userId }
      )
    )
  );

  router.post("/lms/guides", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.createGuide(req.userContext.userId, req.body))
  );

  router.get("/lms/guides/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getGuide(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.put("/lms/guides/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.updateGuide(req.params.id, req.userContext.userId, req.body, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.delete("/lms/guides/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.deleteGuide(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.post("/lms/guides/:id/sections", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.addGuideSection(req.params.id, req.userContext.userId, req.body)
    )
  );

  router.put("/lms/guides/:id/sections/:sid", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.updateGuideSection(req.params.id, req.params.sid, req.userContext.userId, req.body)
    )
  );

  router.post("/lms/guides/:id/sections/:sid/read", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.markGuideSectionRead(req.params.id, req.params.sid, req.userContext.userId)
    )
  );

  router.post("/lms/guides/:id/upvote", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.toggleEntityUpvote("guide", req.params.id, req.userContext.userId)
    )
  );

  router.get("/lms/guides/:id/export", async (req, res, next) => {
    try {
      const guide = await lmsStore.getGuide(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      });
      const pdf = await renderGuidePdf(guide);
      res.setHeader("content-type", "application/pdf");
      res.setHeader("content-disposition", `attachment; filename="${guide.title.replace(/[^a-z0-9]+/gi, "-")}.pdf"`);
      return res.send(pdf);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/lms/roadmaps", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.listRoadmaps({
        userId: req.userContext.userId,
        includeDrafts: toBoolean(req.query.includeDrafts),
      })
    )
  );

  router.post("/lms/roadmaps", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.createRoadmap(req.userContext.userId, req.body))
  );

  router.get("/lms/roadmaps/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getRoadmap(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.delete("/lms/roadmaps/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.deleteRoadmap(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.post("/lms/roadmaps/:id/nodes", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.addRoadmapNode(req.params.id, req.userContext.userId, req.body)
    )
  );

  router.post("/lms/roadmaps/:id/edges", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.addRoadmapEdge(req.params.id, req.userContext.userId, req.body.fromNodeId, req.body.toNodeId)
    )
  );

  router.post("/lms/roadmaps/:id/nodes/:nid/complete", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.markRoadmapNodeComplete(req.params.id, req.params.nid, req.userContext.userId)
    )
  );
}

module.exports = { registerGuideRoadmapRoutes };
