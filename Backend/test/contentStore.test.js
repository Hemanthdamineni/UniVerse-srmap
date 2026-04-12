const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { ContentStore } = require("../src/services/contentStore");

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
