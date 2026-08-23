const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

const {
  VacantRoomStore,
  extractRoomToken,
  normalizeDay,
} = require("../src/services/erp/vacantRoomStore");
const { createVacantRoomRoutes } = require("../src/routes/vacantRoomRoutes");

function tempDbPath() {
  return path.join(os.tmpdir(), `vacant-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
}

const SCHEDULE = [
  { day: "Monday", periods: ["CSE401(C311) — CODING SKILLS", "CSE402(AB-305) — NETWORKS", "", "", "", "", "", ""] },
  { day: "Tuesday", periods: ["CSE301(C205) — OS LAB", "", "", "CSE302(C206) — DBMS", "", "", "", ""] },
  { day: "Saturday", periods: ["CSE999(X100) — WEEKEND"] },
];

test("extractRoomToken pulls room from CODE(ROOM) cells", () => {
  assert.equal(extractRoomToken("CSE401(C311) — CODING SKILLS"), "C311");
  assert.equal(extractRoomToken("CSE402(AB-305)"), "AB-305");
  assert.equal(extractRoomToken("CSE999(TBA)"), null);
  assert.equal(extractRoomToken(""), null);
  assert.equal(extractRoomToken("FREE"), null);
});

test("normalizeDay accepts prefixes and rejects weekends", () => {
  assert.equal(normalizeDay("Monday"), "monday");
  assert.equal(normalizeDay("WED"), "wednesday");
  assert.equal(normalizeDay("Saturday"), null);
});

test("ingestTimetable records weekday occupancy and vacantRooms subtracts it", () => {
  const store = new VacantRoomStore({ dbPath: tempDbPath() });
  const written = store.ingestTimetable(SCHEDULE);
  // Saturday row is skipped entirely.
  assert.equal(written, 4);

  const mondaySlot0 = store.vacantRooms({ day: "monday", slotIndex: 0 });
  assert.equal(mondaySlot0.ok, true);
  // Only C311 is occupied Monday first period.
  assert.deepEqual(mondaySlot0.vacant, ["AB-305", "C205", "C206"]);
  assert.equal(mondaySlot0.occupiedCount, 1);

  const mondaySlot1 = store.vacantRooms({ day: "monday", slotIndex: 1 });
  assert.deepEqual(mondaySlot1.vacant, ["C205", "C206", "C311"]);

  const tuesdaySlot0 = store.vacantRooms({ day: "tuesday", slotIndex: 0 });
  assert.deepEqual(tuesdaySlot0.vacant, ["AB-305", "C206", "C311"]);
  store.close();
});

test("vacantRooms rejects invalid day/slot", () => {
  const store = new VacantRoomStore({ dbPath: tempDbPath() });
  store.ingestTimetable(SCHEDULE);
  assert.equal(store.vacantRooms({ day: "sunday", slotIndex: 0 }).ok, false);
  assert.equal(store.vacantRooms({ day: "monday", slotIndex: 9 }).ok, false);
  assert.equal(store.vacantRooms({ day: "monday" }).ok, false);
  store.close();
});

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    setHeader() {},
    getHeader() {
      return undefined;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

async function invokeRoute(store, query) {
  const router = createVacantRoomRoutes({ vacantRoomStore: store });
  const layer = router.stack.find((entry) => entry.route?.path === "/vacant-rooms");
  assert.ok(layer, "Expected /vacant-rooms route to exist");
  const req = {
    method: "GET",
    url: `/vacant-rooms${query}`,
    originalUrl: `/api/vacant-rooms${query}`,
    query,
    requestId: "test-vacant",
  };
  const res = createMockResponse();
  await layer.route.stack[0].handle(req, res);
  return res;
}

test("vacant-rooms route returns derived vacancy data", async () => {
  const store = new VacantRoomStore({ dbPath: tempDbPath() });
  store.ingestTimetable(SCHEDULE);
  const res = await invokeRoute(store, { day: "monday", slot: "0" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data.occupiedCount, 1);
  assert.equal(res.payload.data.vacant.length, 3);
  assert.equal(res.payload.data.timeWindow.startsWith("09:00"), true);
  store.close();
});

test("vacant-rooms route rejects invalid queries with 400", async () => {
  const store = new VacantRoomStore({ dbPath: tempDbPath() });
  const res = await invokeRoute(store, { day: "sunday", slot: "0" });
  assert.equal(res.statusCode, 400);
  store.close();
});
