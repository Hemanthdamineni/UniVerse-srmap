const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

const { NotificationStore, defaultPreferences } = require("../src/services/core/notificationStore");
const {
  NotificationService,
  isWithinQuietHours,
  createInAppAdapter,
  createNativePushAdapter,
} = require("../src/services/core/notificationService");

function freshStore() {
  return new NotificationStore({
    dbPath: path.join(os.tmpdir(), `notif-${process.pid}-${Date.now()}-${Math.random()}.sqlite`),
  });
}

const USER = "AP23110010001";

/** Adapter that records calls and can be told to fail the first N times. */
function recordingAdapter(name, { failTimes = 0 } = {}) {
  const calls = [];
  let fails = failTimes;
  return {
    name,
    calls,
    async deliver(args) {
      calls.push(args);
      if (fails > 0) {
        fails -= 1;
        return { ok: false, error: "transient" };
      }
      return { ok: true, id: `${name}-${calls.length}` };
    },
  };
}

/* ---------- store ---------- */

test("preferences default sensibly and merge-write", () => {
  const store = freshStore();
  assert.deepEqual(store.getPreferences(USER), defaultPreferences());

  const next = store.updatePreferences(USER, { channels: { webPush: true }, mutedCategories: ["events", "nope"], quietHours: { start: "22:00", end: "07:00" } });
  assert.equal(next.channels.webPush, true);
  assert.equal(next.channels.inApp, true); // untouched
  assert.deepEqual(next.mutedCategories, ["events"]); // invalid category dropped
  assert.deepEqual(next.quietHours, { start: "22:00", end: "07:00" });

  // bad quiet hours are rejected
  assert.equal(store.updatePreferences(USER, { quietHours: { start: "25:00", end: "x" } }).quietHours, null);
});

test("push subscription CRUD + channel auto-toggle happens in the route, store just stores", () => {
  const store = freshStore();
  assert.equal(store.hasSubscription(USER), false);
  store.saveSubscription(USER, { endpoint: "https://push/1", keys: { p256dh: "a", auth: "b" } });
  assert.equal(store.hasSubscription(USER), true);
  assert.equal(store.listSubscriptions(USER).length, 1);
  // upsert on endpoint
  store.saveSubscription(USER, { endpoint: "https://push/1", keys: { p256dh: "c", auth: "d" } });
  assert.equal(store.listSubscriptions(USER).length, 1);
  store.deleteSubscription("https://push/1");
  assert.equal(store.hasSubscription(USER), false);
  assert.throws(() => store.saveSubscription(USER, { endpoint: "x" }), { status: 400 });
});

test("isWithinQuietHours handles overnight windows", () => {
  assert.equal(isWithinQuietHours({ start: "22:00", end: "07:00" }, "23:30"), true);
  assert.equal(isWithinQuietHours({ start: "22:00", end: "07:00" }, "06:59"), true);
  assert.equal(isWithinQuietHours({ start: "22:00", end: "07:00" }, "12:00"), false);
  assert.equal(isWithinQuietHours({ start: "13:00", end: "14:00" }, "13:30"), true);
  assert.equal(isWithinQuietHours(null, "13:30"), false);
});

/* ---------- service ---------- */

test("emit dispatches to enabled channels and logs delivery", async () => {
  const store = freshStore();
  store.updatePreferences(USER, { channels: { inApp: true, webPush: true } });
  const inApp = recordingAdapter("inApp");
  const webPush = recordingAdapter("webPush");
  const svc = new NotificationService({ store, adapters: [inApp, webPush] });

  const out = await svc.emit("event_reminder", { userId: USER, params: { title: "Hack Night", when: "24h" } });
  assert.equal(out.results.length, 2);
  assert.ok(out.results.every((r) => r.status === "delivered"));
  assert.equal(inApp.calls[0].notification.title, "Reminder: Hack Night");
  assert.equal(store.recentDeliveries(USER).length, 2);
});

test("a disabled channel is not dispatched", async () => {
  const store = freshStore(); // webPush default off
  const inApp = recordingAdapter("inApp");
  const webPush = recordingAdapter("webPush");
  const svc = new NotificationService({ store, adapters: [inApp, webPush] });

  await svc.emit("event_reminder", { userId: USER, params: { title: "X" } });
  assert.equal(inApp.calls.length, 1);
  assert.equal(webPush.calls.length, 0);
});

test("muted category skips everything, including critical events", async () => {
  const store = freshStore();
  store.updatePreferences(USER, { mutedCategories: ["academic"] });
  const inApp = recordingAdapter("inApp");
  const svc = new NotificationService({ store, adapters: [inApp] });

  const out = await svc.emit("attendance_risk", { userId: USER, params: { subject: "CSE101", pct: 68, needed: 3 } });
  assert.equal(inApp.calls.length, 0);
  assert.equal(out.results[0].status, "skipped");
  assert.match(out.results[0].detail, /muted/);
});

test("quiet hours + rate limit apply to non-critical only", async () => {
  const store = freshStore();
  // Force "now" into the quiet window by making it all-day.
  store.updatePreferences(USER, { quietHours: { start: "00:00", end: "23:59" } });
  const inApp = recordingAdapter("inApp");
  const svc = new NotificationService({ store, adapters: [inApp] });

  const nonCritical = await svc.emit("event_reminder", { userId: USER, params: { title: "X" } });
  assert.equal(nonCritical.results[0].status, "skipped");
  assert.match(nonCritical.results[0].detail, /quiet hours/);

  const critical = await svc.emit("attendance_risk", { userId: USER, params: { subject: "CSE101", pct: 60, needed: 5 } });
  assert.equal(critical.results[0].status, "delivered");
});

test("rate limit throttles a noisy non-critical category", async () => {
  const store = freshStore();
  const inApp = recordingAdapter("inApp");
  const svc = new NotificationService({ store, adapters: [inApp] });

  let delivered = 0;
  for (let i = 0; i < 12; i++) {
    const out = await svc.emit("event_reminder", { userId: USER, params: { title: `E${i}` } });
    if (out.results[0]?.status === "delivered") delivered += 1;
  }
  assert.equal(delivered, 8); // RATE_LIMIT.maxPerCategory
});

test("failed delivery is retried, then logged as failed with the attempt count", async () => {
  const store = freshStore();
  const flaky = recordingAdapter("inApp", { failTimes: 5 });
  const svc = new NotificationService({ store, adapters: [flaky] });

  const out = await svc.emit("attendance_risk", { userId: USER, params: { subject: "X", pct: 50, needed: 9 } });
  assert.equal(out.results[0].status, "failed");
  assert.equal(flaky.calls.length, 2); // maxAttempts
  assert.equal(store.recentDeliveries(USER)[0].attempts, 2);
});

test("unknown event key throws", async () => {
  const svc = new NotificationService({ store: freshStore(), adapters: [] });
  await assert.rejects(() => svc.emit("not_a_real_event", { userId: USER }), /Unknown notification event/);
});

test("native push: token CRUD + adapter inert without FCM key, live with mock", async () => {
  const store = freshStore();
  assert.equal(store.hasNativeSubscription(USER), false);
  store.saveNativeToken(USER, "fcm-token-1", "android");
  assert.equal(store.hasNativeSubscription(USER), true);
  assert.equal(store.listNativeTokens(USER)[0].token, "fcm-token-1");
  assert.throws(() => store.saveNativeToken(USER, ""), { status: 400 });

  const inert = createNativePushAdapter({ store, serverKey: "" });
  assert.equal((await inert.deliver({ userId: USER, notification: { title: "t", body: "b", data: {}, url: "/" } })).ok, false);

  const sent = [];
  const live = createNativePushAdapter({
    store,
    serverKey: "KEY",
    fetchImpl: async (url, opts) => {
      sent.push({ url, body: JSON.parse(opts.body) });
      return { ok: true, status: 200, json: async () => ({ success: 1, results: [{ message_id: "m1" }] }) };
    },
  });
  const res = await live.deliver({ userId: USER, notification: { title: "Hi", body: "There", data: { url: "/x" }, url: "/x" } });
  assert.equal(res.ok, true);
  assert.equal(sent[0].url, "https://fcm.googleapis.com/fcm/send");
  assert.equal(sent[0].body.to, "fcm-token-1");
  assert.equal(sent[0].body.notification.title, "Hi");

  // A NotRegistered result prunes the token.
  const pruning = createNativePushAdapter({
    store,
    serverKey: "KEY",
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ success: 0, results: [{ error: "NotRegistered" }] }) }),
  });
  await pruning.deliver({ userId: USER, notification: { title: "x", body: "y", data: {}, url: "/" } });
  assert.equal(store.hasNativeSubscription(USER), false);
});

test("in-app adapter writes through the events store", async () => {
  const pushed = [];
  const eventsStore = { pushCareerNotification: (userId, payload) => { pushed.push({ userId, payload }); return { id: "n1" }; } };
  const adapter = createInAppAdapter({ eventsStore });
  const res = await adapter.deliver({ userId: USER, notification: { eventKey: "results_published", title: "T", body: "B", data: {} } });
  assert.equal(res.ok, true);
  assert.equal(pushed[0].payload.title, "T");
  assert.equal(pushed[0].payload.type, "results_published");
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
    };
    router.handle(req, res, (err) => (err ? reject(err) : resolve({ status: res.statusCode, body: null })));
  });
}

test("notification routes: auth gate, vapid key, prefs, push subscribe", async () => {
  const { createNotificationRoutes } = require("../src/routes/notificationRoutes");
  const store = freshStore();
  const router = createNotificationRoutes({
    notificationStore: store,
    notificationService: new NotificationService({ store, adapters: [recordingAdapter("inApp")] }),
    vapid: { publicKey: "PUBKEY", privateKey: "PRIV", subject: "mailto:x@y.z" },
    sessionStore: {
      async getOrThrow(id) {
        if (id !== "s1") throw new Error("missing");
        return { loggedIn: true, profileData: { TableContent: { "Register No.": "AP1", "Program / Section": "B.Tech CSE / A" } } };
      },
    },
    adminPassword: "x",
  });
  const auth = { cookie: "erp_session=s1" };

  assert.equal((await invokeRouter(router, { url: "/notifications/preferences" })).status, 401);

  const key = await invokeRouter(router, { url: "/notifications/vapid-key", headers: auth });
  assert.equal(key.body.publicKey, "PUBKEY");

  const prefs0 = await invokeRouter(router, { url: "/notifications/preferences", headers: auth });
  assert.equal(prefs0.body.channels.inApp, true);
  assert.equal(prefs0.body.pushSubscribed, false);
  assert.equal(prefs0.body.webPushAvailable, true);

  const put = await invokeRouter(router, {
    method: "PUT", url: "/notifications/preferences", headers: auth,
    body: { mutedCategories: ["events"], quietHours: { start: "22:00", end: "07:00" } },
  });
  assert.deepEqual(put.body.mutedCategories, ["events"]);

  const sub = await invokeRouter(router, {
    method: "POST", url: "/notifications/push/subscribe", headers: auth,
    body: { subscription: { endpoint: "https://push/x", keys: { p256dh: "a", auth: "b" } } },
  });
  assert.equal(sub.body.subscribed, true);

  const prefs1 = await invokeRouter(router, { url: "/notifications/preferences", headers: auth });
  assert.equal(prefs1.body.pushSubscribed, true);
  assert.equal(prefs1.body.channels.webPush, true); // auto-toggled on subscribe
});

test("one-click unsubscribe works without a session and turns the email channel off", async () => {
  const { createNotificationRoutes } = require("../src/routes/notificationRoutes");
  const store = freshStore();
  store.updatePreferences("AP1", { channels: { email: true } });
  const router = createNotificationRoutes({
    notificationStore: store,
    sessionStore: { async getOrThrow() { throw new Error("no session"); } },
    adminPassword: "x",
  });

  const token = store.unsubscribeToken("AP1");
  const ok = await invokeRouter(router, { url: `/notifications/email/unsubscribe?u=AP1&t=${token}` });
  assert.equal(ok.status, 200);
  assert.match(String(ok.body), /turned off/i);
  assert.equal(store.getPreferences("AP1").channels.email, false);

  const bad = await invokeRouter(router, { url: `/notifications/email/unsubscribe?u=AP1&t=wrong` });
  assert.equal(bad.status, 400);
});

test("vapid-key route 503s when Web Push is not configured", async () => {
  const { createNotificationRoutes } = require("../src/routes/notificationRoutes");
  const store = freshStore();
  const router = createNotificationRoutes({
    notificationStore: store, notificationService: null, vapid: null,
    sessionStore: { async getOrThrow() { return { loggedIn: true, profileData: { TableContent: { "Register No.": "AP1" } } }; } },
    adminPassword: "x",
  });
  const res = await invokeRouter(router, { url: "/notifications/vapid-key", headers: { cookie: "erp_session=s1" } });
  assert.equal(res.status, 503);
});
