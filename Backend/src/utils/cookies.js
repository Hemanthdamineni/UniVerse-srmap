const {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_SECURE,
  SESSION_COOKIE_SAME_SITE,
  SESSION_TTL_MS,
  FEATURE_AUTH_COOKIE_MODE,
  LEGACY_SESSION_ID_CUTOFF_DATE,
  NODE_ENV,
} = require("../config/env");

const LEGACY_SESSION_ID_CUTOFF_MS = Date.parse(LEGACY_SESSION_ID_CUTOFF_DATE);

function parseCookieHeader(raw) {
  const cookies = {};
  if (!raw || typeof raw !== "string") return cookies;

  const parts = raw.split(";");
  for (const part of parts) {
    const [name, ...rest] = part.split("=");
    const key = String(name || "").trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(rest.join("=") || "");
  }
  return cookies;
}

function getCookies(req) {
  return parseCookieHeader(req?.headers?.cookie || "");
}

function resolveSessionId(req) {
  const cookies = getCookies(req);
  const cookieSession = String(cookies[SESSION_COOKIE_NAME] || "").trim();
  if (cookieSession) return cookieSession;

  const legacySessionAllowed =
    Number.isNaN(LEGACY_SESSION_ID_CUTOFF_MS) || Date.now() < LEGACY_SESSION_ID_CUTOFF_MS;
  if (!legacySessionAllowed) return "";

  const headerSession = String(req?.header?.("x-session-id") || "").trim();
  if (headerSession) return headerSession;

  const querySession = String(req?.query?.sessionId || "").trim();
  if (querySession) return querySession;

  const bodySession = String(req?.body?.sessionId || "").trim();
  if (bodySession) return bodySession;

  return "";
}

function shouldUseSecureCookie(req) {
  if (SESSION_COOKIE_SECURE === "true") return true;
  if (SESSION_COOKIE_SECURE === "false") return false;

  const xForwardedProto = String(req?.header?.("x-forwarded-proto") || "").toLowerCase();
  if (xForwardedProto.includes("https")) return true;

  if (req?.secure) return true;

  return NODE_ENV === "production";
}

function setSessionCookie(res, req, sessionId) {
  if (!FEATURE_AUTH_COOKIE_MODE) return;
  const maxAge = Math.max(1000, SESSION_TTL_MS);
  const sameSite = ["strict", "lax", "none"].includes(String(SESSION_COOKIE_SAME_SITE).toLowerCase())
    ? String(SESSION_COOKIE_SAME_SITE).toLowerCase()
    : "lax";

  res.cookie?.(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: shouldUseSecureCookie(req),
    sameSite,
    maxAge,
    path: "/",
  });
}

function clearSessionCookie(res, req) {
  if (!FEATURE_AUTH_COOKIE_MODE) return;
  const sameSite = ["strict", "lax", "none"].includes(String(SESSION_COOKIE_SAME_SITE).toLowerCase())
    ? String(SESSION_COOKIE_SAME_SITE).toLowerCase()
    : "lax";

  res.clearCookie?.(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: shouldUseSecureCookie(req),
    sameSite,
    path: "/",
  });
}

module.exports = {
  getCookies,
  resolveSessionId,
  setSessionCookie,
  clearSessionCookie,
};
