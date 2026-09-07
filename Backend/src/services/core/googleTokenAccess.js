/**
 * googleTokenAccess.js — shared "give me a valid access token, refreshing if
 * needed" helper for every Google integration (Calendar B10, Classroom B12).
 *
 * @module core/googleTokenAccess
 */

const oauth = require("../../config/googleOAuth");

/**
 * @param {import("./googleTokenStore").GoogleTokenStore} tokenStore
 * @param {string} userId
 * @param {Function} [fetchImpl]
 * @returns {Promise<string>} a live access token
 */
async function validAccessToken(tokenStore, userId, fetchImpl = fetch) {
  const conn = tokenStore.get(userId);
  if (!conn) throw Object.assign(new Error("Not connected to Google"), { status: 409 });

  const expiringSoon = !conn.expiresAt || Date.parse(conn.expiresAt) - Date.now() < 60_000;
  if (!expiringSoon && conn.accessToken) return conn.accessToken;

  if (!conn.refreshToken) throw Object.assign(new Error("No refresh token; reconnect required"), { status: 401 });
  const refreshed = await oauth.refreshAccessToken(conn.refreshToken, { fetchImpl });
  const expiresAt = new Date(Date.now() + (Number(refreshed.expires_in) || 3600) * 1000).toISOString();
  tokenStore.save(userId, { accessToken: refreshed.access_token, expiresAt, scope: refreshed.scope });
  return refreshed.access_token;
}

module.exports = { validAccessToken };
