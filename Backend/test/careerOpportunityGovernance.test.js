const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { CareerStore } = require("../src/services/careerStore");
const { createCareerRoutes } = require("../src/routes/careerRoutes");

function makeStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "career-governance-"));
  const dbPath = path.join(tempDir, "career.sqlite");
  return { store: new CareerStore({ dbPath }), tempDir };
}

function makeUser(overrides = {}) {
  return {
    role: "student",
    userId: "student-1",
    name: "Student One",
    isAuthenticated: true,
    hasAdminAccess: false,
    branch: "CSE",
    year: 3,
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
    "student-session": createSession({ userId: "student-1", name: "Student One" }),
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
        reject(error);
        return;
      }
      resolve({ status: res.statusCode, body: null });
    });
  });
}

function submissionPayload(overrides = {}) {
  return {
    type: "internship",
    title: "Frontend Platform Internship",
    company: "Acme Labs",
    applyUrl: "https://careers.example.com/frontend-platform-internship",
    deadline: "2030-06-30",
    description: "Build frontend workflows for student platforms.",
    skills: ["React", "TypeScript"],
    tags: ["frontend"],
    ...overrides,
  };
}

test("career opportunity lifecycle keeps user submissions pending until audited admin decisions", () => {
  const { store, tempDir } = makeStore();
  try {
    const student = makeUser();
    const admin = makeUser({ role: "admin", userId: "admin-1", hasAdminAccess: true });
    const adminCreated = store.createOpportunity(
      submissionPayload({
        title: "Admin Published Backend Internship",
        applyUrl: "https://careers.example.com/backend-internship",
      }),
      admin
    );
    assert.equal(Boolean(adminCreated.isActive), true);
    assert.ok(store.getOpportunities({ user: student }).some((item) => item.id === adminCreated.id));

    const submitted = store.submitOpportunity(student.userId, submissionPayload());
    assert.equal(submitted.status, "pending");
    assert.equal(submitted.governance.requiresApproval, true);
    assert.ok(!store.getOpportunities({ user: student }).some((item) => item.id === submitted.id));

    assert.throws(
      () => store.submitOpportunity("student-2", submissionPayload()),
      /already pending review/
    );

    const rejected = store.reviewSubmission(
      submitted.id,
      { decision: "reject", reason: "Company posting could not be verified." },
      admin
    );
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.reviewedBy, "admin-1");
    assert.equal(rejected.reviewReason, "Company posting could not be verified.");
    assert.equal(rejected.audit[0].action, "rejected");
    const mine = store.getSubmissions({ submittedBy: student.userId, status: "all" });
    assert.equal(mine.items[0].reviewReason, "Company posting could not be verified.");

    const second = store.submitOpportunity(
      student.userId,
      submissionPayload({
        title: "Data Engineering Fellowship",
        type: "fellowship",
        applyUrl: "https://careers.example.com/data-fellowship",
      })
    );
    const approved = store.reviewSubmission(
      second.id,
      { decision: "approve", reason: "Verified with official careers page." },
      admin
    );
    assert.equal(approved.status, "approved");
    assert.ok(approved.publishedOpportunityId);
    assert.ok(store.getOpportunities({ user: student }).some((item) => item.id === approved.publishedOpportunityId));

    const selfSubmitted = store.submitOpportunity(
      admin.userId,
      submissionPayload({
        title: "Admin Conflict Internship",
        applyUrl: "https://careers.example.com/conflict-internship",
      })
    );
    assert.throws(
      () => store.reviewSubmission(selfSubmitted.id, { decision: "approve", reason: "Self review" }, admin),
      /own submission/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("career submission HTTP routes enforce admin review boundary and reasoned approval", async () => {
  const { store, tempDir } = makeStore();
  try {
    const router = createCareerRoutes({
      careerStore: store,
      sessionStore: createSessionStore(),
      adminPassword: "test-admin",
    });

    const submitted = await invokeRouter(router, {
      method: "POST",
      url: "/career/submit",
      headers: { cookie: "erp_session=student-session" },
      body: submissionPayload({
        title: "Cloud Platform Workshop",
        type: "workshop",
        applyUrl: "https://careers.example.com/cloud-workshop",
      }),
    });
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.status, "pending");

    const studentQueue = await invokeRouter(router, {
      url: "/career/submit/pending",
      headers: { cookie: "erp_session=student-session" },
    });
    assert.equal(studentQueue.status, 403);

    const adminQueue = await invokeRouter(router, {
      url: "/career/submit/pending?limit=10",
      headers: { cookie: "erp_session=admin-session", "x-admin-password": "test-admin", "x-user-id": "admin-1" },
    });
    assert.equal(adminQueue.status, 200);
    assert.equal(adminQueue.body.items[0].id, submitted.body.id);

    const approved = await invokeRouter(router, {
      method: "PATCH",
      url: `/career/submit/${submitted.body.id}`,
      headers: { cookie: "erp_session=admin-session", "x-admin-password": "test-admin", "x-user-id": "admin-1" },
      body: { decision: "approve", reason: "Verified official workshop source." },
    });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.status, "approved");
    assert.equal(approved.body.reviewReason, "Verified official workshop source.");
    assert.equal(approved.body.reviewedBy, "admin-1");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("career pending submission queue remains paginated under 10k rows", () => {
  const { store, tempDir } = makeStore();
  try {
    const now = new Date().toISOString();
    const insert = store.db.prepare(
      `
        INSERT INTO career_submissions (
          id, submittedBy, status, type, title, company, description, skills, tags,
          eligibleBranches, eligibleYears, applyUrl, createdAt, fingerprint
        ) VALUES (?, ?, 'pending', 'internship', ?, ?, ?, '[]', '[]', '[]', '[]', ?, ?, ?)
      `
    );
    store.db.exec("BEGIN IMMEDIATE");
    for (let index = 0; index < 10_000; index += 1) {
      const id = `sub-perf-${index}`;
      insert.run(
        id,
        `student-${index % 500}`,
        `Seeded Internship ${index}`,
        `Company ${index % 50}`,
        "Seeded backlog row",
        `https://careers.example.com/seeded-${index}`,
        now,
        `seeded|${index}`
      );
    }
    store.db.exec("COMMIT");

    const timings = [];
    for (let index = 0; index < 20; index += 1) {
      const started = process.hrtime.bigint();
      const result = store.getPendingSubmissions({ page: 10, limit: 25 });
      timings.push(Number(process.hrtime.bigint() - started) / 1_000_000);
      assert.equal(result.items.length, 25);
      assert.equal(result.pagination.total, 10_000);
    }
    timings.sort((left, right) => left - right);
    const p95 = timings[Math.floor(timings.length * 0.95)];
    console.log(`career_pending_submission_queue_10k_p95_ms=${p95.toFixed(2)}`);
    assert.ok(p95 < 300, `expected p95 < 300ms, got ${p95.toFixed(2)}ms`);
  } finally {
    try {
      store.db.exec("ROLLBACK");
    } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
