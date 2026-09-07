const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

const { LmsStore } = require("../src/services/lms/lmsStore");
const { LmsModerationService } = require("../src/services/lms/lmsServices");
const { LmsRevisionScheduler } = require("../src/services/lms/lmsServices");

function createStore(name) {
  const root = path.join(os.tmpdir(), `lms-revision-weight-${name}-${process.pid}-${Date.now()}`);
  return new LmsStore({
    dbPath: path.join(root, "lms.sqlite"),
    filesDir: path.join(root, "files"),
    moderationService: new LmsModerationService(),
    // No calendar wired — isolates the at-risk weighting from exam compression.
    revisionScheduler: new LmsRevisionScheduler(),
  });
}

function makeResource(store, overrides) {
  return store.createResource("publisher-1", {
    type: "note",
    title: overrides.title || "Notes",
    description: "Revision notes.",
    semester: "6",
    subjectCode: overrides.subjectCode,
    subjectName: overrides.subjectName || overrides.subjectCode,
    unit: "Unit 1",
    difficulty: "intermediate",
    tags: ["revision"],
    noteContent: "content",
    estimatedMinutes: 10,
  });
}

const USER = "AP1";

test("an at-risk subject's revision interval is capped when its marks are entered late", () => {
  const store = createStore("cap");
  const atRisk = makeResource(store, { subjectCode: "CSE301", title: "OS notes" });
  const healthy = makeResource(store, { subjectCode: "CSE302", title: "DS notes" });

  // Climb both schedules to repetition 4 (14-day interval).
  for (let i = 0; i < 4; i += 1) {
    store.updateRevisionSchedule(USER, atRisk.id, 90);
    store.updateRevisionSchedule(USER, healthy.id, 90);
  }

  // Fifth review: the natural interval is 30 days for both.
  store.updateRevisionSchedule(USER, healthy.id, 90);
  store.updateRevisionSchedule(USER, atRisk.id, 90, { atRiskCodes: ["cse301"] });

  const queue = store.getRevisionQueue(USER);
  const byId = Object.fromEntries(queue.map((row) => [row.resourceId, row]));
  assert.equal(byId[healthy.id].interval, 30);
  assert.equal(byId[atRisk.id].interval, 3); // capped for the at-risk subject
});

test("generateLearningSession floats an at-risk subject to the front of the session", () => {
  const store = createStore("session");
  const soon = makeResource(store, { subjectCode: "CSE302", title: "DS notes" });
  const atRisk = makeResource(store, { subjectCode: "CSE301", title: "OS notes" });

  // CSE302 stays on a 1-day interval (due first); CSE301 is pushed far out.
  store.updateRevisionSchedule(USER, soon.id, 90);
  for (let i = 0; i < 5; i += 1) store.updateRevisionSchedule(USER, atRisk.id, 90);

  const plain = store.generateLearningSession(USER, 30);
  assert.equal(plain.revision[0].resourceId, soon.id); // pure chronological

  const weighted = store.generateLearningSession(USER, 30, { atRiskCodes: ["CSE301"] });
  assert.equal(weighted.revision[0].resourceId, atRisk.id); // at-risk floated up
});
