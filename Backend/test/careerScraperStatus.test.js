const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { CareerStore } = require("../src/services/career/careerStore");
const { createCareerRoutes } = require("../src/routes/careerRoutes");

function makeStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "career-scraper-status-test-"));
  const dbPath = path.join(tempDir, "career.sqlite");
  return { store: new CareerStore({ dbPath }), cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }) };
}

function insertRun(store, run) {
  store.db
    .prepare(
      "INSERT INTO career_scraper_runs (id, source, startedAt, completedAt, status, newCount, updatedCount, errorMessage, durationMs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      run.id,
      run.source,
      run.startedAt,
      run.completedAt ?? null,
      run.status,
      run.newCount ?? 0,
      run.updatedCount ?? 0,
      run.errorMessage ?? "",
      run.durationMs ?? null
    );
}

function setHealth(store, health) {
  store.db
    .prepare(
      `INSERT INTO career_source_health (source, lastSuccess, lastAttempt, consecutiveFails, isBlocked, notes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(source) DO UPDATE SET
         lastSuccess = excluded.lastSuccess,
         lastAttempt = excluded.lastAttempt,
         consecutiveFails = excluded.consecutiveFails,
         isBlocked = excluded.isBlocked,
         notes = excluded.notes`
    )
    .run(
      health.source,
      health.lastSuccess ?? null,
      health.lastAttempt ?? null,
      health.consecutiveFails ?? 0,
      health.isBlocked ? 1 : 0,
      health.notes ?? ""
    );
}

function insertOpportunity(store, { id, title, source }) {
  store.db
    .prepare(
      "INSERT INTO career_opportunities (id, type, title, source, sourceUrl, scrapedAt) VALUES (?, 'internship', ?, ?, ?, ?)"
    )
    .run(id, title, source, `https://example.test/${id}`, new Date().toISOString());
}

test("getScraperStatus merges latest run, breaker state, and opportunity counts", () => {
  const { store, cleanup } = makeStore();
  try {
    insertRun(store, {
      id: "run_1_jobspy",
      source: "jobspy",
      startedAt: "2026-08-24T10:00:00+05:30",
      completedAt: "2026-08-24T10:03:00+05:30",
      status: "completed",
      newCount: 5,
      updatedCount: 2,
      durationMs: 180000,
    });
    // Older run for the same source must NOT shadow the latest.
    insertRun(store, {
      id: "run_0_jobspy",
      source: "jobspy",
      startedAt: "2026-08-24T04:00:00+05:30",
      status: "failed",
      errorMessage: "boom",
    });
    insertRun(store, {
      id: "run_1_unstop",
      source: "unstop",
      startedAt: "2026-08-24T10:01:00+05:30",
      status: "running",
    });

    setHealth(store, {
      source: "jobspy",
      lastSuccess: "2026-08-24T10:03:00+05:30",
      lastAttempt: "2026-08-24T10:03:00+05:30",
      consecutiveFails: 0,
    });
    setHealth(store, {
      source: "internshala",
      lastAttempt: "2026-08-24T09:00:00+05:30",
      consecutiveFails: 5,
      isBlocked: true,
      notes: "selector drift",
    });

    insertOpportunity(store, { id: "o1", title: "A", source: "jobspy" });
    insertOpportunity(store, { id: "o2", title: "B", source: "jobspy" });
    const expiredId = "o3";
    insertOpportunity(store, { id: expiredId, title: "C", source: "jobspy" });
    store.db.prepare("UPDATE career_opportunities SET isActive = 0 WHERE id = ?").run(expiredId);

    const status = store.getScraperStatus();
    const bySource = new Map(status.sources.map((s) => [s.source, s]));

    const jobspy = bySource.get("jobspy");
    assert.equal(jobspy.lastRun.id, "run_1_jobspy");
    assert.equal(jobspy.isBlocked, false);
    assert.equal(jobspy.totalOpportunities, 3);
    assert.equal(jobspy.activeOpportunities, 2);

    const unstop = bySource.get("unstop");
    assert.equal(unstop.lastRun.status, "running");

    // Health row without any run still appears (breaker-blocked source).
    const internshala = bySource.get("internshala");
    assert.equal(internshala.isBlocked, true);
    assert.equal(internshala.consecutiveFails, 5);
    assert.equal(internshala.lastRun, null);

    assert.ok(status.generatedAt);
  } finally {
    store.close?.();
    cleanup();
  }
});

test("career router registers the admin-only scraper-status route", () => {
  delete require.cache[require.resolve("../src/routes/careerRoutes")];
  const { createCareerRoutes: create } = require("../src/routes/careerRoutes");
  const sessionStore = {
    async getOrThrow() {
      return { loggedIn: true, profileData: { TableContent: {} } };
    },
  };
  const router = create({
    careerStore: { getScraperStatus: () => ({ sources: [] }) },
    sessionStore,
    adminPassword: "test-admin",
    redisClient: null,
    scraperSupervisorStatus: () => ({ state: "running", pid: 1 }),
    scraperTriggerOnce: () => ({ accepted: true, mode: "daemon" }),
  });
  const paths = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  assert.ok(paths.includes("/career/scraper-status"), "missing /career/scraper-status route");
  const triggerRoute = router.stack
    .filter((layer) => layer.route && layer.route.path === "/career/scraper-trigger")
    .map((layer) => layer.route);
  assert.ok(triggerRoute.length > 0, "missing /career/scraper-trigger route");
  assert.ok(triggerRoute[0].methods.post, "scraper-trigger must accept POST");
});
