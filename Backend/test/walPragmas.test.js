// Test the 7 stores the prod-readiness audit flagged as missing
// PRAGMA journal_mode = WAL. Each store must end up with WAL
// after construction, plus foreign_keys=ON and busy_timeout=5000.
//
// Construction uses unique per-process temp DBs; the file content
// is verified via journal_mode pragma. The test does not assert
// exact -wal/-shm sidecar filenames because node:sqlite can
// opportunistically skip them in some test envs, but journal_mode
// = "wal" is the source of truth.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function tempDbPath(label) {
  return path.join(
    os.tmpdir(),
    `wal-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
  );
}

function assertWalAndFk(store, label) {
  const jm = store.db.prepare("PRAGMA journal_mode").get();
  assert.equal(jm.journal_mode.toLowerCase(), "wal", `${label}: journal_mode`);
  const fk = store.db.prepare("PRAGMA foreign_keys").get();
  assert.equal(fk.foreign_keys, 1, `${label}: foreign_keys`);
  // node:sqlite (>=22.5) returns busy_timeout as a single column
  // named `timeout` (not `busy_timeout`). The constructor sets
  // 5000ms; node:sqlite returns it in ms.
  const bt = store.db.prepare("PRAGMA busy_timeout").get();
  const value = bt.timeout ?? bt.busy_timeout;
  assert.equal(Number(value), 5000, `${label}: busy_timeout`);
}

test("contentStore enables WAL on construction", () => {
  const { ContentStore } = require("../src/services/lms/contentStore");
  const dbPath = tempDbPath("content");
  const store = new ContentStore(dbPath);
  try {
    assertWalAndFk(store, "contentStore");
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("lmsTrackerStore enables WAL on construction", () => {
  const { LmsTrackerStore } = require("../src/services/lms/lmsTrackerStore");
  const dbPath = tempDbPath("lms-tracker");
  const store = new LmsTrackerStore({ dbPath });
  try {
    assertWalAndFk(store, "lmsTrackerStore");
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("campusFeedbackStore enables WAL on construction", () => {
  const { CampusFeedbackStore } = require("../src/services/campus/campusFeedbackStore");
  const dbPath = tempDbPath("campus-feedback");
  const store = new CampusFeedbackStore({ dbPath });
  try {
    assertWalAndFk(store, "campusFeedbackStore");
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("helpdeskStore enables WAL on construction", () => {
  const { HelpdeskStore } = require("../src/services/campus/helpdeskStore");
  const dbPath = tempDbPath("helpdesk");
  const store = new HelpdeskStore({ dbPath });
  try {
    assertWalAndFk(store, "helpdeskStore");
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("feedbackServices (external-pages) ExternalDataStore enables WAL on construction", () => {
  const { ExternalDataStore } = require("../src/services/campus/feedbackServices");
  const dbPath = tempDbPath("external");
  const store = new ExternalDataStore(dbPath);
  try {
    assertWalAndFk(store, "ExternalDataStore");
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("vacantRoomStore enables WAL on construction", () => {
  const { VacantRoomStore } = require("../src/services/erp/vacantRoomStore");
  const dbPath = tempDbPath("vacant");
  const store = new VacantRoomStore({ dbPath });
  try {
    assertWalAndFk(store, "vacantRoomStore");
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("attendanceSnapshotStore enables WAL on construction", () => {
  const { AttendanceSnapshotStore } = require("../src/services/erp/attendanceSnapshotStore");
  const dbPath = tempDbPath("attendance");
  const store = new AttendanceSnapshotStore({ dbPath });
  try {
    assertWalAndFk(store, "attendanceSnapshotStore");
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});
