const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { CareerStore } = require("../src/services/career/careerStore");

function tempDbPath() {
  return path.join(os.tmpdir(), `career-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
}

test("career notification idempotency: same (user, kind, ref, day) does not double-send", () => {
  const dbPath = tempDbPath();
  const store = new CareerStore({ dbPath });
  try {
    // Insert a bookmark candidate for notification.
    const userId = "AP23110010001";
    const opportunityId = "opp-1";
    const day = "2026-08-28";

    // First cycle: not yet sent for (user, "deadline_soon", opp, day).
    assert.equal(
      store.hasCareerNotificationLog(userId, "deadline_soon", opportunityId, day),
      false,
      "first send: log is empty"
    );
    store.recordCareerNotificationLog(userId, "deadline_soon", opportunityId, day);

    // Now it should be present.
    assert.equal(
      store.hasCareerNotificationLog(userId, "deadline_soon", opportunityId, day),
      true,
      "after recordCareerNotificationLog: log entry exists"
    );

    // A second cycle the same day must observe the entry and skip
    // (this is what runCareerNotificationCycle does in the production
    // path — the cycle looks up hasCareerNotificationLog and
    // continues past already-sent rows).
    const secondCheck = store.hasCareerNotificationLog(userId, "deadline_soon", opportunityId, day);
    assert.equal(secondCheck, true, "second cycle same day: still present");

    // A different (kind, ref) is independent.
    assert.equal(
      store.hasCareerNotificationLog(userId, "digest", opportunityId, day),
      false,
      "different kind: independent"
    );

    // A different user is independent.
    assert.equal(
      store.hasCareerNotificationLog("AP23110010002", "deadline_soon", opportunityId, day),
      false,
      "different user: independent"
    );
  } finally {
    fs.rmSync(dbPath, { force: true });
    fs.rmSync(dbPath + "-shm", { force: true });
    fs.rmSync(dbPath + "-wal", { force: true });
  }
});
