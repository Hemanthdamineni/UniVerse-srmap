const express = require("express");
const { createUserContextMiddleware } = require("../utils/eventsAuth");

function createPersistentTeamRoutes({ persistentTeamStore, sessionStore }) {
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore });
  router.use(userContext);

  function ensureAuthenticated(req) {
    if (!req.userContext || !req.userContext.isAuthenticated) {
      const error = new Error("Authentication required");
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
        res.status(error.status || 500).json({
          success: false,
          error: error.message || "Unknown error",
        });
      }
    };
  }

  router.get("/teams/persistent", wrap((req) => {
    ensureAuthenticated(req);
    return persistentTeamStore.listMyTeams(req.userContext.userId);
  }));

  router.post("/teams/persistent", wrap((req) => {
    ensureAuthenticated(req);
    return persistentTeamStore.createTeam(req.userContext.userId, req.body || {});
  }));

  router.get("/teams/persistent/invitations", wrap((req) => {
    ensureAuthenticated(req);
    return persistentTeamStore.listMyInvitations(req.userContext.userId);
  }));

  router.patch("/teams/persistent/invitations/:invitationId", wrap((req) => {
    ensureAuthenticated(req);
    return persistentTeamStore.respondToInvitation(
      req.userContext.userId,
      req.params.invitationId,
      Boolean(req.body?.accept)
    );
  }));

  router.delete("/teams/persistent/:teamId/invitations/:inviteeRegisterNumber", wrap((req) => {
    ensureAuthenticated(req);
    return persistentTeamStore.cancelInvitation(
      req.userContext.userId,
      req.params.teamId,
      req.params.inviteeRegisterNumber
    );
  }));

  router.post("/teams/persistent/:teamId/invitations", wrap((req) => {
    ensureAuthenticated(req);
    return persistentTeamStore.inviteMembers(
      req.userContext.userId,
      req.params.teamId,
      req.body?.inviteRegNos
    );
  }));

  router.delete("/teams/persistent/:teamId", wrap((req) => {
    ensureAuthenticated(req);
    return persistentTeamStore.deleteTeam(req.userContext.userId, req.params.teamId);
  }));

  return router;
}

module.exports = { createPersistentTeamRoutes };
