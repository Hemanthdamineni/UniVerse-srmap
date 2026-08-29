const express = require("express");
const { createUserContextMiddleware } = require("../utils/eventsAuth");
const {
  computeCompetitionScore,
  computeTeamScore,
  bandLabel,
} = require("../services/events/scoresService");

function createScoresRoutes({
  competitionStore,
  eventsStore,
  persistentTeamStore,
  sessionStore,
  adminPassword = "",
}) {
  if (!competitionStore) {
    throw new Error("createScoresRoutes requires competitionStore");
  }
  const router = express.Router();
  const userContext = createUserContextMiddleware({ sessionStore, adminPassword });
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

  function shapeDimension(dim) {
    return {
      ...dim,
      bandLabel: bandLabel(dim.band),
      progressPct: dim.max > 0 ? Math.round((dim.points / dim.max) * 100) : 0,
    };
  }

  function headlineBandFor(score) {
    if (score >= 80) return "excellent";
    if (score >= 55) return "strong";
    if (score >= 25) return "building";
    if (score > 0) return "starting";
    return "none";
  }

  router.get(
    "/scores/me",
    wrap((req) => {
      ensureAuthenticated(req);
      const userId = req.userContext.userId;
      const competition = computeCompetitionScore({
        competitionStore,
        eventsStore,
        userId,
      });
      const team = computeTeamScore({
        competitionStore,
        persistentTeamStore,
        userId,
      });
      return {
        user: {
          id: userId,
          name: req.userContext.name || null,
        },
        competition: {
          ...competition,
          dimensions: competition.dimensions.map(shapeDimension),
          headlineBand: bandLabel(headlineBandFor(competition.score)),
        },
        team: {
          ...team,
          dimensions: team.dimensions.map(shapeDimension),
          headlineBand: bandLabel(headlineBandFor(team.score)),
        },
      };
    })
  );

  return router;
}

module.exports = { createScoresRoutes };
