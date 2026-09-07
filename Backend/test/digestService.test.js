const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

const { NotificationStore } = require("../src/services/core/notificationStore");
const { createEmailAdapter } = require("../src/services/core/notificationService");
const { buildWeeklyDigest, runWeeklyDigestCycle, isoWeekKey } = require("../src/services/core/digestService");

function freshStore() {
  return new NotificationStore({
    dbPath: path.join(os.tmpdir(), `digest-${process.pid}-${Date.now()}-${Math.random()}.sqlite`),
  });
}

const GRAPH = {
  identity: { name: "Asha Rao" },
  derived: {
    readinessScore: 63,
    atRiskSubjects: [{ code: "CSE101", name: "DSA", pct: 68, classesToRecover: 3 }],
    skillGaps: [{ skill: "Docker", demand: 10 }],
  },
};

test("buildWeeklyDigest composes sections and a headline", () => {
  const d = buildWeeklyDigest({
    graph: GRAPH,
    deadlines: [{ title: "Frontend Internship", deadline: "2026-09-12" }],
    topFits: [{ title: "ML Research", fitScore: 82 }],
    name: "Asha",
  });
  assert.equal(d.isEmpty, false);
  assert.match(d.subject, /attendance risk/i);
  assert.match(d.text, /Asha/);
  assert.match(d.html, /CSE101/);
  assert.match(d.html, /Frontend Internship/);
  assert.match(d.html, /ML Research/);
  assert.match(d.html, /63\/100/);
});

test("buildWeeklyDigest is 'all clear' with nothing to say", () => {
  const d = buildWeeklyDigest({ graph: { identity: { name: "T" }, derived: { atRiskSubjects: [], skillGaps: [] } } });
  assert.equal(d.isEmpty, true);
  assert.match(d.subject, /all clear/i);
});

test("isoWeekKey is stable within a week and changes across weeks", () => {
  const a = isoWeekKey(new Date("2026-09-07T00:00:00Z")); // Monday
  const b = isoWeekKey(new Date("2026-09-11T23:00:00Z")); // Friday, same week
  const c = isoWeekKey(new Date("2026-09-15T00:00:00Z")); // next Tuesday
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("runWeeklyDigestCycle: sends once per week to opted-in recipients, then skips", async () => {
  const store = freshStore();
  // Two users; only user-1 opted the email channel in.
  store.updatePreferences("user-1", { channels: { email: true } });
  store.rememberContact("user-1", "u1@example.edu", "User One");
  store.updatePreferences("user-2", { channels: { email: false } });
  store.rememberContact("user-2", "u2@example.edu", "User Two");
  // user-3 opted in but muted the system category -> excluded.
  store.updatePreferences("user-3", { channels: { email: true }, mutedCategories: ["system"] });
  store.rememberContact("user-3", "u3@example.edu", "User Three");

  const sent = [];
  const emailAdapter = {
    name: "email",
    async deliver({ userId, notification }) {
      sent.push({ userId, subject: notification.title });
      return { ok: true, id: `msg-${sent.length}` };
    },
  };
  const studentGraphService = { getGraph: () => GRAPH };

  const first = await runWeeklyDigestCycle({ notificationStore: store, studentGraphService, emailAdapter });
  assert.equal(first.sent, 1);
  assert.deepEqual(sent.map((s) => s.userId), ["user-1"]);

  const second = await runWeeklyDigestCycle({ notificationStore: store, studentGraphService, emailAdapter });
  assert.equal(second.sent, 0);
  assert.equal(second.skipped, 1);
  assert.equal(sent.length, 1);
});

test("email adapter is inert without SMTP config, live with jsonTransport", async () => {
  const store = freshStore();
  store.rememberContact("user-1", "u1@example.edu");

  const inert = createEmailAdapter({ store, config: {} });
  assert.equal((await inert.deliver({ userId: "user-1", notification: { title: "x", body: "y" } })).ok, false);

  const live = createEmailAdapter({ store, config: { devJson: true, appBaseUrl: "https://erp.test" } });
  const res = await live.deliver({
    userId: "user-1",
    notification: { title: "Digest", body: "hi", html: "<p>hi</p>", url: "/dashboard" },
  });
  assert.equal(res.ok, true);
});

test("unsubscribe token round-trips and is user-specific", () => {
  const store = freshStore();
  const t1 = store.unsubscribeToken("user-1");
  assert.equal(store.verifyUnsubscribe("user-1", t1), true);
  assert.equal(store.verifyUnsubscribe("user-2", t1), false);
  assert.equal(store.verifyUnsubscribe("user-1", "deadbeef"), false);
});
