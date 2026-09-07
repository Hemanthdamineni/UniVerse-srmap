const test = require("node:test");
const assert = require("node:assert/strict");

const { LmsRevisionScheduler } = require("../src/services/lms/lmsServices");

const NOW = "2026-09-07T00:00:00.000Z";
const nowMs = Date.parse(NOW);
const days = (n) => new Date(nowMs + n * 86_400_000).toISOString();

test("base SM-2 behaviour is unchanged when no context is passed", () => {
  const scheduler = new LmsRevisionScheduler();

  const failed = scheduler.getNextRevision({ score: 40, previousRepetition: 4, now: NOW });
  assert.equal(failed.interval, 1);
  assert.equal(failed.repetition, 0);
  assert.equal(failed.dueDate, days(1));
  assert.equal(failed.adjustedForAtRisk, undefined);
  assert.equal(failed.adjustedForExam, undefined);

  const first = scheduler.getNextRevision({ score: 85, previousRepetition: 0, now: NOW });
  assert.equal(first.interval, 1); // INTERVALS[0]
  assert.equal(first.repetition, 1);
  assert.equal(first.dueDate, days(1));

  const second = scheduler.getNextRevision({ score: 85, previousRepetition: 1, now: NOW });
  assert.equal(second.interval, 3); // INTERVALS[1]
  assert.equal(second.repetition, 2);
  assert.equal(second.dueDate, days(3));
});

test("an at-risk subject caps the interval at 3 days", () => {
  const scheduler = new LmsRevisionScheduler();
  const r = scheduler.getNextRevision({ score: 90, previousRepetition: 4, atRisk: true, now: NOW });
  // repetition 5 would normally be a 30-day interval.
  assert.equal(r.interval, 3);
  assert.equal(r.dueDate, days(3));
  assert.equal(r.adjustedForAtRisk, true);
});

test("at-risk does not stretch an already-short interval", () => {
  const scheduler = new LmsRevisionScheduler();
  const r = scheduler.getNextRevision({ score: 90, previousRepetition: 1, atRisk: true, now: NOW });
  assert.equal(r.interval, 3); // INTERVALS[1], already <= the at-risk cap
  assert.equal(r.adjustedForAtRisk, undefined);
});

test("a review is pulled two days in front of the nearest exam window", () => {
  const scheduler = new LmsRevisionScheduler();
  const r = scheduler.getNextRevision({
    score: 90,
    previousRepetition: 4, // natural interval = 30 days
    now: NOW,
    examWindows: [{ title: "Midterm Examinations", startAt: days(6) }],
  });
  assert.equal(r.dueDate, days(4)); // 6 - 2
  assert.equal(r.adjustedForExam, "Midterm Examinations");
});

test("an exam beyond the lookahead window is ignored", () => {
  const scheduler = new LmsRevisionScheduler();
  const r = scheduler.getNextRevision({
    score: 90,
    previousRepetition: 4,
    now: NOW,
    examWindows: [{ title: "End-Term", startAt: days(60) }],
  });
  assert.equal(r.dueDate, days(30));
  assert.equal(r.adjustedForExam, undefined);
});

test("a review that already lands before the exam is left alone", () => {
  const scheduler = new LmsRevisionScheduler();
  const r = scheduler.getNextRevision({
    score: 90,
    previousRepetition: 1, // 3-day interval
    now: NOW,
    examWindows: [{ title: "Midterm", startAt: days(20) }],
  });
  assert.equal(r.dueDate, days(3));
  assert.equal(r.adjustedForExam, undefined);
});

test("the injected academic calendar supplies exam windows automatically", () => {
  const scheduler = new LmsRevisionScheduler({
    academicCalendar: {
      listExamWindows: () => [{ title: "Practical Exam", startAt: days(9) }],
    },
  });
  const r = scheduler.getNextRevision({ score: 90, previousRepetition: 4, now: NOW });
  assert.equal(r.dueDate, days(7));
  assert.equal(r.adjustedForExam, "Practical Exam");
});

test("at-risk + exam compression compose (nearest constraint wins)", () => {
  const scheduler = new LmsRevisionScheduler();
  const r = scheduler.getNextRevision({
    score: 90,
    previousRepetition: 4,
    atRisk: true, // caps interval to 3 → due in 3 days
    now: NOW,
    examWindows: [{ title: "CLA-2 Marks", startAt: days(2) }], // exam even sooner
  });
  assert.equal(r.adjustedForAtRisk, true);
  assert.equal(r.adjustedForExam, "CLA-2 Marks");
  assert.equal(r.dueDate, days(1)); // max(now+1, start-2) = now+1
});
