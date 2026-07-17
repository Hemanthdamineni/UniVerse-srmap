const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { CareerStore } = require("../src/services/career/careerStore");
const { EventsStore } = require("../src/services/events/eventsStore");
const { createCompetitionStore } = require("../src/services/events/competitionStore");
const { LmsStore } = require("../src/services/lms/lmsStore");
const {
  LmsFeatureFlagService,
  LmsModerationService,
  LmsRecommendationEngine,
  LmsRevisionScheduler,
} = require("../src/services/lms/lmsServices");
const { UnifiedProfileStore } = require("../src/services/core/unifiedProfileStore");

function user(overrides = {}) {
  return {
    userId: "AP23110010001",
    name: "Student One",
    email: "student@example.edu",
    role: "student",
    department: "CSE",
    branch: "CSE",
    year: 3,
    isAuthenticated: true,
    ...overrides,
  };
}

function createCompetitionEvent(eventsStore, creator) {
  const [event] = eventsStore.createEvent(
    {
      title: "Companion Platform Hackathon",
      description: "Build tools that improve campus workflows.",
      startAt: "2099-06-01T09:00:00.000Z",
      endAt: "2099-06-30T17:00:00.000Z",
      location: { physical: "Innovation Hall" },
      organizer: "Engineering Club",
      department: "CSE",
      maxCapacity: 100,
      registrationDeadline: "2099-05-31T23:59:59.000Z",
      cancellationDeadline: "2099-05-30T23:59:59.000Z",
      visibility: "public",
      status: "published",
      tags: ["React", "Node.js", "Pitch"],
      competitionConfig: JSON.stringify({
        isCompetition: true,
        submissionScope: "team",
        maxTeamSize: 3,
        rounds: [
          {
            roundId: "r1",
            title: "Prototype Round",
            submissionDeadline: "2099-06-15T23:59:59.000Z",
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

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "companion-platform-smoke-"));
  try {
    const careerStore = new CareerStore({ dbPath: path.join(root, "career.sqlite") });
    const eventsStore = new EventsStore({
      dataDir: path.join(root, "events"),
      dbPath: path.join(root, "events.sqlite"),
    });
    const competitionStore = createCompetitionStore({
      eventsStore,
      dbPath: path.join(root, "competition.sqlite"),
    });
    const lmsStore = new LmsStore({
      dbPath: path.join(root, "lms.sqlite"),
      filesDir: path.join(root, "lms-files"),
      moderationService: new LmsModerationService(),
      revisionScheduler: new LmsRevisionScheduler(),
    });
    const unifiedProfileStore = new UnifiedProfileStore({
      dbPath: path.join(root, "unified.sqlite"),
      lmsStore,
      careerStore,
      eventsStore,
      competitionStore,
    });
    const recommendationEngine = new LmsRecommendationEngine({
      lmsStore,
      featureFlagService: new LmsFeatureFlagService({ lmsStore }),
      unifiedProfileStore,
    });

    const student = user();
    const teammate = user({
      userId: "AP23110010002",
      name: "Student Two",
      email: "student2@example.edu",
      department: "CSE",
    });
    const candidate = user({
      userId: "AP23110010003",
      name: "Student Three",
      email: "student3@example.edu",
      department: "CSE",
    });
    const organizer = user({
      userId: "AP23110010419",
      name: "Organizer",
      role: "admin",
      hasAdminAccess: true,
    });

    careerStore.updateProfile(student, {
      skills: ["React"],
      preferredTypes: ["internship"],
      preferredLocations: ["remote"],
      bio: "Frontend student focused on campus tools.",
      githubUrl: "https://github.example/student-one",
      linkedinUrl: "",
      portfolioUrl: "",
      minStipend: "",
      cgpa: 8.4,
    });
    const opportunity = careerStore.createOpportunity(
      {
        type: "internship",
        title: "Frontend Platform Internship",
        company: "Acme Labs",
        description: "Build React, Node.js, and SQL workflows.",
        skills: ["React", "Node.js", "SQL"],
        eligibleBranches: ["CSE"],
        eligibleYears: [3],
        mode: "remote",
        location: "Remote",
        applyUrl: "https://example.com/frontend-platform-internship",
        sourceUrl: "https://example.com/frontend-platform-internship",
        deadline: "2099-12-31T00:00:00.000Z",
      },
      organizer
    );
    const resume = careerStore.createResumeVersion(student, {
      fileName: "resume.txt",
      mimeType: "text/plain",
      extractedText:
        "React TypeScript project built for 500 students. GitHub: https://github.example/student-one. SQL dashboard experience.",
    });
    const fit = careerStore.getOpportunityFit(student, opportunity.id, resume.id);
    assert.ok(fit.fitScore >= 60, "resume opportunity fit should be usable");

    lmsStore.createResource("faculty-1", {
      type: "pyq",
      title: "SQL Previous Year Question Set",
      description: "End-semester PYQs for SQL query planning.",
      semester: "6",
      subjectCode: "CSE301",
      subjectName: "Database Systems",
      unit: "Query Optimization",
      difficulty: "intermediate",
      tags: ["SQL", "exam", "Node.js"],
      examYear: "2098",
      examType: "end-semester",
      estimatedMinutes: 20,
    });
    await lmsStore.updateUserPreferences(student.userId, {
      subjectWeights: { CSE301: 1 },
      typeWeights: { pyq: 1 },
    });
    const examPrep = await recommendationEngine.getExamPrepRecommendations({
      userId: student.userId,
      user: student,
      filters: { subjectCode: "CSE301" },
      limit: 3,
    });
    assert.equal(examPrep[0].type, "pyq");
    assert.ok(examPrep[0].inputsUsed.profileSignals.includes("unified_profile"));

    const event = createCompetitionEvent(eventsStore, organizer);
    eventsStore.register(event.id, {}, { user: student });
    eventsStore.register(
      event.id,
      { formResponses: [{ answer: "React, pitch deck, and demo storytelling" }] },
      { user: teammate }
    );
    eventsStore.register(
      event.id,
      { formResponses: [{ answer: "Node.js APIs, SQL, pitch support, and product demos" }] },
      { user: candidate }
    );
    const team = competitionStore.createTeam(event.id, student.userId, { name: "Campus Builders" });
    const post = competitionStore.upsertTeamRecruitmentPost(event.id, student.userId, {
      neededSkills: ["Node.js", "Pitch"],
      description: "Need backend and demo support.",
      openSlots: 2,
    });
    assert.equal(post.status, "open");
    const board = competitionStore.listTeamRecruitmentBoard(event.id, teammate);
    assert.equal(board.length, 1);
    const matches = competitionStore.listTeamMatches(event.id, student);
    assert.equal(matches[0].userId, candidate.userId);

    const invite = competitionStore.inviteMember(event.id, team.id, student.userId, {
      inviteeRegisterNumber: teammate.userId,
    });
    competitionStore.acceptInvitation(event.id, invite.id, teammate.userId);
    const submission = competitionStore.createSubmission(event.id, "r1", student.userId, {
      type: "link",
      linkUrl: "https://example.com/prototype",
      description: "Prototype submission",
    });
    competitionStore.evaluateSubmission(submission.id, organizer, {
      criteriaScores: { Innovation: 9 },
      decision: "selected",
    });
    competitionStore.applyShortlist(event.id, "r1", organizer, { mode: "topN", value: 1 });
    competitionStore.publishResults(event.id, "r1", organizer);

    const profile = unifiedProfileStore.buildUnifiedProfile(student, { recompute: true });
    assert.ok(
      profile.achievements.some((achievement) => achievement.type === "competition_shortlist"),
      "published competition outcome should sync as achievement"
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          checks: {
            resumeFitScore: fit.fitScore,
            examPrepTopResource: examPrep[0].id,
            teamBoardPosts: board.length,
            topTeamMatch: matches[0].userId,
            achievementCount: profile.achievements.length,
          },
        },
        null,
        2
      )
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
