const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

const { ErpAcademicSnapshotStore } = require("../src/services/erp/erpAcademicSnapshotStore");
const { StudentGraphService } = require("../src/services/core/studentGraphService");

function freshStore(opts = {}) {
  return new ErpAcademicSnapshotStore({
    dbPath: path.join(os.tmpdir(), `erp-academic-${process.pid}-${Date.now()}-${Math.random()}.sqlite`),
    ...opts,
  });
}

const USER = "AP23110010001";

test("ingests student-wise-subjects into a curriculum row", () => {
  const store = freshStore();
  const kind = store.ingest({
    userKey: USER,
    pageKey: "academic/student-wise-subjects",
    payload: {
      _extracted: {
        type: "subjects",
        records: [
          { code: "CSE101", name: "DSA", credit: "4", semester: "3" },
          { code: "CSE102", name: "OS", credit: "3", semester: "3" },
          { code: "", name: "junk" },
        ],
      },
    },
  });
  assert.equal(kind, "curriculum");

  const reader = store.readerFor();
  const cur = reader.getCurriculum(USER);
  assert.equal(cur.subjects.length, 2);
  assert.equal(cur.subjects[0].code, "CSE101");
  assert.equal(cur.subjects[0].credit, 4);
  assert.equal(cur.stale, false);
});

test("ingests current-semester-results + cgpa + exam history into one results row", () => {
  const store = freshStore();

  store.ingest({
    userKey: USER,
    pageKey: "examination/current-semester-results",
    payload: {
      _extracted: {
        type: "current-results",
        records: [
          { subjectCode: "CSE101", grade: "A", result: "Pass", extras: { credit: "4" } },
          { subjectCode: "CSE102", grade: "B+", result: "Pass", extras: { credit: "3" } },
        ],
      },
    },
  });
  store.ingest({
    userKey: USER,
    pageKey: "academic/cgpa-summary",
    payload: { TableContent: { "Current CGPA": "8.42" } },
  });
  store.ingest({
    userKey: USER,
    pageKey: "examination/exam-mark-details",
    payload: {
      _extracted: {
        records: [
          { semesterNo: "1", gradePoints: "9", credit: "4" },
          { semesterNo: "1", gradePoints: "8", credit: "3" },
          { semesterNo: "2", gradePoints: "10", credit: "4" },
        ],
      },
    },
  });

  const results = store.readerFor().getResults(USER);
  assert.equal(results.cgpa, 8.42);
  assert.equal(results.currentSubjects.length, 2);
  assert.equal(results.currentSubjects[0].code, "CSE101");
  // sem 1: (9*4 + 8*3) / 7 = 8.571...
  const sem1 = results.sgpaBySemester.find((s) => s.semester === 1);
  assert.ok(Math.abs(sem1.sgpa - 8.57) < 0.01);
  assert.equal(results.sgpaBySemester.find((s) => s.semester === 2).sgpa, 10);
});

test("ignores unrelated page keys and empty payloads", () => {
  const store = freshStore();
  assert.equal(store.ingest({ userKey: USER, pageKey: "academic/time-table", payload: { records: [] } }), null);
  assert.equal(store.ingest({ userKey: USER, pageKey: "academic/student-wise-subjects", payload: { _extracted: { records: [] } } }), null);
  assert.equal(store.readerFor().getCurriculum(USER), null);
  assert.equal(store.readerFor().getResults(USER), null);
});

test("marks rows stale past the freshness window", () => {
  const store = freshStore({ staleAfterMs: -1 }); // everything is instantly stale
  store.ingest({
    userKey: USER,
    pageKey: "academic/student-wise-subjects",
    payload: { _extracted: { records: [{ code: "CSE101", name: "DSA", credit: "4", semester: "3" }] } },
  });
  assert.equal(store.readerFor().getCurriculum(USER).stale, true);
});

test("graph consumes the store's readerFor() output", () => {
  const store = freshStore();
  store.ingest({
    userKey: USER,
    pageKey: "academic/student-wise-subjects",
    payload: { _extracted: { records: [
      { code: "CSE101", name: "DSA", credit: "4", semester: "3" },
      { code: "CSE102", name: "OS", credit: "3", semester: "3" },
    ] } },
  });
  store.ingest({
    userKey: USER,
    pageKey: "academic/cgpa-summary",
    payload: { TableContent: { "Current CGPA": "8.4" } },
  });

  const svc = new StudentGraphService({
    unifiedProfileStore: { buildUnifiedProfile: () => ({ user: { userId: USER }, skills: [], achievements: [], events: {}, lms: {}, career: { completeness: 0, skillGaps: [] } }) },
    erpReader: store.readerFor(),
  });

  const g = svc.getGraph({ userId: USER, name: "Grapher" });
  assert.equal(g.academic.curriculum.totalCredits, 7);
  assert.equal(g.sources.curriculum, "cache");
  assert.equal(g.academic.results.cgpa, 8.4);
  assert.equal(g.derived.readinessBreakdown.academic > 0, true); // CGPA feeds it
});
