const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { CareerStore } = require("../src/services/career/careerStore");
const { runCareerNotificationCycle } = require("../src/services/career/careerServices");

function makeStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "career-saved-search-"));
  return new CareerStore({ dbPath: path.join(tempDir, "career.sqlite") });
}

const USER = { role: "student", userId: "student-1", isAuthenticated: true };

function insertOpp(store, id, over = {}) {
  store.db
    .prepare(
      `INSERT INTO career_opportunities
       (id, type, title, company, description, shortDescription, skills, tags,
        source, sourceUrl, applyUrl, scrapedAt, postedAt, isActive, moderationState, isFree, location, mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
    )
    .run(
      id,
      over.type || "internship",
      over.title || "React Intern",
      "ACME",
      over.description || "Build React apps",
      "short",
      JSON.stringify(over.skills || ["React", "TypeScript"]),
      "[]",
      "manual",
      `https://x/${id}`,
      `https://x/${id}`,
      over.scrapedAt || new Date().toISOString(),
      over.postedAt || new Date().toISOString(),
      over.isFree == null ? 1 : over.isFree,
      over.location || "Remote",
      over.mode || "remote",
    );
}

test("saved search CRUD: create, list, update, cap, delete", () => {
  const store = makeStore();

  const s = store.createSavedSearch(USER, {
    name: "  React internships  ",
    filters: { query: "react", type: "internship", junk: "ignored", empty: "" },
    alertsEnabled: true,
  });
  assert.equal(s.name, "React internships");
  assert.deepEqual(s.filters, { query: "react", type: "internship" });
  assert.equal(s.alertsEnabled, true);

  assert.equal(store.listSavedSearches(USER).length, 1);

  const updated = store.updateSavedSearch(USER, s.id, { alertsEnabled: false, name: "Renamed" });
  assert.equal(updated.alertsEnabled, false);
  assert.equal(updated.name, "Renamed");

  assert.throws(() => store.createSavedSearch(USER, { name: "" }), { status: 400 });
  assert.throws(() => store.updateSavedSearch(USER, "nope", {}), { status: 404 });

  assert.deepEqual(store.deleteSavedSearch(USER, s.id), { deleted: true });
  assert.equal(store.listSavedSearches(USER).length, 0);
});

test("matchSavedSearchAlerts counts new matching opportunities and advances lastRunAt", () => {
  const store = makeStore();
  const s = store.createSavedSearch(USER, {
    name: "React",
    filters: { query: "react", type: "internship" },
    alertsEnabled: true,
  });

  // Two matches added after the search was created, one non-match.
  insertOpp(store, "m1", { title: "React Native Intern" });
  insertOpp(store, "m2", { title: "Frontend React Intern" });
  insertOpp(store, "x1", { title: "Rust Systems Intern", description: "no js here", skills: ["Rust"] });
  insertOpp(store, "x2", { title: "React role but a job", type: "job" });

  const hits = store.matchSavedSearchAlerts(new Date());
  assert.equal(hits.length, 1);
  assert.equal(hits[0].searchId, s.id);
  assert.equal(hits[0].count, 2);
  assert.ok(/React/.test(hits[0].sampleTitle));

  // Second run: lastRunAt advanced, nothing new → no hit.
  assert.deepEqual(store.matchSavedSearchAlerts(new Date(Date.now() + 1000)), []);
});

test("runCareerNotificationCycle emits one saved-search notification per hit, idempotent per day", () => {
  const store = makeStore();
  store.createSavedSearch(USER, {
    name: "React",
    filters: { query: "react" },
    alertsEnabled: true,
  });
  insertOpp(store, "m1", { title: "Senior React Intern" });

  const pushed = [];
  const eventsStore = { pushCareerNotification: (userId, n) => pushed.push({ userId, ...n }) };

  const first = runCareerNotificationCycle({ careerStore: store, eventsStore, now: new Date() });
  assert.equal(first.savedSearchSent, 1);
  assert.equal(pushed[0].type, "career_saved_search_match");
  assert.match(pushed[0].title, /New matches for "React"/);

  // Same UTC day → deduped.
  const second = runCareerNotificationCycle({ careerStore: store, eventsStore, now: new Date() });
  assert.equal(second.savedSearchSent, 0);
});
