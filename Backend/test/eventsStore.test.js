const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { EventsStore } = require("../src/services/events/eventsStore");

function makeStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "events-store-test-"));
  return new EventsStore({ dataDir: tempDir });
}

function makeUser(overrides = {}) {
  return {
    role: "admin",
    userId: "u1",
    name: "Admin",
    email: "admin@erp.edu",
    department: "CSE",
    ...overrides,
  };
}

test("creates event and supports registration", () => {
  const store = makeStore();
  const [event] = store.createEvent(
    {
      title: "Hackathon",
      description: "24h coding",
      startAt: "2026-10-10T09:00:00.000Z",
      endAt: "2026-10-10T17:00:00.000Z",
      location: { physical: "Lab 1" },
      organizer: "CSE Club",
      department: "CSE",
      category: "Competition",
      tags: ["coding"],
      maxCapacity: 2,
      registrationDeadline: "2026-10-10T08:00:00.000Z",
      visibility: "public",
      status: "published",
    },
    { user: makeUser() }
  );

  const reg = store.register(event.id, { formResponses: [] }, { user: makeUser({ userId: "s1", role: "student" }) });
  assert.equal(reg.status, "registered");
});

test("capacity blocks additional registrations with full message", () => {
  const store = makeStore();
  const [event] = store.createEvent(
    {
      title: "Seminar",
      description: "Talk",
      startAt: "2099-09-01T09:00:00.000Z",
      endAt: "2099-09-01T11:00:00.000Z",
      location: { physical: "Hall" },
      organizer: "ECE",
      department: "ECE",
      maxCapacity: 1,
      registrationDeadline: "2099-08-30T08:00:00.000Z",
      visibility: "public",
      status: "published",
    },
    { user: makeUser() }
  );

  const first = store.register(event.id, {}, { user: makeUser({ userId: "s1", role: "student" }) });
  let fullError = null;
  try {
    store.register(event.id, {}, { user: makeUser({ userId: "s2", role: "student" }) });
  } catch (error) {
    fullError = error;
  }

  assert.equal(first.status, "registered");
  assert.equal(fullError?.message, "Event is full");
});

test("persists events in sqlite store when dbPath is configured", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "events-store-sqlite-test-"));
  const dbPath = path.join(tempDir, "events.sqlite");

  const creator = makeUser();
  const storeA = new EventsStore({ dataDir: tempDir, dbPath });
  const [created] = storeA.createEvent(
    {
      title: "SQLite Event",
      description: "Persistent storage test",
      startAt: "2026-10-10T09:00:00.000Z",
      endAt: "2026-10-10T11:00:00.000Z",
      location: { physical: "Hall A" },
      organizer: "IT Club",
      department: "CSE",
      category: "Workshop",
      maxCapacity: 10,
      registrationDeadline: "2026-10-09T23:00:00.000Z",
      visibility: "public",
      status: "published",
    },
    { user: creator }
  );

  const storeB = new EventsStore({ dataDir: tempDir, dbPath });
  const events = storeB.listEvents({ user: creator });
  assert.equal(events.length, 1);
  assert.equal(events[0].id, created.id);
});
