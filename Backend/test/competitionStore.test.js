const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { EventsStore } = require("../src/services/events/eventsStore");
const { createCompetitionStore } = require("../src/services/events/competitionStore");

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

function makeStores() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "competition-store-test-"));
  const dbPath = path.join(tempDir, "events.sqlite");
  const eventsStore = new EventsStore({ dataDir: tempDir, dbPath });
  const competitionStore = createCompetitionStore({ eventsStore, dbPath });
  return { eventsStore, competitionStore };
}

function createCompetitionEvent(eventsStore, creator = makeUser({ userId: "org1", role: "admin" })) {
  const [event] = eventsStore.createEvent(
    {
      title: "Competition Event",
      description: "Competition",
      startAt: "2026-08-01T09:00:00.000Z",
      endAt: "2026-08-30T11:00:00.000Z",
      location: { physical: "Hall" },
      organizer: "Club",
      department: "CSE",
      maxCapacity: 100,
      registrationDeadline: "2026-08-29T23:59:59.000Z",
      visibility: "public",
      status: "published",
      competitionConfig: JSON.stringify({
        isCompetition: true,
        rounds: [
          {
            roundId: "r1",
            title: "Round 1",
            submissionDeadline: "2099-01-01T00:00:00.000Z",
            submissionTypes: ["file", "link"],
            maxResubmissions: 2,
            evaluationCriteria: [
              { label: "Innovation", maxScore: 10 },
              { label: "Implementation", maxScore: 10 },
            ],
            resultsPublished: false,
          },
        ],
      }),
    },
    { user: creator }
  );
  return event;
}

function createTwoRoundCompetitionEvent(
  eventsStore,
  creator = makeUser({ userId: "org1", role: "admin" })
) {
  const [event] = eventsStore.createEvent(
    {
      title: "Two Round Competition",
      description: "Competition",
      startAt: "2026-08-01T09:00:00.000Z",
      endAt: "2026-08-30T11:00:00.000Z",
      location: { physical: "Hall" },
      organizer: "Club",
      department: "CSE",
      maxCapacity: 100,
      registrationDeadline: "2026-08-29T23:59:59.000Z",
      visibility: "public",
      status: "published",
      competitionConfig: JSON.stringify({
        isCompetition: true,
        rounds: [
          {
            roundId: "r1",
            title: "Round 1",
            startTime: "2026-08-02T00:00:00.000Z",
            submissionDeadline: "2099-01-01T00:00:00.000Z",
            submissionTypes: ["file", "link"],
            maxResubmissions: 2,
            evaluationCriteria: [
              { label: "Innovation", maxScore: 10 },
              { label: "Implementation", maxScore: 10 },
            ],
            resultsPublished: false,
          },
          {
            roundId: "r2",
            title: "Round 2",
            startTime: "2026-01-01T00:00:00.000Z",
            submissionDeadline: "2099-01-15T00:00:00.000Z",
            submissionTypes: ["link"],
            maxResubmissions: 1,
            evaluationCriteria: [{ label: "Final Pitch", maxScore: 20 }],
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

function createTeamScopedCompetitionEvent(
  eventsStore,
  creator = makeUser({ userId: "org1", role: "admin" }),
  maxTeamSize = 2
) {
  const [event] = eventsStore.createEvent(
    {
      title: "Team Competition",
      description: "Team scope",
      startAt: "2026-08-01T09:00:00.000Z",
      endAt: "2026-08-30T11:00:00.000Z",
      location: { physical: "Hall" },
      organizer: "Club",
      department: "CSE",
      maxCapacity: 100,
      registrationDeadline: "2026-08-29T23:59:59.000Z",
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
            maxResubmissions: 2,
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

test("submission limit is enforced", () => {
  const { eventsStore, competitionStore } = makeStores();
  const event = createCompetitionEvent(eventsStore);
  eventsStore.register(event.id, {}, { user: makeUser({ userId: "s1", role: "student" }) });

  competitionStore.createSubmission(event.id, "r1", "s1", {
    type: "link",
    linkUrl: "https://example.com/one",
    description: "first",
  });
  competitionStore.createSubmission(event.id, "r1", "s1", {
    type: "link",
    linkUrl: "https://example.com/two",
    description: "second",
  });

  let error = null;
  try {
    competitionStore.createSubmission(event.id, "r1", "s1", {
      type: "link",
      linkUrl: "https://example.com/three",
    });
  } catch (caught) {
    error = caught;
  }
  assert.equal(error?.status, 429);
});

test("conflict-of-interest blocks self-evaluation", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const event = createCompetitionEvent(eventsStore, creator);
  eventsStore.register(event.id, {}, { user: creator });
  const submission = competitionStore.createSubmission(event.id, "r1", "org1", {
    type: "link",
    linkUrl: "https://example.com/work",
  });
  let error = null;
  try {
    competitionStore.evaluateSubmission(submission.id, creator, {
      criteriaScores: { Innovation: 8, Implementation: 9 },
      remarks: "good",
      decision: "selected",
    });
  } catch (caught) {
    error = caught;
  }
  assert.equal(error?.status, 403);
});

test("result fields are hidden before publish and visible after publish", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const participant = makeUser({ userId: "s1", role: "student" });
  const event = createCompetitionEvent(eventsStore, creator);
  eventsStore.register(event.id, {}, { user: participant });
  const submission = competitionStore.createSubmission(event.id, "r1", participant.userId, {
    type: "link",
    linkUrl: "https://example.com/work",
  });
  competitionStore.evaluateSubmission(submission.id, creator, {
    criteriaScores: { Innovation: 8, Implementation: 9 },
    remarks: "good",
    decision: "selected",
  });

  const hiddenResult = competitionStore.getMyResult(event.id, "r1", participant.userId);
  assert.equal(hiddenResult.totalScore, undefined);

  competitionStore.publishResults(event.id, "r1", creator);
  const visibleResult = competitionStore.getMyResult(event.id, "r1", participant.userId);
  assert.equal(typeof visibleResult.totalScore, "number");
});

test("round 2 access requires shortlist from round 1", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const participant = makeUser({ userId: "s1", role: "student" });
  const event = createTwoRoundCompetitionEvent(eventsStore, creator);
  eventsStore.register(event.id, {}, { user: participant });
  let blocked = null;
  try {
    competitionStore.createSubmission(event.id, "r2", participant.userId, {
      type: "link",
      linkUrl: "https://example.com/r2",
    });
  } catch (caught) {
    blocked = caught;
  }
  assert.equal(blocked?.status, 403);

  const r1Submission = competitionStore.createSubmission(event.id, "r1", participant.userId, {
    type: "link",
    linkUrl: "https://example.com/r1",
  });
  competitionStore.evaluateSubmission(r1Submission.id, creator, {
    criteriaScores: { Innovation: 8, Implementation: 9 },
    decision: "selected",
  });
  competitionStore.applyShortlist(event.id, "r1", creator, { mode: "topN", value: 1 });
  const r2Submission = competitionStore.createSubmission(event.id, "r2", participant.userId, {
    type: "link",
    linkUrl: "https://example.com/r2-now",
  });
  assert.equal(r2Submission.roundId, "r2");
});

test("evaluation rejects out-of-range or unknown criteria scores", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const participant = makeUser({ userId: "s1", role: "student" });
  const event = createCompetitionEvent(eventsStore, creator);
  eventsStore.register(event.id, {}, { user: participant });
  const submission = competitionStore.createSubmission(event.id, "r1", participant.userId, {
    type: "link",
    linkUrl: "https://example.com/work",
  });

  assert.throws(
    () =>
      competitionStore.evaluateSubmission(submission.id, creator, {
        criteriaScores: { Innovation: 99 },
      }),
    (error) => error?.status === 400
  );
  assert.throws(
    () =>
      competitionStore.evaluateSubmission(submission.id, creator, {
        criteriaScores: { NonExistingCriteria: 5 },
      }),
    (error) => error?.status === 400
  );
});

test("publish sends next-round-open notifications to shortlisted users", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const participant = makeUser({ userId: "s1", role: "student" });
  const event = createTwoRoundCompetitionEvent(eventsStore, creator);
  eventsStore.register(event.id, {}, { user: participant });
  const submission = competitionStore.createSubmission(event.id, "r1", participant.userId, {
    type: "link",
    linkUrl: "https://example.com/r1",
  });
  competitionStore.evaluateSubmission(submission.id, creator, {
    criteriaScores: { Innovation: 9, Implementation: 9 },
    decision: "selected",
  });
  competitionStore.applyShortlist(event.id, "r1", creator, { mode: "topN", value: 1 });
  competitionStore.publishResults(event.id, "r1", creator);
  const notifications = eventsStore
    .listNotifications(participant.userId)
    .filter((item) => item.type === "competition_next_round_open");
  assert.equal(notifications.length, 1);
});

test("organizer announcement is permission-gated and delivered to registrants", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const outsider = makeUser({ userId: "x1", role: "student" });
  const participant = makeUser({ userId: "s1", role: "student" });
  const event = createCompetitionEvent(eventsStore, creator);
  eventsStore.register(event.id, {}, { user: participant });

  assert.throws(
    () =>
      competitionStore.sendOrganizerAnnouncement(event.id, outsider, {
        subject: "Update",
        message: "Please check schedule.",
      }),
    (error) => error?.status === 403
  );

  const result = competitionStore.sendOrganizerAnnouncement(event.id, creator, {
    subject: "Round update",
    message: "Round starts tomorrow.",
  });
  assert.equal(result.sentCount, 1);
  const notifications = eventsStore.listNotifications(participant.userId);
  assert.ok(notifications.some((item) => item.title === "Round update"));
});

test("team creation/invitation acceptance enforces one-team-per-user and max size", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const s1 = makeUser({ userId: "s1", role: "student" });
  const s2 = makeUser({ userId: "s2", role: "student" });
  const s3 = makeUser({ userId: "s3", role: "student" });
  const event = createTeamScopedCompetitionEvent(eventsStore, creator, 2);
  eventsStore.register(event.id, {}, { user: s1 });
  eventsStore.register(event.id, {}, { user: s2 });
  eventsStore.register(event.id, {}, { user: s3 });

  const team = competitionStore.createTeam(event.id, s1.userId, { name: "Alpha" });
  assert.equal(team.leaderId, s1.userId);
  assert.equal(competitionStore.getMyTeam(event.id, s1.userId)?.id, team.id);

  const invite = competitionStore.inviteMember(event.id, team.id, s1.userId, {
    inviteeRegisterNumber: s2.userId,
  });
  assert.equal(invite.status, "pending");
  competitionStore.acceptInvitation(event.id, invite.id, s2.userId);

  assert.throws(
    () =>
      competitionStore.inviteMember(event.id, team.id, s1.userId, {
        inviteeRegisterNumber: s3.userId,
      }),
    (error) => error?.status === 409
  );

  assert.throws(
    () =>
      competitionStore.createTeam(event.id, s2.userId, {
        name: "Beta",
      }),
    (error) => error?.status === 409
  );
});

test("team recruitment board exposes open teams and scores available teammates", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const s1 = makeUser({ userId: "s1", role: "student", department: "CSE" });
  const s2 = makeUser({ userId: "s2", role: "student", department: "ECE" });
  const s3 = makeUser({ userId: "s3", role: "student", department: "CSE" });
  const event = createTeamScopedCompetitionEvent(eventsStore, creator, 3);
  eventsStore.register(event.id, {}, { user: s1 });
  eventsStore.register(event.id, { formResponses: [{ answer: "I can handle React UI and demos" }] }, { user: s2 });
  eventsStore.register(event.id, { formResponses: [{ answer: "React, pitch deck, and TypeScript" }] }, { user: s3 });

  const team = competitionStore.createTeam(event.id, s1.userId, { name: "Alpha" });
  const post = competitionStore.upsertTeamRecruitmentPost(event.id, s1.userId, {
    neededSkills: ["React", "Pitch"],
    description: "Looking for frontend and presentation support.",
    openSlots: 2,
  });
  assert.equal(post.teamId, team.id);
  assert.deepEqual(post.neededSkills, ["React", "Pitch"]);

  const board = competitionStore.listTeamRecruitmentBoard(event.id, s2);
  assert.equal(board.length, 1);
  assert.equal(board[0].team.name, "Alpha");
  assert.equal(board[0].team.leaderRegNo, s1.userId);

  const matches = competitionStore.listTeamMatches(event.id, s1);
  assert.equal(matches[0].userId, s3.userId);
  assert.ok(matches[0].matchScore > matches[1].matchScore);
  assert.ok(matches[0].matchedSkills.includes("React"));
});

test("team-scoped submission blocks non-members and non-leaders", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const leader = makeUser({ userId: "s1", role: "student" });
  const member = makeUser({ userId: "s2", role: "student" });
  const outsider = makeUser({ userId: "s3", role: "student" });
  const event = createTeamScopedCompetitionEvent(eventsStore, creator, 3);
  eventsStore.register(event.id, {}, { user: leader });
  eventsStore.register(event.id, {}, { user: member });
  eventsStore.register(event.id, {}, { user: outsider });

  const team = competitionStore.createTeam(event.id, leader.userId, { name: "TeamOne" });
  const invite = competitionStore.inviteMember(event.id, team.id, leader.userId, {
    inviteeRegisterNumber: member.userId,
  });
  competitionStore.acceptInvitation(event.id, invite.id, member.userId);

  assert.throws(
    () =>
      competitionStore.createSubmission(event.id, "r1", outsider.userId, {
        type: "link",
        linkUrl: "https://example.com/out",
      }),
    (error) => error?.status === 403
  );

  assert.throws(
    () =>
      competitionStore.createSubmission(event.id, "r1", member.userId, {
        type: "link",
        linkUrl: "https://example.com/member",
      }),
    (error) => error?.status === 403
  );

  const submission = competitionStore.createSubmission(event.id, "r1", leader.userId, {
    type: "link",
    linkUrl: "https://example.com/leader",
  });
  assert.equal(submission.teamId, team.id);
});

test("team result is shared and publish notifies all members exactly once", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const leader = makeUser({ userId: "s1", role: "student" });
  const member = makeUser({ userId: "s2", role: "student" });
  const event = createTeamScopedCompetitionEvent(eventsStore, creator, 3);
  eventsStore.register(event.id, {}, { user: leader });
  eventsStore.register(event.id, {}, { user: member });

  const team = competitionStore.createTeam(event.id, leader.userId, { name: "Gamma" });
  const invite = competitionStore.inviteMember(event.id, team.id, leader.userId, {
    inviteeRegisterNumber: member.userId,
  });
  competitionStore.acceptInvitation(event.id, invite.id, member.userId);

  const submission = competitionStore.createSubmission(event.id, "r1", leader.userId, {
    type: "link",
    linkUrl: "https://example.com/work",
  });
  competitionStore.evaluateSubmission(submission.id, creator, {
    criteriaScores: { Innovation: 9 },
    decision: "selected",
  });
  competitionStore.applyShortlist(event.id, "r1", creator, { mode: "topN", value: 1 });
  competitionStore.publishResults(event.id, "r1", creator);

  const resultLeader = competitionStore.getMyResult(event.id, "r1", leader.userId);
  const resultMember = competitionStore.getMyResult(event.id, "r1", member.userId);
  assert.equal(resultLeader.totalScore, resultMember.totalScore);
  assert.equal(resultLeader.shortlisted, resultMember.shortlisted);

  const leaderNotifications = eventsStore
    .listNotifications(leader.userId)
    .filter((item) => item.type === "competition_results_shortlisted");
  const memberNotifications = eventsStore
    .listNotifications(member.userId)
    .filter((item) => item.type === "competition_results_shortlisted");
  assert.equal(leaderNotifications.length, 1);
  assert.equal(memberNotifications.length, 1);
});

test("round migration is idempotent and round reads stay consistent", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const event = createTwoRoundCompetitionEvent(eventsStore, creator);
  const before = competitionStore.getCompetitionConfig(event.id).rounds;
  competitionStore._syncEventRoundsFromConfig(event);
  competitionStore._syncEventRoundsFromConfig(event);
  const count = competitionStore.db
    .prepare("SELECT COUNT(*) AS count FROM rounds WHERE eventId = ?")
    .get(event.id);
  const after = competitionStore.getCompetitionConfig(event.id).rounds;
  assert.equal(count.count, before.length);
  assert.deepEqual(
    after.map((item) => item.roundId),
    before.map((item) => item.roundId)
  );
});

test("panel judging stores per-evaluator rows and aggregates by average", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const evaluator2 = makeUser({ userId: "org2", role: "admin" });
  const participant = makeUser({ userId: "s1", role: "student" });
  const event = createCompetitionEvent(eventsStore, creator);
  eventsStore.register(event.id, {}, { user: participant });
  const submission = competitionStore.createSubmission(event.id, "r1", participant.userId, {
    type: "link",
    linkUrl: "https://example.com/sub",
  });
  competitionStore.evaluateSubmission(submission.id, creator, {
    criteriaScores: { Innovation: 6, Implementation: 6 },
    decision: "pending",
  });
  competitionStore.evaluateSubmission(submission.id, evaluator2, {
    criteriaScores: { Innovation: 9, Implementation: 9 },
    decision: "selected",
  });
  const detail = competitionStore.getSubmissionEvaluations(event.id, "r1", submission.id, creator);
  assert.equal(detail.evaluations.length, 2);
  assert.equal(Number(detail.submission.totalScore), 15);
});

test("leaderboard is gated until publish and available after", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const participant = makeUser({ userId: "s1", role: "student" });
  const event = createCompetitionEvent(eventsStore, creator);
  eventsStore.register(event.id, {}, { user: participant });
  const submission = competitionStore.createSubmission(event.id, "r1", participant.userId, {
    type: "link",
    linkUrl: "https://example.com/sub",
  });
  competitionStore.evaluateSubmission(submission.id, creator, {
    criteriaScores: { Innovation: 8, Implementation: 8 },
    decision: "selected",
  });
  assert.throws(() => competitionStore.getLeaderboard(event.id, "r1"), (error) => error?.status === 403);
  competitionStore.applyShortlist(event.id, "r1", creator, { mode: "topN", value: 1 });
  competitionStore.publishResults(event.id, "r1", creator);
  const leaderboard = competitionStore.getLeaderboard(event.id, "r1");
  assert.equal(leaderboard.length, 1);
  assert.equal(leaderboard[0].rank, 1);
});

test("deadline reminders are deduplicated for same marker window", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const participant = makeUser({ userId: "s1", role: "student" });
  const event = createCompetitionEvent(eventsStore, creator);
  const config = JSON.parse(event.competitionConfig);
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000 - 2 * 60 * 1000).toISOString();
  config.rounds[0].submissionDeadline = deadline;
  eventsStore.updateEvent(event.id, { competitionConfig: JSON.stringify(config) }, { user: creator });
  eventsStore.register(event.id, {}, { user: participant });
  const first = competitionStore.processDeadlineReminders();
  const second = competitionStore.processDeadlineReminders();
  assert.ok(first.sent >= 1);
  assert.equal(second.sent, 0);
});

test("co-organizer can manage evaluations but outsider cannot", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const coOrganizer = makeUser({ userId: "co1", role: "student" });
  const outsider = makeUser({ userId: "x1", role: "student" });
  const participant = makeUser({ userId: "s1", role: "student" });
  const event = createCompetitionEvent(eventsStore, creator);
  eventsStore.updateEvent(event.id, { coOrganizers: [coOrganizer.userId] }, { user: creator });
  eventsStore.register(event.id, {}, { user: participant });
  const submission = competitionStore.createSubmission(event.id, "r1", participant.userId, {
    type: "link",
    linkUrl: "https://example.com/sub",
  });
  competitionStore.evaluateSubmission(submission.id, coOrganizer, {
    criteriaScores: { Innovation: 7, Implementation: 7 },
    decision: "pending",
  });
  assert.throws(
    () =>
      competitionStore.evaluateSubmission(submission.id, outsider, {
        criteriaScores: { Innovation: 7, Implementation: 7 },
        decision: "pending",
      }),
    (error) => error?.status === 403
  );
});

test("certificates are generated only after publish", () => {
  const { eventsStore, competitionStore } = makeStores();
  const creator = makeUser({ userId: "org1", role: "admin" });
  const participant = makeUser({ userId: "s1", role: "student" });
  const event = createCompetitionEvent(eventsStore, creator);
  eventsStore.register(event.id, {}, { user: participant });
  const submission = competitionStore.createSubmission(event.id, "r1", participant.userId, {
    type: "link",
    linkUrl: "https://example.com/sub",
  });
  competitionStore.evaluateSubmission(submission.id, creator, {
    criteriaScores: { Innovation: 8, Implementation: 8 },
    decision: "selected",
  });
  assert.throws(
    () => competitionStore.generateCertificates(event.id, "r1", creator),
    (error) => error?.status === 403
  );
  competitionStore.applyShortlist(event.id, "r1", creator, { mode: "topN", value: 1 });
  competitionStore.publishResults(event.id, "r1", creator);
  const result = competitionStore.generateCertificates(event.id, "r1", creator);
  assert.ok(result.generatedCount >= 1);
  const mine = competitionStore.getMyCertificate(event.id, "r1", participant.userId);
  assert.ok(String(mine.filePath).includes(".pdf"));
});
