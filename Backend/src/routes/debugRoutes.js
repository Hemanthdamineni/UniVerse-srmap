const express = require("express");

function createDebugRoutes({ erpDumpService }) {
  const router = express.Router();

  router.get("/debug/ping", (req, res) => {
    res.json({
      debugMode: true,
      dumpDir: erpDumpService ? erpDumpService.getDumpDir() : null,
      pageCount: erpDumpService ? erpDumpService.getAllPageKeys().length : 0,
    });
  });

  return router;
}

module.exports = { createDebugRoutes };
