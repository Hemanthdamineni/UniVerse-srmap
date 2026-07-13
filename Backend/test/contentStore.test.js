const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { ContentStore } = require("../src/services/lms/contentStore");

function makeStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-store-test-"));
  return new ContentStore(path.join(tempDir, "content.sqlite"));
}

test("learning-material metadata powers catalog, subject, and library queries", () => {
  const store = makeStore();

  store.createContent({
    type: "learning_material",
    title: "Operating Systems Unit 1 Slides",
    description: "Scheduler introduction and process lifecycle notes.",
    category: "resources/learning-materials",
    metadata: {
      year: 2,
      semester: 4,
      courseCode: "CSE",
      courseName: "Computer Science and Engineering",
      subjectCode: "CSE304",
      subjectName: "Operating Systems",
      resourceGroup: "slides",
      tags: ["core", "os"],
    },
    resources: [
      {
        title: "Week 1 Slides",
        url_or_path: "https://example.com/os-week1.pdf",
        kind: "pdf",
      },
    ],
  });

  const catalog = store.getLearningMaterialCatalog({ year: 2 });
  assert.equal(catalog.years[0], 2);
  assert.equal(catalog.courses[0].courseCode, "CSE");
  assert.equal(catalog.courses[0].subjectCount, 1);

  const subjects = store.getLearningMaterialSubjects({ year: 2, courseCode: "cse" });
  assert.equal(subjects.subjects[0].subjectCode, "CSE304");
  assert.deepEqual(subjects.subjects[0].groups, ["slides"]);

  const library = store.getLearningMaterialLibrary({
    year: 2,
    courseCode: "CSE",
    subjectCode: "CSE304",
  });
  assert.equal(library.subject.subjectName, "Operating Systems");
  assert.equal(library.groups[0].group, "slides");
  assert.equal(library.totalResources, 1);
});

test("content lifecycle transitions are audited and recoverable", () => {
  const store = makeStore();
  const created = store.createContent(
    {
      type: "learning_material",
      title: "Database Systems Notes",
      description: "Normalization and indexing notes.",
      category: "resources/learning-materials",
      lifecycleState: "draft",
      metadata: {
        year: 3,
        semester: 5,
        courseCode: "CSE",
        courseName: "Computer Science and Engineering",
        subjectCode: "CSE301",
        subjectName: "Database Systems",
        resourceGroup: "notes",
      },
    },
    { actor: { actorId: "admin-1" }, reason: "Draft created" }
  );

  assert.equal(created.lifecycleState, "draft");
  assert.equal(created.version, 1);

  const updated = store.updateContent(
    created.id,
    { title: "Database Systems Revision Notes" },
    { actor: { actorId: "admin-2" }, reason: "Title clarified" }
  );
  assert.equal(updated.version, 2);
  assert.equal(updated.lastActor, "admin-2");

  const published = store.transitionContent(
    created.id,
    { action: "publish", reason: "Reviewed by faculty" },
    { actorId: "admin-2" }
  );
  assert.equal(published.lifecycleState, "published");

  const deleted = store.deleteContent(created.id, { actorId: "admin-3" });
  assert.equal(deleted.lifecycleState, "deleted");
  assert.equal(store.getContent(created.id), null);

  const restored = store.transitionContent(
    created.id,
    { action: "restore", reason: "Rollback after mistaken takedown" },
    { actorId: "admin-3" }
  );
  assert.equal(restored.lifecycleState, "published");

  const history = store.listContentHistory(created.id);
  assert.ok(history.some((entry) => entry.action === "create"));
  assert.ok(history.some((entry) => entry.action === "edit" && entry.actorId === "admin-2"));
  assert.ok(history.some((entry) => entry.action === "delete"));
  assert.ok(history[0].diff.lifecycleState || history.some((entry) => entry.diff.title));
});

test("bulk lifecycle preview validates before atomic execution", () => {
  const store = makeStore();
  const first = store.createContent({
    type: "learning_material",
    title: "OS Slides",
    category: "resources/learning-materials",
    lifecycleState: "published",
    metadata: { year: 2, courseCode: "CSE", subjectCode: "CSE304", resourceGroup: "slides" },
  });
  const second = store.createContent({
    type: "learning_material",
    title: "OS PYQ",
    category: "resources/learning-materials",
    lifecycleState: "published",
    metadata: { year: 2, courseCode: "CSE", subjectCode: "CSE304", resourceGroup: "pyq-sem" },
  });

  const preview = store.previewBulkLifecycle({ ids: [first.id, second.id], action: "archive" });
  assert.equal(preview.valid, true);
  assert.equal(preview.items[0].nextState, "archived");

  const result = store.bulkTransitionContent(
    { ids: [first.id, second.id], action: "archive", reason: "Semester cleanup" },
    { actorId: "admin-4" }
  );
  assert.equal(result.updated, 2);
  assert.equal(store.getContent(first.id).lifecycleState, "archived");
  assert.equal(store.getContent(second.id).lifecycleState, "archived");

  assert.throws(
    () => store.bulkTransitionContent({ ids: [first.id, "missing"], action: "publish" }, { actorId: "admin-4" }),
    /Bulk preview has invalid items/
  );
});
