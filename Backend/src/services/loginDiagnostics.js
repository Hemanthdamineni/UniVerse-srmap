const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const {
  LOGIN_DIAGNOSTICS_DIR,
  LOGIN_DIAGNOSTICS_MAX_ARTIFACTS,
  LOGIN_DIAGNOSTICS_MAX_HTML_CHARS,
} = require("../config/env");
const { log } = require("../utils/logger");

function createLoginAttemptId() {
  return randomUUID();
}

function toCookieNames(storageState) {
  const cookies = Array.isArray(storageState?.cookies) ? storageState.cookies : [];
  return Array.from(
    new Set(
      cookies
        .map((cookie) => String(cookie?.name || "").trim())
        .filter(Boolean)
    )
  ).sort();
}

function truncate(value, maxChars = LOGIN_DIAGNOSTICS_MAX_HTML_CHARS) {
  const text = String(value || "");
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n[truncated ${text.length - maxChars} chars]`;
}

function redactSensitiveText(value, secrets = []) {
  let text = String(value || "");

  for (const secret of secrets) {
    const normalized = String(secret || "").trim();
    if (!normalized) continue;
    text = text.split(normalized).join("[redacted]");
  }

  text = text.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    "[redacted-uuid]"
  );
  text = text.replace(/\b\d{8,}\b/g, "[redacted-id]");
  text = text.replace(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    "[redacted-email]"
  );

  return truncate(text);
}

function sanitizeArtifactPayload(value, secrets = [], depth = 0) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return redactSensitiveText(value, secrets);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return String(value);
  if (value instanceof Error) {
    return {
      name: value.name || "Error",
      message: redactSensitiveText(value.message || String(value), secrets),
      code: value.code || undefined,
      status: value.status || undefined,
    };
  }
  if (depth >= 5) return "[truncated]";
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeArtifactPayload(entry, secrets, depth + 1));
  }
  if (typeof value === "object") {
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
      const sanitized = sanitizeArtifactPayload(nested, secrets, depth + 1);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    }
    return result;
  }
  return redactSensitiveText(String(value), secrets);
}

function ensureDiagnosticsDir() {
  fs.mkdirSync(LOGIN_DIAGNOSTICS_DIR, { recursive: true });
}

function rotateArtifacts() {
  try {
    ensureDiagnosticsDir();
    const files = fs
      .readdirSync(LOGIN_DIAGNOSTICS_DIR)
      .map((name) => {
        const filePath = path.join(LOGIN_DIAGNOSTICS_DIR, name);
        const stats = fs.statSync(filePath);
        return { name, filePath, mtimeMs: stats.mtimeMs, isFile: stats.isFile() };
      })
      .filter((entry) => entry.isFile)
      .sort((left, right) => right.mtimeMs - left.mtimeMs);

    for (const stale of files.slice(Math.max(0, LOGIN_DIAGNOSTICS_MAX_ARTIFACTS))) {
      fs.unlinkSync(stale.filePath);
    }
  } catch {
    // Diagnostics should never block auth.
  }
}

function writeLoginAttemptArtifact({ loginAttemptId, stage, classifier, payload, secrets = [] }) {
  try {
    ensureDiagnosticsDir();
    rotateArtifacts();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${timestamp}-${loginAttemptId}-${stage}.json`;
    const filePath = path.join(LOGIN_DIAGNOSTICS_DIR, fileName);
    const sanitized = sanitizeArtifactPayload(
      {
        loginAttemptId,
        stage,
        classifier,
        capturedAt: new Date().toISOString(),
        payload,
      },
      secrets
    );
    fs.writeFileSync(filePath, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
    return filePath;
  } catch {
    return "";
  }
}

function createLoginAttemptTrace({ loginAttemptId, sessionId = "", secrets = [] }) {
  const traceId = String(loginAttemptId || createLoginAttemptId()).trim() || createLoginAttemptId();
  const traceSecrets = Array.from(new Set([sessionId, ...secrets].filter(Boolean)));

  function recordStage({
    stage,
    startedAt,
    classifier = "",
    httpStatus = 0,
    finalUrl = "",
    storageStateBefore = null,
    storageStateAfter = null,
    error = null,
    artifactPayload = null,
  }) {
    const artifactPath = artifactPayload
      ? writeLoginAttemptArtifact({
          loginAttemptId: traceId,
          stage,
          classifier,
          payload: artifactPayload,
          secrets: traceSecrets,
        })
      : "";

    log({
      level: error ? "warn" : "info",
      msg: "ERP login stage",
      loginAttemptId: traceId,
      stage,
      durationMs: startedAt ? Number((Date.now() - startedAt).toFixed(2)) : undefined,
      classifier: classifier || undefined,
      httpStatus: httpStatus || undefined,
      finalUrl: finalUrl || undefined,
      cookieNamesBefore: toCookieNames(storageStateBefore),
      cookieNamesAfter: toCookieNames(storageStateAfter),
      artifactPath: artifactPath || undefined,
      errorCode: error?.code || undefined,
      errorMessage: error?.message || undefined,
    });

    return artifactPath;
  }

  function finish({ outcome, statusCode, errorCode = "", profileStatus = "", classifier = "" }) {
    log({
      level: outcome === "success" ? "info" : "warn",
      msg: "ERP login summary",
      loginAttemptId: traceId,
      outcome,
      statusCode: statusCode || undefined,
      errorCode: errorCode || undefined,
      profileStatus: profileStatus || undefined,
      classifier: classifier || undefined,
    });
  }

  return {
    loginAttemptId: traceId,
    recordStage,
    finish,
  };
}

module.exports = {
  createLoginAttemptId,
  createLoginAttemptTrace,
  redactSensitiveText,
  sanitizeArtifactPayload,
  toCookieNames,
  writeLoginAttemptArtifact,
};
