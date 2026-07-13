const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const { randomUUID } = require("crypto");
const { performance } = require("perf_hooks");

const {
  CampusFeedbackStore,
  MODERATION_STATUS,
} = require("../src/services/campus/campusFeedbackStore");

function createStore() {
  return new CampusFeedbackStore({
    dbPath: path.join(os.tmpdir(), `campus-feedback-${process.pid}-${Date.now()}-${Math.random()}.sqlite`),
  });
}

const student = {
  role: "student",
  userId: "AP23110010001",
  name: "Student One",
  email: "student@example.edu",
  department: "CSE",
};

const admin = {
  role: "admin",
  userId: "admin-1",
  name: "Admin User",
  email: "admin@example.edu",
  department: "Student Affairs",
};

function seedFeedbackEntries(store, count = 10000) {
  const insertEntry = store.db.prepare(
    `INSERT INTO campus_feedback_entries (
      id, type, target_id, target_label, ratings_json, comment, status,
      created_by_user_id, created_by_name, created_by_email, department,
      display_mode, dedupe_key, moderation_reason, moderated_by_user_id,
      moderated_by_name, moderated_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertAudit = store.db.prepare(
    `INSERT INTO campus_feedback_audit (
      id, feedback_id, action, from_status, to_status, reason,
      actor_user_id, actor_name, actor_role, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const statuses = ["pending", "approved", "rejected"];
  const types = ["events", "hostel_mess", "transport"];
  const now = Date.now();

  store.db.exec("BEGIN IMMEDIATE");
  try {
    for (let index = 0; index < count; index += 1) {
      const id = `seed-feedback-${index}`;
      const status = statuses[index % statuses.length];
      const type = types[index % types.length];
      const createdAt = new Date(now - index * 1000).toISOString();
      insertEntry.run(
        id,
        type,
        "",
        `Seed target ${index % 200}`,
        JSON.stringify({ Experience: (index % 5) + 1 }),
        `Seeded feedback entry ${index}`,
        status,
        `student-${index % 1500}`,
        `Student ${index % 1500}`,
        `student-${index % 1500}@example.edu`,
        "CSE",
        "anonymous",
        `seed-dedupe-${index}`,
        status === "pending" ? "" : "Seed moderation decision",
        status === "pending" ? "" : admin.userId,
        status === "pending" ? "" : admin.name,
        status === "pending" ? "" : createdAt,
        createdAt,
        createdAt
      );
      insertAudit.run(
        randomUUID(),
        id,
        status === "pending" ? "submitted" : "moderated",
        status === "pending" ? "" : "pending",
        status,
        status === "pending" ? "Seed student submission" : "Seed moderation decision",
        status === "pending" ? `student-${index % 1500}` : admin.userId,
        status === "pending" ? `Student ${index % 1500}` : admin.name,
        status === "pending" ? "student" : "admin",
        createdAt
      );
    }
    store.db.exec("COMMIT");
  } catch (error) {
    store.db.exec("ROLLBACK");
    throw error;
  }
}

test("campus feedback stores unofficial submissions separately with moderation history", () => {
  const store = createStore();

  const option = store.createOption("events", { label: "Tech Fest" }, { user: admin });
  const submitted = store.submitFeedback(
    "events",
    {
      targetId: option.id,
      ratings: { Experience: 5 },
      comment: "Well coordinated event",
      displayMode: "anonymous",
    },
    { user: student }
  );

  assert.equal(submitted.status, MODERATION_STATUS.PENDING);
  assert.equal(submitted.targetLabel, "Tech Fest");
  assert.equal(submitted.governance.routeNamespace, "/api/campus-feedback");

  const mine = store.listMine({ user: student, type: "events" });
  assert.equal(mine.items.length, 1);
  assert.equal(mine.items[0].id, submitted.id);

  const moderated = store.moderate(
    submitted.id,
    { status: "approved", reason: "Constructive and policy compliant" },
    { user: admin }
  );
  assert.equal(moderated.status, MODERATION_STATUS.APPROVED);
  assert.equal(moderated.audit.length, 2);
  assert.equal(moderated.audit[0].action, "moderated");
  assert.equal(moderated.createdBy.displayName, "Anonymous student");
});

test("campus feedback rejects non-admin moderation and reasonless decisions", () => {
  const store = createStore();
  const submitted = store.submitFeedback(
    "hostel_mess",
    {
      targetId: "hostel-mess-services",
      ratings: { Cleanliness: 4 },
      comment: "Dining hall was clean today",
    },
    { user: student }
  );

  assert.throws(
    () => store.listAdmin({ user: student }),
    /Admin access required/
  );
  assert.throws(
    () => store.moderate(submitted.id, { status: "rejected", reason: "" }, { user: admin }),
    /reason is required/
  );
});

test("campus feedback throttles repeated submissions for the same target", () => {
  const store = createStore();
  const payload = {
    targetId: "hostel-mess-services",
    ratings: { Food: 3 },
    comment: "Lunch could be warmer",
  };

  store.submitFeedback("hostel_mess", payload, { user: student });
  assert.throws(
    () => store.submitFeedback("hostel_mess", payload, { user: student }),
    /Please wait before submitting feedback/
  );
});

test("campus feedback imports legacy browser-local entries without using moderation endpoints", () => {
  const store = createStore();
  const result = store.importLegacyFeedback(
    "transport",
    {
      entries: [
        {
          targetLabel: "Route 7",
          ratings: { Safety: 5 },
          comment: "Legacy entry from local storage",
          submittedAt: "2026-05-20T08:00:00.000Z",
        },
      ],
    },
    { user: student }
  );

  assert.equal(result.counts.imported, 1);
  assert.equal(result.imported[0].status, MODERATION_STATUS.PENDING);
  assert.equal(result.imported[0].targetLabel, "Route 7");
  assert.equal(store.listMine({ user: student, type: "transport" }).items.length, 1);
});

test("campus feedback admin list paginates and stays under p95 latency target with 10k rows", () => {
  const store = createStore();
  seedFeedbackEntries(store, 10000);

  const firstPage = store.listAdmin({
    user: admin,
    status: "pending",
    limit: 50,
    offset: 0,
  });
  assert.equal(firstPage.items.length, 50);
  assert.equal(firstPage.pagination.limit, 50);
  assert.equal(firstPage.pagination.offset, 0);
  assert.ok(firstPage.pagination.total > 3000);
  assert.equal(firstPage.counts.total, 10000);
  assert.ok(firstPage.items[0].audit.length > 0);

  const durations = [];
  for (let run = 0; run < 9; run += 1) {
    const startedAt = performance.now();
    const page = store.listAdmin({
      user: admin,
      status: "pending",
      limit: 50,
      offset: (run % 4) * 50,
    });
    durations.push(performance.now() - startedAt);
    assert.equal(page.items.length, 50);
  }

  const sorted = [...durations].sort((left, right) => left - right);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  console.log(`campus feedback admin list p95: ${p95.toFixed(2)}ms for 10000 rows`);
  assert.ok(p95 < 300, `expected p95 < 300ms, received ${p95.toFixed(2)}ms`);
});
