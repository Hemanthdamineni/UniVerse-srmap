const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

const { LmsStore } = require("../src/services/lms/lmsStore");
const { LmsModerationService } = require("../src/services/lms/lmsServices");
const { LmsRevisionScheduler } = require("../src/services/lms/lmsServices");
const { LmsRecommendationEngine } = require("../src/services/lms/lmsServices");
const { createLmsRoutes } = require("../src/routes/lmsRoutes");

function createStore(name) {
  const root = path.join(os.tmpdir(), `lms-community-${name}-${process.pid}-${Date.now()}`);
  return new LmsStore({
    dbPath: path.join(root, "lms.sqlite"),
    filesDir: path.join(root, "files"),
    moderationService: new LmsModerationService(),
    revisionScheduler: new LmsRevisionScheduler(),
  });
}

function createResourcePayload(overrides = {}) {
  return {
    type: "note",
    title: "Database indexing guide",
    description: "Practical notes for query planning and indexes.",
    semester: "6",
    subjectCode: "CSE301",
    subjectName: "Database Systems",
    unit: "Query Optimization",
    difficulty: "intermediate",
    tags: ["indexes", "sql"],
    noteContent: "Use selective indexes and verify plans.",
    estimatedMinutes: 12,
    ...overrides,
  };
}

function createSession(profileData) {
  return {
    loggedIn: true,
    profileData: {
      TableContent: {
        "Register No.": profileData.userId,
        "Student Name": profileData.name,
        "Program / Section": profileData.department || "B.Tech CSE / A",
      },
    },
  };
}

function createSessionStore() {
  const sessions = {
    "student-session": createSession({ userId: "AP23110010001", name: "Student One" }),
    "admin-session": createSession({ userId: "AP23110010419", name: "Admin User", department: "Admin" }),
  };
  return {
    async getOrThrow(sessionId) {
      const session = sessions[sessionId];
      if (!session) throw new Error("missing session");
      return session;
    },
  };
}

function invokeRouter(router, { method = "GET", url, headers = {}, body = {} }) {
  return new Promise((resolve, reject) => {
    const normalizedHeaders = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
    );
    const parsed = new URL(url, "http://localhost");
    const req = {
      method,
      url: `${parsed.pathname}${parsed.search}`,
      originalUrl: `${parsed.pathname}${parsed.search}`,
      baseUrl: "",
      path: parsed.pathname,
      headers: normalizedHeaders,
      body,
      query: Object.fromEntries(parsed.searchParams.entries()),
      header(name) {
        return normalizedHeaders[String(name).toLowerCase()] || "";
      },
      get(name) {
        return normalizedHeaders[String(name).toLowerCase()] || "";
      },
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };

    router.handle(req, res, (error) => {
      if (error) {
        if (error.status || error.statusCode) {
          resolve({
            status: error.status || error.statusCode,
            body: { error: { message: error.message, code: error.code || "UNKNOWN" } },
          });
          return;
        }
        reject(error);
        return;
      }
      resolve({ status: res.statusCode, body: null });
    });
  });
}

test("LMS community lifecycle exposes publisher trust, moderation queue, audit, and explainable recommendations", async () => {
  const store = createStore("store");
  const resource = store.createResource("publisher-1", createResourcePayload());
  store.toggleUpvote(resource.id, "learner-1");
  store.toggleBookmark(resource.id, "learner-1");
  store.commentOnResource(resource.id, "learner-1", "Clear and useful before lab work.");
  store.rateResource(resource.id, "learner-1", 5, "Worked well", ["exam useful"]);

  const visible = store.getResource(resource.id, "learner-1");
  assert.equal(visible.publisher.userId, "publisher-1");
  assert.equal(visible.publisher.contributionCount, 1);
  assert.ok(visible.publisher.trustScore >= 50);
  assert.equal(visible.moderation.publicEligible, true);

  const firstReport = store.flagResource(resource.id, "learner-1", "Suspicious copied wording");
  assert.equal(firstReport.flagCount, 1);
  assert.equal(firstReport.moderation.needsReview, true);
  assert.equal(firstReport.moderation.recommendationEligible, false);

  const queue = store.getResourceModerationQueue({ state: "flagged" });
  assert.equal(queue.items.length, 1);
  assert.equal(queue.items[0].flags[0].reason, "Suspicious copied wording");
  assert.equal(queue.items[0].audit[0].action, "reported");

  store.flagResource(resource.id, "learner-2", "Incorrect and unsafe SQL advice");
  assert.equal(store.getResourceModerationQueue({ state: "hidden" }).items.length, 1);
  assert.equal(store.getResources({ limit: 10 }, { userId: "learner-3" }).items.length, 0);

  const approved = store.moderateResource(
    resource.id,
    { decision: "approve", reason: "Reviewed citations and restored to catalog" },
    { userId: "admin-1" }
  );
  assert.equal(approved.resource.moderation.state, 0);
  assert.equal(approved.resource.flagCount, 0);
  assert.equal(approved.audit[0].action, "decision_approve");
  assert.equal(store.getResourceModerationQueue({ state: "all" }).items.length, 0);

  const recommendationEngine = new LmsRecommendationEngine({
    lmsStore: store,
    featureFlagService: { isEnabled: () => true },
  });
  await store.updateUserPreferences("learner-3", {
    subjectWeights: { CSE301: 1 },
    typeWeights: { note: 1 },
  });
  const recommendations = await recommendationEngine.getRecommendations({
    userId: "learner-3",
    filters: { subjectCode: "CSE301" },
    limit: 3,
  });
  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].id, resource.id);
  assert.equal(recommendations[0].rankingPolicy.eligible, true);
  assert.ok(recommendations[0].reasons.some((reason) => reason.code === "subjectMatch"));
  assert.ok(Object.hasOwn(recommendations[0].inputsUsed.factors, "engagementScore"));

  const pyq = store.createResource(
    "publisher-1",
    createResourcePayload({
      type: "pyq",
      title: "Database indexing PYQ set",
      description: "Previous year SQL indexing questions with answer hints.",
      tags: ["sql", "pyq", "exam"],
      examYear: "2025",
      examType: "end-semester",
    })
  );
  const profileAwareEngine = new LmsRecommendationEngine({
    lmsStore: store,
    featureFlagService: { isEnabled: () => true },
    unifiedProfileStore: {
      buildUnifiedProfile: () => ({
        user: { branch: "CSE", department: "Computer Science" },
        skills: [{ skill: "SQL" }],
        career: { skillGaps: [{ skill: "SQL" }] },
        lms: { progress: { subjects: [{ subjectCode: "CSE301", subjectName: "Database Systems" }] } },
      }),
    },
  });
  const examPrep = await profileAwareEngine.getExamPrepRecommendations({
    userId: "learner-3",
    user: { userId: "learner-3", role: "student", branch: "CSE" },
    filters: { subjectCode: "CSE301" },
    limit: 2,
  });
  assert.equal(examPrep[0].id, pyq.id);
  assert.equal(examPrep[0].inputsUsed.algorithmKey, "ranking-v3-exam-prep");
  assert.ok(examPrep[0].reasons.some((reason) => reason.code === "examIntentScore"));
  assert.ok(examPrep[0].inputsUsed.profileSignals.includes("unified_profile"));

  const sqlRoadmap = store.createRoadmap("publisher-1", {
    title: "SQL Interview Readiness",
    description: "Practice indexing, joins, and query optimization for internship interviews.",
    skill: "SQL",
    difficulty: "intermediate",
    estimatedHours: 10,
    published: true,
  });
  store.addRoadmapNode(sqlRoadmap.id, "publisher-1", {
    title: "Indexing practice",
    description: "Work through SQL indexing examples.",
    nodeType: "concept",
  });
  const genericRoadmap = store.createRoadmap("publisher-1", {
    title: "General Study Habits",
    description: "Build a weekly academic routine.",
    skill: "Planning",
    difficulty: "beginner",
    estimatedHours: 3,
    published: true,
  });
  const roadmapRecommendations = await profileAwareEngine.getRoadmapRecommendations({
    userId: "learner-3",
    user: { userId: "learner-3", role: "student", branch: "CSE" },
    limit: 3,
  });
  assert.equal(roadmapRecommendations[0].id, sqlRoadmap.id);
  assert.equal(roadmapRecommendations[0].inputsUsed.algorithmKey, "roadmap-ranking-v1-cross-domain");
  assert.ok(roadmapRecommendations[0].reasons.some((reason) => reason.code === "skillGapMatch"));
  assert.ok(!roadmapRecommendations.some((roadmap) => roadmap.id === genericRoadmap.id));

  const hackathonRoadmap = store.createRoadmap("publisher-1", {
    title: "Campus Hackathon Preparation",
    description: "Plan, prototype, and submit a strong hackathon project.",
    skill: "Prototyping",
    difficulty: "intermediate",
    estimatedHours: 8,
    published: true,
  });
  store.addRoadmapNode(hackathonRoadmap.id, "publisher-1", {
    title: "Prototype scope",
    description: "Choose a feasible project for the campus hackathon.",
    nodeType: "milestone",
  });
  const competitionAwareEngine = new LmsRecommendationEngine({
    lmsStore: store,
    featureFlagService: { isEnabled: () => true },
    unifiedProfileStore: {
      buildUnifiedProfile: () => ({
        user: { branch: "ECE", department: "Electronics" },
        skills: [],
        career: { skillGaps: [] },
        lms: { progress: { subjects: [] } },
        events: { registrations: [] },
      }),
      eventsStore: {
        listEvents: () => [
          {
            title: "Campus Hackathon",
            category: "Innovation",
            department: "Engineering",
            tags: ["prototype", "team"],
            competitionConfig: { rounds: 2 },
          },
        ],
      },
    },
  });
  const competitionRoadmaps = await competitionAwareEngine.getRoadmapRecommendations({
    userId: "learner-4",
    user: { userId: "learner-4", role: "student", branch: "ECE" },
    limit: 3,
  });
  assert.equal(competitionRoadmaps[0].id, hackathonRoadmap.id);
  assert.ok(competitionRoadmaps[0].reasons.some((reason) => reason.code === "competitionMatch"));
});

test("LMS moderation routes enforce admin boundary and return resource report queue", async () => {
  const store = createStore("routes");
  const resource = store.createResource("publisher-1", createResourcePayload({ title: "Normalization checklist" }));
  store.flagResource(resource.id, "AP23110010001", "Needs staff review");
  const router = createLmsRoutes({
    sessionStore: createSessionStore(),
    adminPassword: "test-admin",
    lmsStore: store,
    lmsTrackerService: null,
    recommendationEngine: {
      getRecommendations: async () => [],
      getExamPrepRecommendations: async () => [{ id: "exam-prep-1" }],
      getRoadmapRecommendations: async () => [{ id: "roadmap-rec-1" }],
      recordFeedback: async () => ({}),
    },
    interactionTracker: {
      track: async () => ({}),
    },
    examFeedbackService: {
      getPendingFeedback: async () => [],
    },
    duplicateDetector: {
      checkDuplicate: async () => ({ exact: null, similar: [], hasDuplicate: false }),
      computeHash: () => "hash",
    },
    readingTimeEstimator: {
      computeReadingTime: async () => 1,
    },
    featureFlagService: {
      listFlags: () => [],
      setFlag: (payload) => payload,
    },
  });

  const studentQueue = await invokeRouter(router, {
    url: "/lms/admin/resource-flags",
    headers: { cookie: "erp_session=student-session" },
  });
  assert.equal(studentQueue.status, 403);

  const adminQueue = await invokeRouter(router, {
    url: "/lms/admin/resource-flags?state=flagged&limit=10&page=1",
    headers: {
      cookie: "erp_session=admin-session",
      "x-admin-password": "test-admin",
      "x-user-id": "admin-1",
    },
  });
  assert.equal(adminQueue.status, 200);
  assert.equal(adminQueue.body.success, true);
  assert.equal(adminQueue.body.data.items[0].id, resource.id);
  assert.equal(adminQueue.body.data.items[0].flags[0].status, "open");

  const moderated = await invokeRouter(router, {
    method: "PATCH",
    url: `/lms/admin/resources/${resource.id}/moderation`,
    headers: {
      cookie: "erp_session=admin-session",
      "x-admin-password": "test-admin",
      "x-user-id": "admin-1",
    },
    body: {
      decision: "hide",
      reason: "Hidden until publisher submits source citations",
    },
  });
  assert.equal(moderated.status, 200);
  assert.equal(moderated.body.data.resource.moderation.state, 2);
  assert.equal(moderated.body.data.audit[0].action, "decision_hide");

  const examPrep = await invokeRouter(router, {
    url: "/lms/recommendations/exam-prep?limit=3",
    headers: { cookie: "erp_session=student-session" },
  });
  assert.equal(examPrep.status, 200);
  assert.equal(examPrep.body.data[0].id, "exam-prep-1");

  const roadmapRecommendations = await invokeRouter(router, {
    url: "/lms/recommendations/roadmaps?limit=2",
    headers: { cookie: "erp_session=student-session" },
  });
  assert.equal(roadmapRecommendations.status, 200);
  assert.equal(roadmapRecommendations.body.data[0].id, "roadmap-rec-1");
});

test("LMS moderation queue stays under latency budget for a seeded review backlog", () => {
  const store = createStore("perf");
  for (let index = 0; index < 300; index += 1) {
    const resource = store.createResource(
      `publisher-${index % 12}`,
      createResourcePayload({
        title: `Seeded moderation resource ${index}`,
        unit: `Unit ${index % 8}`,
        tags: ["seed", `topic-${index % 5}`],
      })
    );
    store.flagResource(resource.id, `learner-${index}`, "Queued for moderation review");
  }

  const timings = [];
  for (let index = 0; index < 20; index += 1) {
    const started = process.hrtime.bigint();
    const queue = store.getResourceModerationQueue({ state: "flagged", page: 1, limit: 25 });
    timings.push(Number(process.hrtime.bigint() - started) / 1_000_000);
    assert.equal(queue.items.length, 25);
  }
  timings.sort((left, right) => left - right);
  const p95 = timings[Math.floor(timings.length * 0.95)];
  console.log(`lms_moderation_queue_seeded_p95_ms=${p95.toFixed(2)}`);
  assert.ok(p95 < 300, `expected p95 < 300ms, got ${p95.toFixed(2)}ms`);
});

test("LMS question bank validates input and supports browse, upvote, and quiz build", () => {
  const store = createStore("question-bank");

  const created = store.addQuestion("AP23110010001", {
    subjectCode: "cse301",
    question: "What does a primary key guarantee?",
    options: ["Unique row identity", "Sorted storage", "Faster joins", "Nothing"],
    correctIndex: 0,
    difficulty: "easy",
    explanation: "A primary key uniquely identifies each row.",
  });
  assert.equal(created.subjectCode, "CSE301");
  assert.equal(created.correctIndex, 0);
  assert.deepEqual(created.options.length, 4);

  const invalidCases = [
    [{ subjectCode: "", question: "q", options: ["a", "b"], correctIndex: 0 }, "empty subject"],
    [{ subjectCode: "CSE301", question: "   ", options: ["a", "b"], correctIndex: 0 }, "blank question"],
    [{ subjectCode: "CSE301", question: "q", options: ["a"], correctIndex: 0 }, "single option"],
    [{ subjectCode: "CSE301", question: "q", options: ["a", "b"], correctIndex: 2 }, "out-of-range index"],
    [{ subjectCode: "CSE301", question: "q", options: ["a", "b"], correctIndex: -1 }, "negative index"],
    [{ subjectCode: "CSE301", question: "q", options: ["a", "   "], correctIndex: 1 }, "blank option"],
    [{ subjectCode: "CSE301", question: "q", options: ["a", "b"], correctIndex: 0, difficulty: "impossible" }, "bad difficulty"],
  ];
  for (const [payload, label] of invalidCases) {
    assert.throws(() => store.addQuestion("u1", payload), (error) => error.status === 400, `expected rejection for ${label}`);
  }

  store.upvoteQuestion(created.id);
  assert.equal(store.getQuestionBankItem(created.id).upvotes, 1);

  const bank = store.getQuestionBank("CSE301", {});
  assert.equal(bank.items.length, 1);
  assert.deepEqual(bank.items[0].options, ["Unique row identity", "Sorted storage", "Faster joins", "Nothing"]);

  const unitBank = store.getQuestionBank("CSE301", { unit: "Normalization" });
  assert.equal(unitBank.items.length, 0);

  const quiz = store.buildQuizFromBank("CSE301", null, 5, "");
  assert.equal(quiz.count, 1);
  assert.equal(quiz.questions[0].id, created.id);

  assert.throws(
    () => store.buildQuizFromBank("NOPE999", null, 5, ""),
    (error) => error.status === 404 && error.code === "LMS_NOT_FOUND"
  );
});
