const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

const { UnifiedProfileStore } = require("../src/services/core/unifiedProfileStore");

function createStore() {
  const event = {
    id: "event-1",
    title: "Campus Hackathon",
    description: "Build useful campus tools.",
    tags: ["React", "Node.js"],
    startAt: "2099-07-01T09:00:00.000Z",
    endAt: "2099-07-01T18:00:00.000Z",
    registrationDeadline: "2099-06-28T18:00:00.000Z",
    category: "Technical",
    department: "Computer Science",
    competitionConfig: { rounds: [{ roundId: "r1", title: "Prototype Round" }] },
    maxCapacity: 100,
    featured: true,
    createdByUserId: "organizer-1",
  };
  const genericEvent = {
    id: "event-2",
    title: "Open Mic Evening",
    description: "A relaxed cultural evening for music and poetry.",
    tags: ["music", "poetry"],
    startAt: "2099-07-04T17:00:00.000Z",
    endAt: "2099-07-04T20:00:00.000Z",
    registrationDeadline: "2099-07-03T18:00:00.000Z",
    category: "Cultural",
    department: "Student Union",
    competitionConfig: null,
    maxCapacity: 100,
    featured: false,
    createdByUserId: "organizer-2",
  };
  const eventsStore = {
    events: [event, genericEvent],
    eventById: new Map([[event.id, event], [genericEvent.id, genericEvent]]),
    registrationsByUser: new Map([
      [
        "AP23110010001",
        [
          {
            eventId: "event-1",
            userId: "AP23110010001",
            status: "registered",
            registeredAt: "2099-06-20T10:00:00.000Z",
          },
        ],
      ],
    ]),
    listEvents() {
      return [
        {
          ...event,
          tags: event.tags,
          featured: true,
          isRegistered: false,
          registeredCount: 1,
          seatsAvailable: 99,
        },
        {
          ...genericEvent,
          tags: genericEvent.tags,
          featured: false,
          isRegistered: false,
          registeredCount: 0,
          seatsAvailable: 100,
        },
      ];
    },
  };
  const careerStore = {
    getProfile() {
      return {
        userId: "AP23110010001",
        skills: ["React", "SQL"],
        preferredTypes: ["internship"],
        preferredLocations: ["remote"],
        bio: "Frontend student",
        resumeUrl: "",
        resumeFileName: "",
        linkedinUrl: "https://linkedin.example/student",
        githubUrl: "https://github.example/student",
        portfolioUrl: "",
        cgpa: "8.2",
      };
    },
    getSkillGaps() {
      return [{ skill: "Node.js", opportunityCount: 4, gapLevel: "missing" }];
    },
    getOpportunities() {
      return [
        {
          id: "opp-1",
          title: "Frontend Intern",
          skills: ["React", "Node.js"],
          deadline: "2099-07-15",
        },
      ];
    },
  };
  const lmsStore = {
    getProgressSummary() {
      return { started: 2, completed: 1, completionRate: 50, subjects: [] };
    },
    getUserContributions() {
      return { resources: [{ id: "r1" }], guides: [], roadmaps: [] };
    },
    getMastery() {
      return [];
    },
    listRecommendationCandidates() {
      return [
        {
          id: "res-1",
          title: "React Revision Notes",
          qualityScore: 4,
          isOutdated: 0,
        },
      ];
    },
  };
  const competitionStore = {
    db: {
      prepare(sql) {
        return {
          all() {
            if (String(sql).includes("JOIN teams")) return [];
            return [
              {
                id: "submission-1",
                eventId: "event-1",
                roundId: "r1",
                submittedBy: "AP23110010001",
                totalScore: 18,
                decision: "selected",
                shortlisted: 1,
                evaluatedAt: "2099-07-03T10:00:00.000Z",
                submittedAt: "2099-07-02T10:00:00.000Z",
                roundTitle: "Prototype Round",
              },
            ];
          },
        };
      },
    },
  };

  return new UnifiedProfileStore({
    dbPath: path.join(os.tmpdir(), `unified-profile-${process.pid}-${Date.now()}-${Math.random()}.sqlite`),
    lmsStore,
    careerStore,
    eventsStore,
    competitionStore,
  });
}

const user = {
  userId: "AP23110010001",
  name: "Student One",
  email: "student@example.edu",
  role: "student",
  department: "CSE",
  branch: "Computer Science",
  year: 3,
};

test("UnifiedProfileStore aggregates profile, skills, LMS, events, and private achievements", () => {
  const store = createStore();

  store.recordSignal({
    userId: user.userId,
    domain: "lms",
    signalType: "resource_completed",
    signalRefId: "res-1",
    visibility: "platform_personalization",
    metadata: { subjectCode: "CSE301" },
  });

  const profile = store.buildUnifiedProfile(user);

  assert.equal(profile.contractVersion, "unified-profile-v1");
  assert.equal(profile.user.userId, user.userId);
  assert.equal(profile.privacy.achievements, "private");
  assert.equal(profile.career.available, true);
  assert.equal(profile.lms.available, true);
  assert.equal(profile.events.registeredCount, 1);
  assert.ok(profile.skills.some((skill) => skill.skill === "React" && skill.source === "career_profile"));
  assert.ok(profile.achievements.some((achievement) => achievement.sourceDomain === "events"));
  assert.ok(profile.achievements.some((achievement) => achievement.type === "competition_shortlist"));
  assert.ok(profile.achievements.every((achievement) => achievement.visibility === "private"));
  assert.ok(profile.signals.some((signal) => signal.signalType === "resource_completed"));
});

test("UnifiedProfileStore enforces visibility updates and explainable recommendation feedback loop", () => {
  const store = createStore();

  const settings = store.updatePrivacySettings(user, {
    achievements: "public",
    resume: "public",
    lmsActivity: "invalid-value",
  });
  assert.equal(settings.achievements, "public");
  assert.equal(settings.resume, "public");
  assert.equal(settings.lmsActivity, "private");

  const recommendations = store.getRecommendations(user, { domain: "home", limit: 10 });
  assert.equal(recommendations.contractVersion, "recommendations-v1");
  assert.ok(recommendations.items.length >= 3);
  for (const item of recommendations.items) {
    assert.ok(item.score >= 0 && item.score <= 1);
    assert.ok(item.impressionId);
    assert.ok(Array.isArray(item.reasons));
    assert.ok(item.reasons.length > 0);
  }

  const feedback = store.recordRecommendationFeedback(user, {
    impressionId: recommendations.items[0].impressionId,
    action: "clicked",
    metadata: { surface: "test" },
  });
  assert.equal(feedback.recorded, true);

  const eventRecommendations = store.getRecommendations(user, { domain: "events", limit: 5 });
  assert.equal(eventRecommendations.domain, "events");
  assert.equal(eventRecommendations.items[0].itemId, "event-1");
  assert.equal(eventRecommendations.items[0].itemType, "competition");
  assert.ok(eventRecommendations.items[0].score > eventRecommendations.items[1].score);
  assert.ok(eventRecommendations.items[0].reasons.some((reason) => reason.includes("Matches skills")));
  assert.ok(eventRecommendations.items[0].reasons.some((reason) => reason.includes("career gaps")));
});

test("UnifiedProfileStore builds privacy-filtered public career profile projections", () => {
  const store = createStore();
  store.buildUnifiedProfile(user);

  store.upsertSkill({
    userId: user.userId,
    skill: "React",
    source: "manual",
    confidence: 0.9,
    visibility: "public",
  });
  store.upsertSkill({
    userId: user.userId,
    skill: "Node.js",
    source: "manual",
    confidence: 0.7,
    visibility: "employers",
  });
  store.upsertAchievement({
    userId: user.userId,
    type: "portfolio_project",
    title: "Built Campus Planner",
    sourceDomain: "career",
    sourceRefId: "project-1",
    skills: ["React"],
    visibility: "public",
    achievedAt: "2099-06-01T00:00:00.000Z",
  });
  store.upsertAchievement({
    userId: user.userId,
    type: "resume_only",
    title: "Private Resume Review",
    sourceDomain: "career",
    sourceRefId: "private-1",
    skills: ["Communication"],
    visibility: "private",
    achievedAt: "2099-06-02T00:00:00.000Z",
  });

  const publicProfile = store.getPublicCareerProfile(user.userId);
  assert.equal(publicProfile.contractVersion, "career-public-profile-v1");
  assert.equal(publicProfile.user.userId, user.userId);
  assert.equal(publicProfile.user.name, "Student One");
  assert.ok(publicProfile.skills.some((skill) => skill.skill === "React"));
  assert.ok(!publicProfile.skills.some((skill) => skill.skill === "Node.js"));
  assert.ok(publicProfile.achievements.some((achievement) => achievement.title === "Built Campus Planner"));
  assert.ok(!publicProfile.achievements.some((achievement) => achievement.title === "Private Resume Review"));
  assert.equal(publicProfile.stats.visibleAchievementCount, 1);
  assert.equal(publicProfile.links.linkedinUrl, "https://linkedin.example/student");
  assert.equal(publicProfile.resumeUrl, undefined);

  const employerProfile = store.getPublicCareerProfile(user.userId, { audience: "employers" });
  assert.ok(employerProfile.skills.some((skill) => skill.skill === "Node.js"));
  assert.ok(!employerProfile.achievements.some((achievement) => achievement.title === "Private Resume Review"));
});
