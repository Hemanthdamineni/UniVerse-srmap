const { FEATURE_ERP_ERROR_ENVELOPE } = require("../config/env");
const { log } = require("./logger");

function toErrorCode(error, fallback = "INTERNAL_ERROR") {
  if (!error) return fallback;
  const explicit = String(error.code || "").trim();
  if (explicit) return explicit.toUpperCase();

  const status = Number(error.status || 0);
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 408 || status === 504) return "TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "UPSTREAM_UNAVAILABLE";
  return fallback;
}

function isRetryable(error) {
  const code = toErrorCode(error);
  return [
    "TIMEOUT",
    "CIRCUIT_OPEN",
    "RATE_LIMITED",
    "UPSTREAM_UNAVAILABLE",
  ].includes(code);
}

function setStandardHeaders(res, req, meta = {}) {
  if (req?.requestId) {
    res.setHeader("x-request-id", req.requestId);
  }
  if (meta.source) {
    res.setHeader("x-erp-source", String(meta.source));
  }
  if (meta.policyMode) {
    res.setHeader("x-erp-policy", String(meta.policyMode));
  }
}

function sendApiError(res, req, error, options = {}) {
  const status = Number(options.status || error?.status || 500);
  const code = toErrorCode(error, options.fallbackCode || "INTERNAL_ERROR");
  const message = error?.message || options.fallbackMessage || "Unknown error";
  const extra = {
    ...(error?.extra && typeof error.extra === "object" ? error.extra : {}),
    ...(options.extra && typeof options.extra === "object" ? options.extra : {}),
  };
  setStandardHeaders(res, req, options.meta || {});

  log({
    level: status >= 500 ? "error" : "warn",
    msg: status >= 500 ? "API request failed" : "API request rejected",
    requestId: req?.requestId || undefined,
    method: req?.method || undefined,
    path: req?.originalUrl || req?.url || undefined,
    statusCode: status,
    errorCode: code,
    errorMessage: message,
    error: status >= 500 ? error : undefined,
  });

  if (FEATURE_ERP_ERROR_ENVELOPE) {
    return res.status(status).json({
      success: false,
      error: {
        code,
        message,
        retryable: isRetryable(error),
      },
      requestId: req?.requestId || null,
      ...extra,
    });
  }

  return res.status(status).json({
    success: false,
    error: message,
    ...extra,
  });
}

function sendApiSuccess(res, req, body, meta = {}) {
  setStandardHeaders(res, req, meta);
  return res.json(body);
}

module.exports = {
  sendApiError,
  sendApiSuccess,
  setStandardHeaders,
  toErrorCode,
};
