/**
 * googleOAuth.js — Google OAuth 2.0 + Calendar config (Batch B10 / T6.3.1).
 *
 * Dependency-free: raw fetch against Google's token endpoint. Everything is
 * inert until GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT
 * are set — `isConfigured()` gates every route and the Settings card.
 *
 * Scopes: `calendar.events` (create/update/delete the events we own) — NOT
 * full `calendar`. We keep our events in a dedicated secondary calendar so a
 * disconnect can remove exactly what we made.
 */

const CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  redirectUri: process.env.GOOGLE_OAUTH_REDIRECT || "",
};

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist",
];
// Batch B12 — Classroom read-only. These are RESTRICTED scopes: they require
// Google app verification AND that SRM AP is on Google Workspace for Education
// (T6.6.0). Off unless GOOGLE_CLASSROOM_ENABLED=1, so we never ask for them by
// accident.
const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
];

function classroomEnabled() {
  return String(process.env.GOOGLE_CLASSROOM_ENABLED || "") === "1";
}

/** The scopes to request at consent — union of the enabled Google integrations. */
function requestedScopes() {
  return classroomEnabled() ? [...CALENDAR_SCOPES, ...CLASSROOM_SCOPES] : [...CALENDAR_SCOPES];
}

const SCOPES = CALENDAR_SCOPES; // back-compat export
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

function isConfigured() {
  return Boolean(CONFIG.clientId && CONFIG.clientSecret && CONFIG.redirectUri);
}

/** Classroom is a further opt-in on top of a configured OAuth client. */
function isClassroomConfigured() {
  return isConfigured() && classroomEnabled();
}

function getConfig() {
  return { ...CONFIG, scopes: requestedScopes() };
}

/** Consent-screen URL. `state` is an opaque signed value carrying the userId. */
function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: CONFIG.clientId,
    redirect_uri: CONFIG.redirectUri,
    response_type: "code",
    scope: requestedScopes().join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent", // force a refresh_token every time
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** @returns {Promise<{ access_token, refresh_token?, expires_in, scope, token_type }>} */
async function exchangeCode(code, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CONFIG.clientId,
      client_secret: CONFIG.clientSecret,
      redirect_uri: CONFIG.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Google token exchange failed: ${json.error_description || json.error || res.status}`);
    err.status = 502;
    throw err;
  }
  return json;
}

async function refreshAccessToken(refreshToken, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CONFIG.clientId,
      client_secret: CONFIG.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Google token refresh failed: ${json.error_description || json.error || res.status}`);
    err.status = json.error === "invalid_grant" ? 401 : 502;
    err.code = json.error;
    throw err;
  }
  return json; // { access_token, expires_in, scope, token_type }
}

async function revokeToken(token, { fetchImpl = fetch } = {}) {
  try {
    await fetchImpl(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, { method: "POST" });
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  isConfigured,
  isClassroomConfigured,
  classroomEnabled,
  requestedScopes,
  getConfig,
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  revokeToken,
  SCOPES,
  CALENDAR_SCOPES,
  CLASSROOM_SCOPES,
};
