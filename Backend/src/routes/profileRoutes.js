const express = require("express");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const { sendApiError, sendApiSuccess } = require("../utils/apiResponse");

function createProfileRoutes({ unifiedProfileStore, sessionStore, adminPassword = "" }) {
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore, adminPassword });
  router.use(userContext);

  function ensureAuthenticated(req, res, next) {
    if (!req.userContext?.isAuthenticated) {
      const error = new Error("Authentication required. Please sign in.");
      error.status = 401;
      return sendApiError(res, req, error);
    }
    return next();
  }

  function wrap(handler) {
    return (req, res) => {
      try {
        const data = handler(req, res);
        return sendApiSuccess(res, req, data);
      } catch (error) {
        return sendApiError(res, req, error);
      }
    };
  }

  router.get("/profile/public/:userId", wrap((req) =>
    unifiedProfileStore.getPublicCareerProfile(req.params.userId, { audience: "public" })
  ));

  router.use(ensureAuthenticated);

  router.get("/profile/unified", wrap((req) =>
    unifiedProfileStore.buildUnifiedProfile(req.userContext, {
      recompute: req.query.recompute !== "false",
    })
  ));

  router.post("/profile/recompute", wrap((req) =>
    unifiedProfileStore.buildUnifiedProfile(req.userContext, { recompute: true })
  ));

  router.get("/profile/public-preview", wrap((req) =>
    unifiedProfileStore.getPublicCareerProfile(req.userContext.userId, {
      audience: req.query.audience === "employers" ? "employers" : "public",
    })
  ));

  router.get("/profile/signals", wrap((req) => ({
    items: unifiedProfileStore.listSignals(req.userContext, {
      domain: req.query.domain,
      limit: req.query.limit,
    }),
  })));

  router.post("/profile/signals", wrap((req) =>
    unifiedProfileStore.recordSignal({
      userId: req.userContext.userId,
      domain: req.body?.domain,
      signalType: req.body?.signalType,
      signalRefId: req.body?.signalRefId,
      strength: req.body?.strength,
      visibility: req.body?.visibility,
      metadata: req.body?.metadata || {},
      occurredAt: req.body?.occurredAt,
    })
  ));

  router.get("/profile/skills", wrap((req) => ({
    items: unifiedProfileStore.listSkills(req.userContext),
  })));

  router.patch("/profile/skills/:skill/visibility", wrap((req) => ({
    items: unifiedProfileStore.updateSkillVisibility(
      req.userContext,
      req.params.skill,
      req.body?.visibility
    ),
  })));

  router.get("/profile/achievements", wrap((req) => ({
    items: unifiedProfileStore.listAchievements(req.userContext),
  })));

  router.post("/profile/achievements/sync", wrap((req) =>
    unifiedProfileStore.syncEventAchievements(req.userContext)
  ));

  router.patch("/profile/achievements/:achievementId/visibility", wrap((req) =>
    unifiedProfileStore.updateAchievementVisibility(
      req.userContext,
      req.params.achievementId,
      req.body?.visibility
    )
  ));

  router.get("/profile/privacy", wrap((req) => unifiedProfileStore.getPrivacySettings(req.userContext)));

  router.patch("/profile/privacy", wrap((req) =>
    unifiedProfileStore.updatePrivacySettings(req.userContext, req.body || {})
  ));

  return router;
}

module.exports = {
  createProfileRoutes,
};
