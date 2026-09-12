const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

// Must be set before googleOAuth is required (it reads env at load time).
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";
process.env.GOOGLE_OAUTH_REDIRECT = "https://erp.test/api/integrations/google/callback";
process.env.GOOGLE_TOKEN_ENC_KEY = "a".repeat(64);
process.env.GOOGLE_OAUTH_STATE_KEY = "calendar-state-test-key-with-at-least-thirty-two-bytes";
process.env.ADMIN_REGISTER_NUMBERS = "AP23110010419";

const oauth = require("../src/config/googleOAuth");
const { GoogleTokenStore } = require("../src/services/core/googleTokenStore");
const {
  CalendarSyncService,
  parseSlot,
  nextWeekdayAt,
} = require("../src/services/core/calendarSyncService");
const { createGoogleCalendarRoutes } = require("../src/routes/googleCalendarRoutes");

function freshTokenStore() {
  return new GoogleTokenStore({
    dbPath: path.join(os.tmpdir(), `gtok-${process.pid}-${Date.now()}-${Math.random()}.sqlite`),
  });
}

/** Mock Google endpoints. Tracks Calendar API calls for assertions. */
function mockGoogle({ tokenResponses = {} } = {}) {
  const calls = [];
  let eventSeq = 0;
  const parseBody = (body) => {
    if (!body) return null;
    if (typeof body !== "string") return body; // URLSearchParams etc.
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  };
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", body: parseBody(opts.body) });

    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      const grant = new URLSearchParams(opts.body).get("grant_type");
      const payload =
        grant === "refresh_token"
          ? tokenResponses.refresh || { access_token: "acc-refreshed", expires_in: 3600, scope: "s", token_type: "Bearer" }
          : tokenResponses.exchange || {
              access_token: "acc-1",
              refresh_token: "ref-1",
              expires_in: 3600,
              scope: "s",
              token_type: "Bearer",
            };
      return { ok: true, status: 200, json: async () => payload };
    }
    if (url.startsWith("https://oauth2.googleapis.com/revoke")) {
      return { ok: true, status: 200, json: async () => ({}) };
    }
    // Calendar API
    if (url.includes("/calendar/v3/calendars") && (opts.method || "GET") === "POST" && url.endsWith("/calendars")) {
      return { ok: true, status: 200, json: async () => ({ id: "cal-erp-1" }) };
    }
    if (url.includes("/events") && opts.method === "POST") {
      eventSeq += 1;
      return { ok: true, status: 200, json: async () => ({ id: `evt-${eventSeq}` }) };
    }
    if (url.includes("/events/") && opts.method === "PATCH") {
      return { ok: true, status: 200, json: async () => ({ id: url.split("/events/")[1] }) };
    }
    if (opts.method === "DELETE") {
      return { ok: true, status: 204, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  };
  return { fetchImpl, calls };
}

const TIMETABLE = {
  schedule: [
    { day: "Monday", periods: ["CSE 304 (C 705)", "", "CSE 306 (V 403)"] },
    { day: "Tuesday", periods: ["MCE 244 (C 705)"] },
  ],
  timeSlots: ["09:00 To 09:50", "10:00 To 10:50", "11:00 To 11:50"],
};

/* ---------- oauth config ---------- */

test("buildAuthUrl carries client id, calendar scope, offline access, and state", () => {
  const url = oauth.buildAuthUrl("state-abc");
  assert.match(url, /client_id=test-client-id/);
  assert.match(url, /scope=[^&]*calendar\.events/);
  assert.match(url, /access_type=offline/);
  assert.match(url, /state=state-abc/);
  assert.equal(oauth.isConfigured(), true);
});

test("exchangeCode and refreshAccessToken hit the token endpoint", async () => {
  const { fetchImpl } = mockGoogle();
  const t = await oauth.exchangeCode("code-1", { fetchImpl });
  assert.equal(t.access_token, "acc-1");
  assert.equal(t.refresh_token, "ref-1");
  const r = await oauth.refreshAccessToken("ref-1", { fetchImpl });
  assert.equal(r.access_token, "acc-refreshed");
});

/* ---------- token store ---------- */

test("token store encrypts at rest and round-trips", () => {
  const store = freshTokenStore();
  store.save("u1", { accessToken: "AAA", refreshToken: "RRR", expiresAt: "2030-01-01T00:00:00Z", scope: "s" });
  const raw = store.db.prepare("SELECT access_enc, refresh_enc FROM google_tokens WHERE user_id = 'u1'").get();
  assert.notEqual(raw.access_enc, "AAA");
  assert.match(raw.access_enc, /\..+\./); // iv.tag.ct
  const got = store.get("u1");
  assert.equal(got.accessToken, "AAA");
  assert.equal(got.refreshToken, "RRR");
  // partial save keeps the refresh token
  store.save("u1", { accessToken: "BBB", expiresAt: "2030-02-01T00:00:00Z" });
  assert.equal(store.get("u1").refreshToken, "RRR");
});

test("synced-item bookkeeping", () => {
  const store = freshTokenStore();
  store.save("u1", { accessToken: "a" });
  store.putSyncedItem("u1", "tt:monday:0", "evt-1", "timetable");
  const item = store.getSyncedItem("u1", "tt:monday:0");
  assert.equal(item.event_id, "evt-1");
  assert.equal(item.kind, "timetable");
  assert.equal(store.listSyncedItems("u1", "timetable").length, 1);
  store.deleteSyncedItem("u1", "tt:monday:0");
  assert.equal(store.listSyncedItems("u1").length, 0);
});

/* ---------- sync service ---------- */

test("OAuth state is signed, one-time, expiring, and session-bound", () => {
  const svc = new CalendarSyncService({ tokenStore: freshTokenStore() });
  const url = svc.buildAuthUrl("AP23110010001", { sessionId: "session-a" });
  const state = new URL(url).searchParams.get("state");
  assert.equal(svc._verifyState(state, "session-a"), "AP23110010001");
  assert.equal(svc._verifyState(state, "session-a"), null, "the consumed nonce cannot replay");
  const second = new URL(svc.buildAuthUrl("AP23110010001", { sessionId: "session-a" })).searchParams.get("state");
  assert.equal(svc._verifyState(second, "wrong-session"), null);
  assert.equal(svc._verifyState(state.slice(0, -2) + "xx"), null);
  assert.equal(svc._verifyState("garbage"), null);
});

test("handleCallback exchanges the code, stores tokens, and creates the ERP calendar", async () => {
  const store = freshTokenStore();
  const { fetchImpl, calls } = mockGoogle();
  const svc = new CalendarSyncService({ tokenStore: store, fetchImpl });
  const state = new URL(svc.buildAuthUrl("u1", { sessionId: "session-u1" })).searchParams.get("state");

  const res = await svc.handleCallback({ code: "code-1", state, sessionId: "session-u1" });
  assert.equal(res.connected, true);
  assert.equal(store.get("u1").calendarId, "cal-erp-1");
  assert.ok(calls.some((c) => c.method === "POST" && c.url.endsWith("/calendars")));
});

test("syncTimetable creates events, is idempotent, and prunes removed periods", async () => {
  const store = freshTokenStore();
  const { fetchImpl, calls } = mockGoogle();
  const svc = new CalendarSyncService({ tokenStore: store, fetchImpl });
  const state = new URL(svc.buildAuthUrl("u1", { sessionId: "session-u1" })).searchParams.get("state");
  await svc.handleCallback({ code: "c", state, sessionId: "session-u1" });
  calls.length = 0;

  const first = await svc.syncTimetable("u1", TIMETABLE);
  assert.equal(first.upserted, 3); // Mon 0, Mon 2, Tue 0 (blank period skipped)
  assert.equal(calls.filter((c) => c.method === "POST" && c.url.includes("/events")).length, 3);
  assert.equal(store.listSyncedItems("u1", "timetable").length, 3);

  calls.length = 0;
  await svc.syncTimetable("u1", TIMETABLE);
  assert.equal(calls.filter((c) => c.method === "PATCH").length, 3); // updates, not new
  assert.equal(calls.filter((c) => c.method === "POST" && c.url.includes("/events")).length, 0);

  // Drop Tuesday -> that event should be deleted on the next sync.
  calls.length = 0;
  await svc.syncTimetable("u1", { ...TIMETABLE, schedule: [TIMETABLE.schedule[0]] });
  assert.equal(calls.filter((c) => c.method === "DELETE").length, 1);
  assert.equal(store.listSyncedItems("u1", "timetable").length, 2);
});

test("syncDeadlines creates one-off events with reminders", async () => {
  const store = freshTokenStore();
  const { fetchImpl, calls } = mockGoogle();
  const svc = new CalendarSyncService({ tokenStore: store, fetchImpl });
  const state = new URL(svc.buildAuthUrl("u1", { sessionId: "session-u1" })).searchParams.get("state");
  await svc.handleCallback({ code: "c", state, sessionId: "session-u1" });
  calls.length = 0;

  const r = await svc.syncDeadlines("u1", [
    { erpKey: "dl:opp:o1", title: "Closes: Frontend Internship", date: "2026-10-01T18:00:00Z" },
  ]);
  assert.equal(r.upserted, 1);
  const post = calls.find((c) => c.method === "POST" && c.url.includes("/events"));
  assert.ok(post.body.reminders.overrides.length >= 1);
  assert.equal(post.body.extendedProperties.private.erpKey, "dl:opp:o1");
});

test("disconnect deletes our calendar, revokes, and clears the store", async () => {
  const store = freshTokenStore();
  const { fetchImpl, calls } = mockGoogle();
  const svc = new CalendarSyncService({ tokenStore: store, fetchImpl });
  const state = new URL(svc.buildAuthUrl("u1", { sessionId: "session-u1" })).searchParams.get("state");
  await svc.handleCallback({ code: "c", state, sessionId: "session-u1" });
  await svc.syncTimetable("u1", TIMETABLE);
  calls.length = 0;

  const res = await svc.disconnect("u1");
  assert.equal(res.disconnected, true);
  assert.ok(calls.some((c) => c.method === "DELETE" && c.url.includes("/calendars/cal-erp-1")));
  assert.ok(calls.some((c) => c.url.includes("/revoke")));
  assert.equal(store.isConnected("u1"), false);
  assert.equal(store.listSyncedItems("u1").length, 0);
});

test("refreshes an expired access token before an API call", async () => {
  const store = freshTokenStore();
  const { fetchImpl, calls } = mockGoogle();
  const svc = new CalendarSyncService({ tokenStore: store, fetchImpl });
  store.save("u1", {
    accessToken: "stale",
    refreshToken: "ref-1",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
    calendarId: "cal-erp-1",
  });
  await svc.syncDeadlines("u1", []);
  assert.ok(
    calls.some((c) => c.url.startsWith("https://oauth2.googleapis.com/token")),
    "token endpoint was called to refresh",
  );
  assert.equal(store.get("u1").accessToken, "acc-refreshed");
});

/* ---------- helpers ---------- */

test("parseSlot handles ERP time strings incl. 12h afternoon slots", () => {
  assert.deepEqual(parseSlot("09:00 To 09:50"), { startH: 9, startM: 0, endH: 9, endM: 50 });
  // "01:00 To 01:50" is really 13:00–13:50
  assert.deepEqual(parseSlot("01:00 To 01:50"), { startH: 13, startM: 0, endH: 13, endM: 50 });
  assert.equal(parseSlot("no times here"), null);
});

test("nextWeekdayAt returns a future instant on the right weekday", () => {
  const d = nextWeekdayAt(1, 9, 0); // Monday 09:00 IST
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  assert.equal(ist.getUTCDay(), 1);
  assert.ok(d.getTime() > Date.now());
});

/* ---------- routes ---------- */

function invokeRouter(router, { method = "GET", url, headers = {}, body = {} }) {
  return new Promise((resolve, reject) => {
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const parsed = new URL(url, "http://localhost");
    const req = {
      method, url: `${parsed.pathname}${parsed.search}`, originalUrl: `${parsed.pathname}${parsed.search}`,
      baseUrl: "", path: parsed.pathname, headers: lower, body,
      query: Object.fromEntries(parsed.searchParams.entries()),
      header: (n) => lower[String(n).toLowerCase()] || "", get: (n) => lower[String(n).toLowerCase()] || "",
    };
    const res = {
      statusCode: 200, headers: {},
      setHeader(n, v) { this.headers[n.toLowerCase()] = v; },
      status(c) { this.statusCode = c; return this; },
      json(p) { resolve({ status: this.statusCode, body: p }); return this; },
      send(p) { resolve({ status: this.statusCode, body: p }); return this; },
      redirect(loc) { this.statusCode = 302; this.headers.location = loc; resolve({ status: 302, body: null, location: loc }); },
    };
    router.handle(req, res, (err) => (err ? reject(err) : resolve({ status: res.statusCode, body: null })));
  });
}

test("routes: status, connect, callback redirect, disconnect", async () => {
  const store = freshTokenStore();
  const { fetchImpl } = mockGoogle();
  const svc = new CalendarSyncService({ tokenStore: store, fetchImpl });
  const router = createGoogleCalendarRoutes({
    calendarSyncService: svc,
    appBaseUrl: "https://erp.test",
    sessionStore: {
      async getOrThrow(id) {
        if (id !== "s1") throw new Error("no session");
        return { loggedIn: true, profileData: { TableContent: { "Register No.": "AP1", "Program / Section": "B.Tech CSE / A" } } };
      },
    },
    adminPassword: "x",
  });
  const auth = { cookie: "erp_session=s1" };

  assert.equal((await invokeRouter(router, { url: "/integrations/google/status" })).status, 401);

  const status = await invokeRouter(router, { url: "/integrations/google/status", headers: auth });
  assert.equal(status.body.available, true);
  assert.equal(status.body.connected, false);

  const connect = await invokeRouter(router, { url: "/integrations/google/connect", headers: auth });
  assert.match(connect.body.url, /accounts\.google\.com/);
  const state = new URL(connect.body.url).searchParams.get("state");

  const cb = await invokeRouter(router, {
    url: `/integrations/google/callback?code=c&state=${encodeURIComponent(state)}`,
    headers: auth,
  });
  assert.equal(cb.status, 302);
  assert.match(cb.location, /settings\?google=connected/);
  assert.equal(store.isConnected("AP1"), true);

  const disc = await invokeRouter(router, { method: "POST", url: "/integrations/google/disconnect", headers: auth });
  assert.equal(disc.body.disconnected, true);
  assert.equal(store.isConnected("AP1"), false);
});
