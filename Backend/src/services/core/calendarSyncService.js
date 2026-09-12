/**
 * calendarSyncService.js — one-way sync of the student's ERP timetable and
 * deadlines into a dedicated Google Calendar (Batch B10 / Story 6.3).
 *
 * Design:
 *  - We create ONE secondary calendar per user ("University — <name>"). Every
 *    event we make lives there and carries `extendedProperties.private.erpKey`,
 *    so a re-sync is an idempotent upsert and a disconnect can delete exactly
 *    what we created (calendar and all) — T6.3.4.
 *  - Timetable periods become weekly-recurring events; deadlines / fee dues /
 *    event registrations become one-off events.
 *  - Everything routes through `google/*` (raw fetch); nothing here runs unless
 *    `googleOAuth.isConfigured()`.
 *
 * @module core/calendarSyncService
 */

const crypto = require("crypto");
const oauth = require("../../config/googleOAuth");
const { validAccessToken } = require("./googleTokenAccess");

const CAL_API = "https://www.googleapis.com/calendar/v3";
const TZ = "Asia/Kolkata";
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

class CalendarSyncService {
  /**
   * @param {object} deps
   * @param {import("./googleTokenStore").GoogleTokenStore} deps.tokenStore
   * @param {Function} [deps.fetchImpl]
   * @param {Function} [deps.log]
   */
  constructor({ tokenStore, fetchImpl = fetch, log = () => {} } = {}) {
    if (!tokenStore) throw new Error("CalendarSyncService requires a tokenStore");
    this.tokenStore = tokenStore;
    this.fetch = fetchImpl;
    this.log = log;
  }

  available() {
    return oauth.isConfigured();
  }

  /* ---------- OAuth state (signed) ---------- */

  _stateSecret() {
    const secret = String(process.env.GOOGLE_OAUTH_STATE_KEY || "");
    if (secret.length >= 32) return secret;
    if (process.env.NODE_ENV === "production") {
      throw Object.assign(new Error("GOOGLE_OAUTH_STATE_KEY must be configured in production"), { status: 503 });
    }
    if (!this._developmentStateSecret) this._developmentStateSecret = crypto.randomBytes(32).toString("hex");
    return this._developmentStateSecret;
  }

  buildAuthUrl(userId, { sessionId } = {}) {
    if (!this.available()) throw Object.assign(new Error("Google Calendar is not configured"), { status: 503 });
    if (!sessionId) throw Object.assign(new Error("Authenticated session required for Google connection"), { status: 401 });
    const nonce = crypto.randomBytes(32).toString("base64url");
    const nonceHash = crypto.createHash("sha256").update(nonce).digest("hex");
    const expiresAt = Date.now() + OAUTH_STATE_TTL_MS;
    this.tokenStore.createOAuthState({ nonceHash, userId, sessionId, expiresAt });
    const payload = `${nonce}.${expiresAt}`;
    const sig = crypto.createHmac("sha256", this._stateSecret()).update(payload).digest("base64url");
    return oauth.buildAuthUrl(`${payload}.${sig}`);
  }

  _verifyState(state, sessionId) {
    const parts = String(state || "").split(".");
    if (parts.length !== 3) return null;
    const [nonce, expiresAtRaw, sig] = parts;
    const expiresAt = Number(expiresAtRaw);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
    const expected = crypto
      .createHmac("sha256", this._stateSecret())
      .update(`${nonce}.${expiresAt}`)
      .digest("base64url");
    const signature = Buffer.from(sig);
    const expectedSignature = Buffer.from(expected);
    if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(signature, expectedSignature)) return null;
    const record = this.tokenStore.consumeOAuthState(crypto.createHash("sha256").update(nonce).digest("hex"));
    if (!record || record.expiresAt !== expiresAt || record.sessionId !== String(sessionId || "")) return null;
    return record.userId;
  }

  /* ---------- connect / disconnect ---------- */

  async handleCallback({ code, state, sessionId }) {
    const userId = this._verifyState(state, sessionId);
    if (!userId) throw Object.assign(new Error("Invalid OAuth state"), { status: 400 });

    const tokens = await oauth.exchangeCode(code, { fetchImpl: this.fetch });
    const expiresAt = new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString();
    this.tokenStore.save(userId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scope: tokens.scope,
    });
    await this._ensureCalendar(userId);
    return { connected: true, userId };
  }

  async disconnect(userId) {
    const conn = this.tokenStore.get(userId);
    if (!conn) return { disconnected: true };

    try {
      const accessToken = await this._validAccessToken(userId);
      if (conn.calendarId) {
        // Deleting the secondary calendar removes every event we put in it.
        await this._api(`DELETE`, `/calendars/${encodeURIComponent(conn.calendarId)}`, accessToken).catch(() => {});
      } else {
        for (const item of this.tokenStore.listSyncedItems(userId)) {
          await this._api("DELETE", `/calendars/primary/events/${item.event_id}`, accessToken).catch(() => {});
        }
      }
      if (conn.refreshToken) await oauth.revokeToken(conn.refreshToken, { fetchImpl: this.fetch });
    } catch (error) {
      this.log({ level: "warn", msg: "Google disconnect cleanup partial", userId, error: error?.message });
    }

    this.tokenStore.delete(userId);
    return { disconnected: true };
  }

  status(userId) {
    if (!this.available()) return { available: false, connected: false };
    const conn = this.tokenStore.get(userId);
    return {
      available: true,
      connected: Boolean(conn),
      calendarId: conn?.calendarId || null,
      lastSyncAt: conn?.lastSyncAt || null,
      lastSyncStatus: conn?.lastSyncStatus || null,
      syncedCount: conn ? this.tokenStore.listSyncedItems(userId).length : 0,
    };
  }

  /* ---------- token / api helpers ---------- */

  _validAccessToken(userId) {
    return validAccessToken(this.tokenStore, userId, this.fetch);
  }

  async _api(method, pathPart, accessToken, body) {
    const res = await this.fetch(`${CAL_API}${pathPart}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return {};
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`Calendar API ${method} ${pathPart} → ${res.status}: ${json.error?.message || ""}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  async _ensureCalendar(userId) {
    const conn = this.tokenStore.get(userId);
    if (conn?.calendarId) return conn.calendarId;
    const accessToken = await this._validAccessToken(userId);
    const created = await this._api("POST", "/calendars", accessToken, {
      summary: "University ERP",
      description: "Timetable and deadlines synced from the University ERP companion app.",
      timeZone: TZ,
    });
    this.tokenStore.setCalendarId(userId, created.id);
    return created.id;
  }

  /* ---------- sync ---------- */

  /**
   * Upsert one event by its stable erpKey.
   * @returns {Promise<string>} the Google event id
   */
  async _upsertEvent(userId, calendarId, accessToken, erpKey, kind, resource) {
    const existing = this.tokenStore.getSyncedItem(userId, erpKey);
    const payload = {
      ...resource,
      extendedProperties: { private: { erpKey, source: "university-erp" } },
    };
    let event;
    if (existing) {
      event = await this._api(
        "PATCH",
        `/calendars/${encodeURIComponent(calendarId)}/events/${existing.event_id}`,
        accessToken,
        payload,
      ).catch(async (e) => {
        if (e.status === 404 || e.status === 410) {
          this.tokenStore.deleteSyncedItem(userId, erpKey);
          return this._api("POST", `/calendars/${encodeURIComponent(calendarId)}/events`, accessToken, payload);
        }
        throw e;
      });
    } else {
      event = await this._api("POST", `/calendars/${encodeURIComponent(calendarId)}/events`, accessToken, payload);
    }
    this.tokenStore.putSyncedItem(userId, erpKey, event.id, kind);
    return event.id;
  }

  /** Remove synced items of `kind` whose erpKey is no longer present. */
  async _prune(userId, calendarId, accessToken, kind, keepKeys) {
    for (const item of this.tokenStore.listSyncedItems(userId, kind)) {
      if (keepKeys.has(item.erp_key)) continue;
      await this._api(
        "DELETE",
        `/calendars/${encodeURIComponent(calendarId)}/events/${item.event_id}`,
        accessToken,
      ).catch(() => {});
      this.tokenStore.deleteSyncedItem(userId, item.erp_key);
    }
  }

  /**
   * @param {string} userId
   * @param {{ schedule: Array<{day, periods: string[]}>, timeSlots: string[] }} timetable
   */
  async syncTimetable(userId, timetable) {
    if (!timetable?.schedule?.length) return { upserted: 0 };
    const accessToken = await this._validAccessToken(userId);
    const calendarId = await this._ensureCalendar(userId);
    const timeSlots = Array.isArray(timetable.timeSlots) ? timetable.timeSlots : [];

    const pending = [];
    for (const row of timetable.schedule) {
      const dayIdx = WEEKDAYS.indexOf(String(row.day || "").toLowerCase());
      if (dayIdx < 0) continue;
      (row.periods || []).forEach((label, i) => {
        const text = String(label || "").trim();
        const slot = parseSlot(timeSlots[i]);
        if (!text || !slot) return;
        const start = nextWeekdayAt(dayIdx, slot.startH, slot.startM);
        const end = nextWeekdayAt(dayIdx, slot.endH, slot.endM, start);
        pending.push({
          erpKey: `tt:${WEEKDAYS[dayIdx]}:${i}`,
          resource: {
            summary: text,
            start: { dateTime: start.toISOString(), timeZone: TZ },
            end: { dateTime: end.toISOString(), timeZone: TZ },
            recurrence: ["RRULE:FREQ=WEEKLY"],
            reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] },
          },
        });
      });
    }

    const keep = new Set(pending.map((p) => p.erpKey));
    for (const p of pending) {
      // sequential — keeps us well under Calendar API rate limits
      // eslint-disable-next-line no-await-in-loop
      await this._upsertEvent(userId, calendarId, accessToken, p.erpKey, "timetable", p.resource);
    }
    await this._prune(userId, calendarId, accessToken, "timetable", keep);
    this.tokenStore.recordSync(userId, `timetable ok (${pending.length})`);
    return { upserted: pending.length };
  }

  /**
   * @param {string} userId
   * @param {Array<{ erpKey: string, title: string, date: string, description?: string }>} items
   */
  async syncDeadlines(userId, items = []) {
    const accessToken = await this._validAccessToken(userId);
    const calendarId = await this._ensureCalendar(userId);
    const keep = new Set();
    let upserted = 0;

    for (const item of items) {
      const when = Date.parse(item.date);
      if (!Number.isFinite(when)) continue;
      const erpKey = item.erpKey;
      keep.add(erpKey);
      const start = new Date(when);
      const end = new Date(when + 30 * 60 * 1000);
      // eslint-disable-next-line no-await-in-loop
      await this._upsertEvent(userId, calendarId, accessToken, erpKey, "deadline", {
        summary: item.title,
        description: item.description || "",
        start: { dateTime: start.toISOString(), timeZone: TZ },
        end: { dateTime: end.toISOString(), timeZone: TZ },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 24 * 60 }, { method: "popup", minutes: 60 }] },
      });
      upserted++;
    }
    await this._prune(userId, calendarId, accessToken, "deadline", keep);
    this.tokenStore.recordSync(userId, `deadlines ok (${upserted})`);
    return { upserted };
  }

  /**
   * Periodic re-sync for every connected user.
   * @param {object} sources
   * @param {object} [sources.erpAcademicSnapshotStore]  provides getTimetable(userKey)
   * @param {object} [sources.careerStore]               provides getBookmarkDeadlineReminderCandidates(days)
   */
  async runSyncCycle({ erpAcademicSnapshotStore = null, careerStore = null } = {}) {
    if (!this.available()) return { users: 0 };
    const userIds = this.tokenStore.listConnectedUserIds();
    let synced = 0;
    for (const userId of userIds) {
      try {
        const timetable = erpAcademicSnapshotStore?.getTimetable?.(userId);
        if (timetable) {
          // eslint-disable-next-line no-await-in-loop
          await this.syncTimetable(userId, timetable);
        }
        if (careerStore?.getBookmarkDeadlineReminderCandidates) {
          const deadlines = careerStore
            .getBookmarkDeadlineReminderCandidates(30)
            .filter((r) => r.userId === userId && r.deadline)
            .map((r) => ({
              erpKey: `dl:opp:${r.opportunityId}`,
              title: `Closes: ${r.title}`,
              date: r.deadline,
              description: "Saved opportunity deadline, from the University ERP companion app.",
            }));
          if (deadlines.length) {
            // eslint-disable-next-line no-await-in-loop
            await this.syncDeadlines(userId, deadlines);
          }
        }
        synced++;
      } catch (error) {
        this.tokenStore.recordSync(userId, `error: ${error?.message || error}`);
        this.log({ level: "warn", msg: "Google sync cycle: user failed", userId, error: error?.message });
      }
    }
    return { users: synced };
  }
}

/* ---------- time helpers ---------- */

/** "09:00 To 09:50" | "09:00-09:50" -> { startH, startM, endH, endM } */
function parseSlot(text) {
  if (!text) return null;
  const m = String(text).match(/(\d{1,2})[:.](\d{2})\s*(?:to|-|–|—)\s*(\d{1,2})[:.](\d{2})/i);
  if (!m) return null;
  const [, sh, sm, eh, em] = m.map(Number);
  // ERP prints afternoon slots on a 12h clock without am/pm; assume classes
  // run 08:00–18:00 IST and bump an end that would otherwise precede the start.
  let startH = sh;
  let endH = eh;
  if (startH < 8) startH += 12;
  if (endH < 8) endH += 12;
  if (endH * 60 + em <= startH * 60 + sm) endH += 12;
  return { startH, startM: sm, endH, endM: em };
}

/** Next occurrence (from `after`, default now) of `weekdayIdx` at hh:mm IST. */
function nextWeekdayAt(weekdayIdx, hh, mm, after = new Date()) {
  // Work in IST by offsetting UTC by +5:30.
  const istNow = new Date(after.getTime() + 5.5 * 3600_000);
  const result = new Date(istNow);
  const delta = (weekdayIdx - istNow.getUTCDay() + 7) % 7;
  result.setUTCDate(istNow.getUTCDate() + delta);
  result.setUTCHours(hh, mm, 0, 0);
  if (result <= istNow) result.setUTCDate(result.getUTCDate() + 7);
  // Back to a real UTC instant.
  return new Date(result.getTime() - 5.5 * 3600_000);
}

module.exports = { CalendarSyncService, parseSlot, nextWeekdayAt };
