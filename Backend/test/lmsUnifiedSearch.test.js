const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

const { LmsStore } = require("../src/services/lms/lmsStore");
const { LmsModerationService } = require("../src/services/lms/lmsServices");
const { LmsRevisionScheduler } = require("../src/services/lms/lmsServices");
const { createLmsRoutes } = require("../src/routes/lmsRoutes");

function createStore(name) {
  const root = path.join(os.tmpdir(), `lms-unified-search-${name}-${process.pid}-${Date.now()}`);
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
    description: "Practical indexing notes for query planning and plans.",
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

function buildRouter(store) {
  return createLmsRoutes({
    sessionStore: createSessionStore(),
    adminPassword: "test-admin",
    lmsStore: store,
    lmsTrackerService: null,
    recommendationEngine: null,
    interactionTracker: null,
    examFeedbackService: null,
    duplicateDetector: null,
    readingTimeEstimator: null,
    featureFlagService: null,
  });
}

test("unified search returns grouped results across resources, guides, roadmaps, and questions", async () => {
  const store = createStore("groups");
  store.createResource("publisher-1", createResourcePayload());
  store.createGuide("publisher-1", {
    title: "Normalization study guide",
    description: "Step-by-step normalization practice.",
    subjectCode: "CSE301",
    published: true,
    sections: [{ title: "Introduction", content: "Start with functional dependency basics." }],
  });
  store.createRoadmap("publisher-1", {
    title: "Database engineering path",
    skill: "Database design",
    description: "From ER modelling to index tuning.",
    published: true,
  });
  store.addQuestion("publisher-1", {
    subjectCode: "CSE301",
    question: "Which index type does SQLite use for full-text search?",
    options: ["B-tree", "FTS5 inverted index"],
    correctIndex: 1,
    difficulty: "medium",
  });

  const router = buildRouter(store);
  const response = await invokeRouter(router, {
    url: "/lms/search?query=indexing&subjectCode=CSE301",
    headers: { cookie: "erp_session=student-session" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  const groups = response.body.data.groups;
  assert.equal(groups.resources.items.length, 1);
  assert.equal(groups.resources.items[0].title, "Database indexing guide");
  assert.equal(groups.resources.total, 1);
  assert.equal(groups.guides.total, 0, "guide has no 'indexing' token in indexed fields");
  assert.equal(groups.roadmaps.total, 0);
  assert.equal(groups.questions.total, 0);

  const byGuideTitle = await invokeRouter(router, {
    url: "/lms/search?query=normalization",
    headers: { cookie: "erp_session=student-session" },
  });
  assert.equal(byGuideTitle.body.data.groups.guides.items.length, 1);
  assert.equal(byGuideTitle.body.data.groups.guides.items[0].title, "Normalization study guide");

  const bySkill = await invokeRouter(router, {
    url: "/lms/search?query=database%20design&types=roadmaps",
    headers: { cookie: "erp_session=student-session" },
  });
  assert.equal(bySkill.body.data.groups.roadmaps.items.length, 1);
  assert.equal(bySkill.body.data.groups.roadmaps.items[0].skill, "Database design");

  const byQuestionText = await invokeRouter(router, {
    url: "/lms/search?query=full-text&types=questions",
    headers: { cookie: "erp_session=student-session" },
  });
  assert.equal(byQuestionText.body.data.groups.questions.items.length, 1);
  assert.deepEqual(byQuestionText.body.data.groups.questions.items[0].options, ["B-tree", "FTS5 inverted index"]);
});

test("unified search excludes deleted content and supports empty-query browsing", async () => {
  const store = createStore("visibility");
  const kept = store.createResource("publisher-1", createResourcePayload());
  const removed = store.createResource(
    "publisher-1",
    createResourcePayload({ title: "Deleted deadlock notes", description: "Deadlock diagnosis indexing." })
  );
  store.deleteResource(removed.id, "publisher-1", { isAdmin: false });
  assert.ok(kept.id);

  const router = buildRouter(store);
  const search = await invokeRouter(router, {
    url: "/lms/search?query=deadlock",
    headers: { cookie: "erp_session=student-session" },
  });
  assert.equal(search.body.data.groups.resources.items.length, 0);

  const browse = await invokeRouter(router, {
    url: "/lms/search?limit=10",
    headers: { cookie: "erp_session=student-session" },
  });
  assert.equal(browse.body.data.query, "");
  assert.equal(browse.body.data.groups.resources.items.length, 1);
  assert.equal(browse.body.data.groups.resources.items[0].userBookmarked, false);
});

test("unified search sanitizes hostile query input and requires authentication", async () => {
  const store = createStore("safety");
  store.createResource("publisher-1", createResourcePayload());

  const router = buildRouter(store);
  const hostile = await invokeRouter(router, {
    url: `/lms/search?query=${encodeURIComponent('" OR 1=1; DROP TABLE lms_resources; --')}`,
    headers: { cookie: "erp_session=student-session" },
  });
  assert.equal(hostile.status, 200);
  assert.equal(hostile.body.data.groups.resources.total, 0);
  assert.equal(store.getResources({ limit: 10 }).items.length, 1);

  const unauthenticated = await invokeRouter(router, {
    url: "/lms/search?query=indexing",
  });
  assert.equal(unauthenticated.status, 401);
});
