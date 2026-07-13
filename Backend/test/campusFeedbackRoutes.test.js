const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

const { CampusFeedbackStore } = require("../src/services/campus/campusFeedbackStore");

function createSession(profileData) {
  return {
    loggedIn: true,
    profileData: {
      TableContent: {
        "Register No.": profileData.userId,
        "Student Name": profileData.name,
        "Student E-Mail": profileData.email,
        "Program / Section": profileData.department || "B.Tech CSE / A",
      },
    },
  };
}

function createSessionStore() {
  const sessions = {
    "student-session": createSession({
      userId: "AP23110010001",
      name: "Student One",
      email: "student@example.edu",
      department: "B.Tech CSE / A",
    }),
    "admin-session": createSession({
      userId: "ADMIN001",
      name: "Admin User",
      email: "admin@example.edu",
      department: "Student Affairs",
    }),
  };

  return {
    async getOrThrow(sessionId) {
      const session = sessions[sessionId];
      if (!session) throw new Error("missing session");
      return session;
    },
  };
}

function createTestRouter() {
  const { createCampusFeedbackRoutes } = require("../src/routes/campusFeedbackRoutes");
  return createCampusFeedbackRoutes({
    campusFeedbackStore: new CampusFeedbackStore({
      dbPath: path.join(os.tmpdir(), `campus-feedback-routes-${process.pid}-${Date.now()}.sqlite`),
    }),
    sessionStore: createSessionStore(),
    adminPassword: "test-admin",
  });
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

test("campus feedback router exposes separate unofficial namespace", () => {
  delete require.cache[require.resolve("../src/routes/campusFeedbackRoutes")];
  const { createCampusFeedbackRoutes } = require("../src/routes/campusFeedbackRoutes");

  const router = createCampusFeedbackRoutes({
    campusFeedbackStore: {},
    sessionStore: {
      async getOrThrow() {
        return { loggedIn: true, profileData: { TableContent: {} } };
      },
    },
    adminPassword: "test-admin",
  });

  const paths = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  for (const routePath of [
    "/campus-feedback/governance",
    "/campus-feedback/:type/options",
    "/campus-feedback/:type/submissions",
    "/campus-feedback/:type/legacy-import",
    "/campus-feedback/me/submissions",
    "/campus-feedback/admin/submissions",
    "/campus-feedback/admin/submissions/:feedbackId",
  ]) {
    assert.ok(paths.includes(routePath), `missing route ${routePath}`);
  }
});

test("campus feedback HTTP routes enforce unofficial namespace and admin moderation boundaries", async (t) => {
  const router = createTestRouter();

  const unauthenticated = await invokeRouter(router, {
    method: "POST",
    url: "/campus-feedback/events/submissions",
    body: {
      targetLabel: "Tech Fest",
      ratings: { Experience: 5 },
      comment: "Great event flow",
    },
  });
  assert.equal(unauthenticated.status, 401);

  const submitted = await invokeRouter(router, {
    method: "POST",
    url: "/campus-feedback/events/submissions",
    headers: { cookie: "erp_session=student-session" },
    body: {
      targetLabel: "Tech Fest",
      ratings: { Experience: 5 },
      comment: "Great event flow",
      displayMode: "anonymous",
    },
  });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.status, "pending");
  assert.equal(submitted.body.governance.routeNamespace, "/api/campus-feedback");

  const studentAdminRead = await invokeRouter(router, {
    url: "/campus-feedback/admin/submissions",
    headers: { cookie: "erp_session=student-session" },
  });
  assert.equal(studentAdminRead.status, 403);

  const adminQueue = await invokeRouter(router, {
    url: "/campus-feedback/admin/submissions?limit=10&offset=0",
    headers: {
      cookie: "erp_session=admin-session",
      "x-admin-password": "test-admin",
      "x-user-id": "admin-1",
      "x-user-name": "Admin User",
    },
  });
  assert.equal(adminQueue.status, 200);
  assert.equal(adminQueue.body.counts.pending, 1);
  assert.deepEqual(adminQueue.body.pagination, { limit: 10, offset: 0, total: 1 });
  assert.equal(adminQueue.body.items[0].id, submitted.body.id);

  const moderated = await invokeRouter(router, {
    method: "PATCH",
    url: `/campus-feedback/admin/submissions/${submitted.body.id}`,
    headers: {
      cookie: "erp_session=admin-session",
      "x-admin-password": "test-admin",
      "x-user-id": "admin-1",
      "x-user-name": "Admin User",
    },
    body: {
      status: "approved",
      reason: "Constructive and policy compliant",
    },
  });
  assert.equal(moderated.status, 200);
  assert.equal(moderated.body.status, "approved");
  assert.equal(moderated.body.audit[0].action, "moderated");
  assert.equal(moderated.body.audit[0].reason, "Constructive and policy compliant");
});
