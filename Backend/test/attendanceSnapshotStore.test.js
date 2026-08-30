const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const fs = require("fs");
const path = require("path");

const {
  AttendanceSnapshotStore,
  todayIso,
} = require("../src/services/erp/attendanceSnapshotStore");

function tempDbPath() {
  return path.join(os.tmpdir(), `att-snap-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
}

const RECORDS = [
  { subjectCode: "CSE301", subjectDescription: "Operating Systems", classesConducted: "20", present: "18", attendancePercentage: "90" },
  { subjectCode: "CSE302", subjectDescription: "DBMS", classesConducted: "18", present: "12", attendancePercentage: "66.67" },
];

test.afterEach(() => {
  // no shared state; each test uses its own db file
});

test("record stores and history returns parsed snapshots oldest-first", () => {
  const store = new AttendanceSnapshotStore({ dbPath: tempDbPath() });
  const day1 = new Date("2099-08-20T06:00:00Z");
  const day2 = new Date("2099-08-21T06:00:00Z");

  assert.equal(store.record({ userKey: "ap231100101", pageKey: "academic/attendance-details", records: RECORDS, now: day1 }), "stored");
  const updated = [
    RECORDS[0],
    { ...RECORDS[1], attendancePercentage: "70" },
  ];
  assert.equal(store.record({ userKey: "ap231100101", pageKey: "academic/attendance-details", records: updated, now: day2 }), "stored");

  const history = store.history("ap231100101");
  assert.deepEqual(history.map((h) => h.date), [todayIso(day1), todayIso(day2)]);
  assert.equal(history[1].subjects[1].attendancePercentage, 70);
  store.close();
});

test("record is idempotent for identical same-day data", () => {
  const store = new AttendanceSnapshotStore({ dbPath: tempDbPath() });
  const now = new Date("2099-08-21T06:00:00Z");
  assert.equal(store.record({ userKey: "u1", pageKey: "p", records: RECORDS, now }), "stored");
  assert.equal(store.record({ userKey: "u1", pageKey: "p", records: RECORDS, now }), "unchanged");
  assert.equal(store.history("u1").length, 1);
  store.close();
});

test("record ignores anonymous users and malformed payloads", () => {
  const store = new AttendanceSnapshotStore({ dbPath: tempDbPath() });
  assert.equal(store.record({ userKey: "anonymous", records: RECORDS }), "ignored");
  assert.equal(store.record({ userKey: "u1", records: [] }), "ignored");
  assert.equal(
    store.record({ userKey: "u1", records: [{ subjectCode: "X", attendancePercentage: "" }] }),
    "ignored"
  );
  assert.deepEqual(store.history("u1"), []);
  store.close();
});

test("history prunes to the retention window", () => {
  const store = new AttendanceSnapshotStore({ dbPath: tempDbPath() });
  for (let day = 1; day <= 35; day += 1) {
    store.record({
      userKey: "u1",
      pageKey: "p",
      records: RECORDS,
      now: new Date(Date.UTC(2026, 6, day, 6)),
    });
  }
  assert.equal(store.history("u1").length, 30);
  // 35 days added (Jul 1 → Aug 4 IST); retention keeps newest 30.
  // Oldest in history is day 35 - 30 + 1 = day 6 → Jul 6 IST.
  assert.equal(store.history("u1")[0].date, "2026-07-06");
  store.close();
});
