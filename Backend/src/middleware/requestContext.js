const { randomUUID } = require("crypto");
const { recordHttpRequest } = require("../services/campus/feedbackServices");
const { log } = require("../utils/logger");

function getClientIp(req) {
  const forwarded = String(req.header("x-forwarded-for") || "")
    .split(",")
    .map((item) => item.trim())
    .find(Boolean);

  return forwarded || req.socket?.remoteAddress || undefined;
}

function createRequestContextMiddleware() {
  return function requestContext(req, res, next) {
    const requestId = String(req.header("x-request-id") || "").trim() || randomUUID();
    const startAt = process.hrtime.bigint();
    let finished = false;

    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);

    res.on("finish", () => {
      finished = true;
      const endAt = process.hrtime.bigint();
      const durationMs = Number(endAt - startAt) / 1e6;
      const path = req.originalUrl || req.url;

      recordHttpRequest({
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs,
      });

      log({
        level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
        msg: "HTTP request completed",
        requestId,
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        ip: getClientIp(req),
        userAgent: req.get("user-agent") || undefined,
        contentLength: res.getHeader("content-length") || undefined,
      });
    });

    res.on("close", () => {
      if (finished) return;

      const endAt = process.hrtime.bigint();
      const durationMs = Number(endAt - startAt) / 1e6;
      log({
        level: "warn",
        msg: "HTTP request aborted",
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        durationMs: Number(durationMs.toFixed(2)),
        ip: getClientIp(req),
        userAgent: req.get("user-agent") || undefined,
      });
    });

    next();
  };
}

module.exports = {
  createRequestContextMiddleware,
};
