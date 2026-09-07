const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseDdMmYyyy,
  parseAcademicDateRange,
  listAcademicMilestones,
  listExamWindows,
  examKind,
} = require("../src/services/core/academicCalendar");

test("parseDdMmYyyy parses a single date and rejects other formats", () => {
  assert.equal(parseDdMmYyyy("05.10.2026"), "2026-10-05T23:59:00.000Z");
  assert.equal(parseDdMmYyyy("2026-10-05"), null);
  assert.equal(parseDdMmYyyy(""), null);
});

test("parseAcademicDateRange handles single dates and ranges", () => {
  assert.deepEqual(parseAcademicDateRange("28.09.2026"), {
    startAt: "2026-09-28T23:59:00.000Z",
    endAt: "2026-09-28T23:59:00.000Z",
  });
  const range = parseAcademicDateRange("28.09.2026 - 01.10.2026");
  assert.equal(range.startAt, "2026-09-28T23:59:00.000Z");
  assert.equal(range.endAt, "2026-10-01T23:59:00.000Z");
  assert.equal(parseAcademicDateRange("not a date"), null);
});

test("examKind classifies assessment rows and ignores the rest", () => {
  assert.equal(examKind("Midterm Examinations/ Assessments"), "midterm");
  assert.equal(examKind("Mid-Term Examinations/Assessments"), "midterm");
  assert.equal(examKind("Window for End-Term Examinations"), "endterm");
  assert.equal(examKind("Window for Semester Practical Examinations"), "practical");
  assert.equal(examKind("Last Date to Enter CLA-1 Marks in ERP"), "cla");
  assert.equal(examKind("Commencement of Classes"), null);
  assert.equal(examKind("Winter Break for Students"), null);
});

test("listAcademicMilestones includes range-dated rows (dueAt = last day)", () => {
  const milestones = listAcademicMilestones();
  assert.ok(milestones.length > 20);
  const midterm = milestones.find((m) => /Midterm Examinations/i.test(m.title));
  assert.ok(midterm, "expected the mid-term milestone");
  assert.equal(midterm.dueAt, "2026-10-01T23:59:00.000Z"); // end of the range
  assert.ok(milestones.every((m) => m.source === "academic-calendar" && m.dueAt));
});

test("listExamWindows returns only assessments, sorted, future-filtered", () => {
  const all = listExamWindows({ now: Date.parse("2026-01-01T00:00:00.000Z") });
  assert.ok(all.length >= 6);
  assert.ok(all.every((w) => ["midterm", "endterm", "practical", "cla"].includes(w.kind)));
  const starts = all.map((w) => Date.parse(w.startAt));
  assert.deepEqual(starts, [...starts].sort((a, b) => a - b));

  // A cutoff after every 2026 window drops them.
  const late = listExamWindows({ now: Date.parse("2027-09-01T00:00:00.000Z") });
  assert.ok(late.every((w) => Date.parse(w.endAt) >= Date.parse("2027-09-01T00:00:00.000Z")));
});
