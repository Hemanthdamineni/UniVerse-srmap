const express = require("express");
const { register } = require("../services/metricsService");

function createMetricsRoutes() {
  const router = express.Router();

  router.get("/metrics", async (_req, res) => {
    res.setHeader("Content-Type", register.contentType);
    res.send(await register.metrics());
  });

  return router;
}

module.exports = {
  createMetricsRoutes,
};
