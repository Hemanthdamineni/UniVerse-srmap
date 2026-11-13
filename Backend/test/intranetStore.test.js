const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { DatabaseSync } = require("node:sqlite");

const { IntranetStore } = require("../src/services/intranet/intranetStore");

function makeStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "intranet-store-test-"));
  const dbPath = path.join(tempDir, "intranet.sqlite");
  return { store: new IntranetStore(dbPath), tempDir, dbPath };
}

// The JS store is read-only over items (the Python scraper owns writes), so
// tests seed rows directly through a second connection to the same WAL db.
function insertItem(dbPath, item) {
  const db = new DatabaseSync(dbPath);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO intranet_items
      (id, source_key, content_type, audience, title, summary, body,
       published_at, event_start, event_end, deadline, department,
       source_url, canonical_url, document_links, tags,
       is_active, first_seen_at, last_seen_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    item.id,
    item.sourceKey || "announcements",
    item.contentType || "announcement",
    item.audience || "shared",
    item.title,
    item.summary ?? null,
    item.body ?? null,
    item.publishedAt ?? null,
    item.eventStart ?? null,
    item.eventEnd ?? null,
    item.deadline ?? null,
    item.department ?? null,
    item.sourceUrl || `https://intranet.srmap.edu.in/${item.id}`,
    item.canonicalUrl ?? item.sourceUrl ?? `https://intranet.srmap.edu.in/${item.id}`,
    JSON.stringify(item.documentLinks ?? []),
    JSON.stringify(item.tags ?? []),
    item.isActive === false ? 0 : 1,
    now,
    now,
    JSON.stringify(item.metadata ?? {}),
  );
  db.close();
}

test("constructs the schema and reports health", () => {
  const { store } = makeStore();
  const health = store.getHealth();
  assert.equal(health.open, true);
  assert.match(health.dbPath, /intranet\.sqlite$/);
  store.close();
  assert.equal(store.getHealth().open, false);
});

test("listItems filters by contentType and audience and paginates", () => {
  const { store, dbPath } = makeStore();
  insertItem(dbPath, { id: "a1", title: "Shared notice", publishedAt: "2026-11-03T00:00:00Z" });
  insertItem(dbPath, { id: "a2", title: "Second notice", publishedAt: "2026-11-02T00:00:00Z" });
  insertItem(dbPath, {
    id: "c1",
    title: "Cohort notice",
    audience: "cohort",
    publishedAt: "2026-11-01T00:00:00Z",
  });

  const shared = store.listItems({ contentType: "announcement", audience: "shared" });
  assert.equal(shared.total, 2);
  assert.deepEqual(shared.items.map((i) => i.id), ["a1", "a2"]);

  const all = store.listItems({});
  assert.equal(all.total, 3);

  const page1 = store.listItems({ limit: 1, page: 1 });
  const page2 = store.listItems({ limit: 1, page: 2 });
  assert.equal(page1.items.length, 1);
  assert.equal(page2.items.length, 1);
  assert.notEqual(page1.items[0].id, page2.items[0].id);
  assert.equal(page1.totalPages, 3);
  store.close();
});

test("listItems clamps limit and defaults invalid values", () => {
  const { store } = makeStore();
  const result = store.listItems({ limit: 9999, page: -5 });
  assert.equal(result.limit, 50);
  assert.equal(result.page, 1);
  store.close();
});

test("full-text search matches title and body terms", () => {
  const { store, dbPath } = makeStore();
  insertItem(dbPath, { id: "s1", title: "Scholarship applications open", body: "Apply before Friday" });
  insertItem(dbPath, { id: "s2", title: "Library timings", body: "Extended during exams" });

  const result = store.listItems({ query: "scholarship" });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, "s1");

  const body = store.listItems({ query: "exams" });
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].id, "s2");
  store.close();
});

test("getItem returns serialized item and null when missing", () => {
  const { store, dbPath } = makeStore();
  insertItem(dbPath, {
    id: "detail1",
    title: "Event detail",
    contentType: "event",
    tags: ["tech", "fest"],
    documentLinks: ["https://x/doc.pdf"],
  });
  const item = store.getItem("detail1");
  assert.equal(item.title, "Event detail");
  assert.equal(item.contentType, "event");
  assert.deepEqual(item.tags, ["tech", "fest"]);
  assert.deepEqual(item.documentLinks, ["https://x/doc.pdf"]);
  assert.equal(store.getItem("missing"), null);
  store.close();
});

test("getUpcomingEvents returns only future events ordered soonest first", () => {
  const { store, dbPath } = makeStore();
  const past = "2020-01-01";
  const soon = "2099-01-01";
  const later = "2099-06-01";
  insertItem(dbPath, { id: "e-past", title: "Past", contentType: "event", eventStart: past, eventEnd: past });
  insertItem(dbPath, { id: "e-later", title: "Later", contentType: "event", eventStart: later, eventEnd: later });
  insertItem(dbPath, { id: "e-soon", title: "Soon", contentType: "event", eventStart: soon, eventEnd: soon });
  insertItem(dbPath, { id: "n-not-event", title: "News", contentType: "news", eventStart: soon, eventEnd: soon });

  const events = store.getUpcomingEvents(10);
  assert.deepEqual(events.map((e) => e.id), ["e-soon", "e-later"]);
  store.close();
});

test("getDashboardFeed mixes shared content types and excludes cohort items", () => {
  const { store, dbPath } = makeStore();
  insertItem(dbPath, { id: "d1", title: "Announcement", contentType: "announcement", publishedAt: "2026-11-05T00:00:00Z" });
  insertItem(dbPath, { id: "d2", title: "News", contentType: "news", publishedAt: "2026-11-04T00:00:00Z" });
  insertItem(dbPath, { id: "d3", title: "Cohort", contentType: "announcement", audience: "cohort", publishedAt: "2026-11-06T00:00:00Z" });
  insertItem(dbPath, { id: "d4", title: "Academic", contentType: "academic", publishedAt: "2026-11-07T00:00:00Z" });

  const feed = store.getDashboardFeed({ limit: 10 });
  assert.deepEqual(feed.map((i) => i.id), ["d1", "d2"]);
  store.close();
});

test("getBySourceKey scopes to a single scraper source", () => {
  const { store, dbPath } = makeStore();
  insertItem(dbPath, { id: "src1", sourceKey: "news", title: "News A", contentType: "news" });
  insertItem(dbPath, { id: "src2", sourceKey: "events", title: "Event A", contentType: "event" });
  const result = store.getBySourceKey("news");
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, "src1");
  store.close();
});

test("getOperationalStatus summarizes runs, health and counts", () => {
  const { store, dbPath } = makeStore();
  insertItem(dbPath, { id: "op1", title: "One", contentType: "announcement" });
  insertItem(dbPath, { id: "op2", title: "Two", contentType: "event", eventStart: "2099-01-01" });

  const db = new DatabaseSync(dbPath);
  db.prepare(
    "INSERT INTO intranet_scraper_runs (id, source, started_at, status, items_new) VALUES (?, ?, ?, ?, ?)"
  ).run("run1", "announcements", "2026-11-01T00:00:00Z", "ok", 2);
  db.prepare(
    "INSERT INTO intranet_source_health (source, last_success, last_attempt, consecutive_fails, is_blocked) VALUES (?, ?, ?, ?, ?)"
  ).run("announcements", "2026-11-01T00:00:00Z", "2026-11-01T00:00:00Z", 0, 0);
  db.close();

  const status = store.getOperationalStatus();
  assert.equal(status.lastRun.id, "run1");
  assert.equal(status.lastSuccess.id, "run1");
  assert.equal(status.totalActiveItems, 2);
  assert.equal(status.itemCounts.announcement, 1);
  assert.equal(status.itemCounts.event, 1);
  assert.equal(status.sources.length, 1);
  store.close();
});

test("resetCircuitBreaker clears failure state for a source", () => {
  const { store, dbPath } = makeStore();
  const db = new DatabaseSync(dbPath);
  db.prepare(
    "INSERT INTO intranet_source_health (source, consecutive_fails, is_blocked) VALUES (?, ?, ?)"
  ).run("events", 5, 1);
  db.close();

  store.resetCircuitBreaker("events");

  const after = store.getOperationalStatus().sources.find((s) => s.source === "events");
  assert.equal(after.is_blocked, 0);
  assert.equal(after.consecutive_fails, 0);
  store.close();
});