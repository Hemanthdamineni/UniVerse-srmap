const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { EventsStore } = require("../src/services/events/eventsStore");
const { createCompetitionStore } = require("../src/services/events/competitionStore");
const { createPersistentTeamStore } = require("../src/services/events/persistentTeamStore");
const {
  computeCompetitionScore,
  computeTeamScore,
  bandLabel,
} = require("../src/services/events/scoresService");

// All test event dates are anchored to a fixed future reference (2099),
// so the suite is deterministic regardless of when it's run and
// doesn't depend on the wall clock. The "now" used for the recency
// calculations is the same future reference, so the math is
// independent of real time.
const TEST_NOW = new Date("2099-06-15T12:00:00.000Z");
const ISO = (d) => new Date(d).toISOString();
const FUTURE = (offsetDays) => ISO(TEST_NOW.getTime() + offsetDays * 86400000);

function makeStores() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scores-test-"));
  const eventsDbPath = path.join(tempDir, "events.sqlite");
  const persistentDbPath = path.join(tempDir, "persistent-teams.sqlite");
  const eventsStore = new EventsStore({ dataDir: tempDir, dbPath: eventsDbPath });
  const competitionStore = createCompetitionStore({ eventsStore, dbPath: eventsDbPath });
  const persistentTeamStore = createPersistentTeamStore({ dbPath: persistentDbPath });
  return { tempDir, eventsStore, competitionStore, persistentTeamStore };
}

function makeUser(overrides = {}) {
  return {
    role: "student",
    userId: "s1",
    name: "Student",
    email: "student@erp.edu",
    department: "CSE",
    ...overrides,
  };
}

function createIndividualCompetitionEvent(eventsStore, creator = makeUser({ userId: "org1", role: "admin" })) {
  const [event] = eventsStore.createEvent(
    {
      title: "Solo Comp",
      description: "solo",
      startAt: FUTURE(-30),
      endAt: FUTURE(30),
      location: { physical: "Hall" },
      organizer: "Club",
      department: "CSE",
      maxCapacity: 100,
      registrationDeadline: FUTURE(7),
      visibility: "public",
      status: "published",
      competitionConfig: JSON.stringify({
        isCompetition: true,
        rounds: [
          {
            roundId: "r1",
            title: "Round 1",
            submissionDeadline: "2099-01-01T00:00:00.000Z",
            submissionTypes: ["link"],
            maxResubmissions: 2,
            evaluationCriteria: [{ label: "Innovation", maxScore: 10 }],
            resultsPublished: false,
          },
          {
            roundId: "r2",
            title: "Round 2",
            submissionDeadline: "2099-02-01T00:00:00.000Z",
            submissionTypes: ["link"],
            maxResubmissions: 1,
            evaluationCriteria: [{ label: "Final", maxScore: 20 }],
            requiresShortlistFromRound: "r1",
            resultsPublished: false,
          },
        ],
      }),
    },
    { user: creator }
  );
  return event;
}

function createTeamCompetitionEvent(eventsStore, creator = makeUser({ userId: "org1", role: "admin" }), maxTeamSize = 4) {
  const [event] = eventsStore.createEvent(
    {
      title: "Team Comp",
      description: "team",
      startAt: FUTURE(-30),
      endAt: FUTURE(30),
      location: { physical: "Hall" },
      organizer: "Club",
      department: "CSE",
      maxCapacity: 100,
      registrationDeadline: FUTURE(7),
      visibility: "public",
      status: "published",
      competitionConfig: JSON.stringify({
        isCompetition: true,
        submissionScope: "team",
        maxTeamSize,
        rounds: [
          {
            roundId: "r1",
            title: "Round 1",
            submissionDeadline: "2099-01-01T00:00:00.000Z",
            submissionTypes: ["link"],
            maxResubmissions: 1,
            evaluationCriteria: [{ label: "Innovation", maxScore: 10 }],
            resultsPublished: false,
          },
        ],
      }),
    },
    { user: creator }
  );
  return event;
}

test("competition score is zero for a user with no registrations", () => {
  const { eventsStore, competitionStore } = makeStores();
  const out = computeCompetitionScore({
    competitionStore,
    eventsStore,
    userId: "s_new",
    now: TEST_NOW,
  });
  assert.equal(out.score, 0);
  assert.equal(out.dimensions.find((d) => d.id === "participation").points, 0);
  assert.equal(out.meta.activeRegistrationCount, 0);
});

test("competition score rewards participation, submission progress, and recency", () => {
  const { eventsStore, competitionStore } = makeStores();
  const event = createIndividualCompetitionEvent(eventsStore);
  const student = makeUser({ userId: "s1" });
  eventsStore.register(event.id, {}, { user: student });
  // Override the registration timestamp to be ~1 day before TEST_NOW
  // so the recency bucket lands in "this-week" (20 points). The
  // events store sets the real wall-clock time during register(); we
  // patch the in-memory map to anchor the recency math to TEST_NOW.
  const reg = eventsStore.registrationsByUser.get(student.userId)[0];
  reg.registeredAt = ISO(TEST_NOW.getTime() - 1 * 24 * 60 * 60 * 1000);
  competitionStore.createSubmission(event.id, "r1", student.userId, {
    type: "link",
    linkUrl: "https://example.com/work",
  });
  const out = computeCompetitionScore({
    competitionStore,
    eventsStore,
    userId: student.userId,
    now: TEST_NOW,
  });
  const participation = out.dimensions.find((d) => d.id === "participation");
  assert.equal(participation.points, 5);
  const progress = out.dimensions.find((d) => d.id === "submission-progress");
  assert.equal(progress.points, 15);
  assert.match(progress.summary, /1 of 2/);
  const recency = out.dimensions.find((d) => d.id === "recency");
  assert.equal(recency.points, 20);
  const evaluation = out.dimensions.find((d) => d.id === "evaluation");
  assert.equal(evaluation.points, 0);
  assert.equal(out.score, 5 + 15 + 0 + 20);
});

test("competition score gives full marks for shortlist + published results", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const student = makeUser({ userId: "s1" });
  const event = createIndividualCompetitionEvent(eventsStore, creator);
  eventsStore.register(event.id, {}, { user: student });
  const submission = competitionStore.createSubmission(event.id, "r1", student.userId, {
    type: "link",
    linkUrl: "https://example.com/work",
  });
  competitionStore.evaluateSubmission(submission.id, creator, {
    criteriaScores: { Innovation: 9 },
    remarks: "great",
    decision: "selected",
  });
  competitionStore.applyShortlist(event.id, "r1", creator, { mode: "topN", value: 1 });
  competitionStore.publishResults(event.id, "r1", creator);

  const out = computeCompetitionScore({
    competitionStore,
    eventsStore,
    userId: student.userId,
    now: TEST_NOW,
  });
  const evaluation = out.dimensions.find((d) => d.id === "evaluation");
  assert.equal(evaluation.points, 30);
  assert.deepEqual(out.meta.evaluationSignals.sort(), ["evaluated", "results-published", "shortlisted"]);
});

test("competition score clamps participation at 4 registrations", () => {
  const { eventsStore, competitionStore } = makeStores();
  for (let i = 0; i < 6; i += 1) {
    const e = createIndividualCompetitionEvent(eventsStore);
    eventsStore.register(e.id, {}, { user: makeUser({ userId: "s1" }) });
  }
  const out = computeCompetitionScore({
    competitionStore,
    eventsStore,
    userId: "s1",
  });
  const participation = out.dimensions.find((d) => d.id === "participation");
  assert.equal(participation.points, 20);
  assert.equal(out.meta.activeRegistrationCount, 6);
});

test("team score is zero for a user with no teams", () => {
  const { competitionStore, persistentTeamStore } = makeStores();
  const out = computeTeamScore({ competitionStore, persistentTeamStore, userId: "s_lonely" });
  assert.equal(out.score, 0);
  for (const dim of out.dimensions) {
    assert.equal(dim.points, 0);
  }
});

test("team score rewards leading an event team and a persistent squad", () => {
  const { eventsStore, competitionStore, persistentTeamStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const student = makeUser({ userId: "s1" });

  const event = createTeamCompetitionEvent(eventsStore, creator);
  eventsStore.register(event.id, {}, { user: student });
  competitionStore.createTeam(event.id, student.userId, { name: "Alpha" });

  persistentTeamStore.createTeam(student.userId, { name: "Squad", inviteRegNos: [] });

  const out = computeTeamScore({ competitionStore, persistentTeamStore, userId: student.userId });
  const leadership = out.dimensions.find((d) => d.id === "leadership");
  assert.equal(leadership.points, 25);
  const roster = out.dimensions.find((d) => d.id === "roster");
  assert.equal(roster.points, 7);
  const breadth = out.dimensions.find((d) => d.id === "breadth");
  assert.equal(breadth.points, 10);
  assert.equal(out.score, 25 + 7 + 10);
  assert.equal(out.meta.eventTeamsLed, 1);
  assert.equal(out.meta.persistentLed, 1);
});

test("team score caps leadership at 40 even with many teams", () => {
  const { eventsStore, competitionStore, persistentTeamStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const student = makeUser({ userId: "s1" });

  for (let i = 0; i < 3; i += 1) {
    const e = createTeamCompetitionEvent(eventsStore, creator);
    eventsStore.register(e.id, {}, { user: student });
    competitionStore.createTeam(e.id, student.userId, { name: `T${i}` });
  }
  persistentTeamStore.createTeam(student.userId, { name: "P0", inviteRegNos: [] });
  persistentTeamStore.createTeam(student.userId, { name: "P1", inviteRegNos: [] });

  const out = computeTeamScore({ competitionStore, persistentTeamStore, userId: student.userId });
  const leadership = out.dimensions.find((d) => d.id === "leadership");
  assert.equal(leadership.points, 40);
  assert.equal(leadership.max, 40);
});

test("competition recency decays by recency bucket", () => {
  const { eventsStore, competitionStore } = makeStores();
  const student = makeUser({ userId: "s1" });
  const event = createIndividualCompetitionEvent(eventsStore);
  eventsStore.register(event.id, {}, { user: student });
  const reg = eventsStore.registrationsByUser.get(student.userId)[0];
  // "now" is anchored 14 days after the registration so the recency
  // bucket always lands in "this month", regardless of when the test
  // is run.
  const fourteenDaysAfterRegistration = ISO(TEST_NOW.getTime() - 14 * 24 * 60 * 60 * 1000);
  reg.registeredAt = fourteenDaysAfterRegistration;
  const out = computeCompetitionScore({ competitionStore, eventsStore, userId: student.userId, now: TEST_NOW });
  const recency = out.dimensions.find((d) => d.id === "recency");
  assert.equal(recency.points, 12);
  assert.match(recency.summary, /this month/i);
});

test("bandLabel maps to readable strings", () => {
  assert.equal(bandLabel("excellent"), "Excellent");
  assert.equal(bandLabel("strong"), "Strong");
  assert.equal(bandLabel("building"), "Building");
  assert.equal(bandLabel("starting"), "Getting started");
  assert.equal(bandLabel("none"), "No activity yet");
});
