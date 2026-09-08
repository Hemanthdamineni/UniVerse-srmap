const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { CareerStore } = require("../src/services/career/careerStore");

function makeStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "career-plan-"));
  return new CareerStore({ dbPath: path.join(tempDir, "career.sqlite") });
}

const USER = { role: "student", userId: "student-1", isAuthenticated: true };

test("create / list / stats for learning plans", () => {
  const store = makeStore();

  const p = store.createLearningPlan(USER, "  Kubernetes  ");
  assert.equal(p.skill, "Kubernetes");
  assert.equal(p.status, "active");

  // Same skill (any case) doesn't duplicate.
  const again = store.createLearningPlan(USER, "kubernetes");
  assert.equal(again.id, p.id);

  store.createLearningPlan(USER, "Docker");
  const { items, stats } = store.listLearningPlans(USER);
  assert.equal(items.length, 2);
  assert.deepEqual(stats, { active: 2, closed: 0, closedThisMonth: 0 });

  assert.throws(() => store.createLearningPlan(USER, ""), { status: 400 });
});

test("manual close + reopen, and delete", () => {
  const store = makeStore();
  const p = store.createLearningPlan(USER, "GraphQL");

  const closed = store.setLearningPlanStatus(USER, p.id, "closed");
  assert.equal(closed.status, "closed");
  assert.equal(closed.closedReason, "manual");
  assert.ok(closed.closedAt);
  assert.deepEqual(store.learningPlanStats(USER), { active: 0, closed: 1, closedThisMonth: 1 });

  const reopened = store.setLearningPlanStatus(USER, p.id, "active");
  assert.equal(reopened.status, "active");
  assert.equal(reopened.closedAt, null);

  // Reopening an existing closed plan via createLearningPlan works too.
  store.setLearningPlanStatus(USER, p.id, "closed");
  const viaCreate = store.createLearningPlan(USER, "graphql");
  assert.equal(viaCreate.status, "active");

  assert.deepEqual(store.deleteLearningPlan(USER, p.id), { deleted: true });
  assert.equal(store.listLearningPlans(USER).items.length, 0);
  assert.throws(() => store.setLearningPlanStatus(USER, "nope", "closed"), { status: 404 });
});

test("reconcileLearningPlans auto-closes plans for acquired skills (T4.3.3)", () => {
  const store = makeStore();
  store.createLearningPlan(USER, "Kubernetes");
  store.createLearningPlan(USER, "Docker");
  store.createLearningPlan(USER, "Rust");

  const closedIds = store.reconcileLearningPlans(USER, ["docker", "KUBERNETES", "Python"]);
  assert.equal(closedIds.length, 2);

  const { items, stats } = store.listLearningPlans(USER);
  assert.equal(stats.active, 1); // Rust
  assert.equal(stats.closed, 2);
  const rust = items.find((i) => i.skill === "Rust");
  assert.equal(rust.status, "active");
  const docker = items.find((i) => i.skill === "Docker");
  assert.equal(docker.status, "closed");
  assert.equal(docker.closedReason, "acquired");

  // Idempotent — a second pass closes nothing new.
  assert.deepEqual(store.reconcileLearningPlans(USER, ["docker", "kubernetes"]), []);
});
