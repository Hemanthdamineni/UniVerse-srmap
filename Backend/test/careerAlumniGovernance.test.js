const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

process.env.ADMIN_REGISTER_NUMBERS = "AP23110010419";

const { CareerStore } = require("../src/services/career/careerStore");
const { createCareerRoutes } = require("../src/routes/careerRoutes");

function makeStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "career-alumni-governance-"));
  const dbPath = path.join(tempDir, "career.sqlite");
  return { store: new CareerStore({ dbPath }), tempDir };
}

function createSession(profileData) {
  return {
    loggedIn: true,
    adminElevated: profileData.userId === "AP23110010419",
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
    "student-2-session": createSession({ userId: "student-2", name: "Student Two" }),
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

test("alumni write routes require admin access (regression: previously unguarded)", async () => {
  const { store, tempDir } = makeStore();
  try {
    const router = createCareerRoutes({
      careerStore: store,
      sessionStore: createSessionStore(),
      adminPassword: "test-admin",
    });

    const created = await invokeRouter(router, {
      method: "POST",
      url: "/career/alumni",
      headers: { cookie: "erp_session=student-session" },
      body: { name: "Sneaky Entry", batch: "2020" },
    });
    assert.equal(created.status, 403);

    const updated = await invokeRouter(router, {
      method: "PUT",
      url: "/career/alumni/some-id",
      headers: { cookie: "erp_session=student-session" },
      body: { name: "Hijacked" },
    });
    assert.equal(updated.status, 403);

    const deleted = await invokeRouter(router, {
      method: "DELETE",
      url: "/career/alumni/some-id",
      headers: { cookie: "erp_session=student-session" },
    });
    assert.equal(deleted.status, 403);

    const asAdmin = await invokeRouter(router, {
      method: "POST",
      url: "/career/alumni",
      headers: { cookie: "erp_session=admin-session", "x-admin-password": "test-admin" },
      body: { name: "Legit Entry", batch: "2020", degree: "B.Tech CSE", company: "Acme", role: "SWE" },
    });
    assert.equal(asAdmin.status, 200);
    assert.equal(asAdmin.body.name, "Legit Entry");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("alumni nomination HTTP routes: student suggests, admin approves into the live directory", async () => {
  const { store, tempDir } = makeStore();
  try {
    const router = createCareerRoutes({
      careerStore: store,
      sessionStore: createSessionStore(),
      adminPassword: "test-admin",
    });

    const nominated = await invokeRouter(router, {
      method: "POST",
      url: "/career/alumni/nominations",
      headers: { cookie: "erp_session=student-session" },
      body: {
        name: "Kavya Nair",
        email: "kavya@demo.alumni",
        batch: "2016",
        linkedinUrl: "https://linkedin.com/in/kavya",
      },
    });
    assert.equal(nominated.status, 200);
    assert.equal(nominated.body.status, "pending");

    const studentPendingQueue = await invokeRouter(router, {
      url: "/career/alumni/nominations/pending",
      headers: { cookie: "erp_session=student-session" },
    });
    assert.equal(studentPendingQueue.status, 403);

    const mine = await invokeRouter(router, {
      url: "/career/alumni/nominations/mine",
      headers: { cookie: "erp_session=student-session" },
    });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.items.length, 1);

    const adminQueue = await invokeRouter(router, {
      url: "/career/alumni/nominations/pending",
      headers: { cookie: "erp_session=admin-session", "x-admin-password": "test-admin" },
    });
    assert.equal(adminQueue.status, 200);
    assert.equal(adminQueue.body.items[0].id, nominated.body.id);

    const reviewed = await invokeRouter(router, {
      method: "PATCH",
      url: `/career/alumni/nominations/${nominated.body.id}`,
      headers: { cookie: "erp_session=admin-session", "x-admin-password": "test-admin" },
      body: { decision: "approve", reason: "Verified via LinkedIn profile." },
    });
    assert.equal(reviewed.status, 200);
    assert.equal(reviewed.body.status, "approved");
    assert.ok(reviewed.body.publishedAlumniId);

    const directory = await invokeRouter(router, {
      url: "/career/alumni",
      headers: { cookie: "erp_session=student-session" },
    });
    assert.ok(directory.body.items.some((a) => a.id === reviewed.body.publishedAlumniId));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("alumni connection-request HTTP routes: admin inbox accepts a request, requester sees the outcome", async () => {
  const { store, tempDir } = makeStore();
  try {
    const router = createCareerRoutes({
      careerStore: store,
      sessionStore: createSessionStore(),
      adminPassword: "test-admin",
    });

    const alumnus = await invokeRouter(router, {
      method: "POST",
      url: "/career/alumni",
      headers: { cookie: "erp_session=admin-session", "x-admin-password": "test-admin" },
      body: { name: "Dev Patel", batch: "2015", degree: "B.Tech CSE", company: "Umbrella", role: "PM", openToConnect: true },
    });
    assert.equal(alumnus.status, 200);

    const requested = await invokeRouter(router, {
      method: "POST",
      url: `/career/alumni/${alumnus.body.id}/requests`,
      headers: { cookie: "erp_session=student-2-session" },
      body: { message: "Would love to connect!" },
    });
    assert.equal(requested.status, 200);
    assert.equal(requested.body.requested, true);

    const studentInboxAttempt = await invokeRouter(router, {
      url: "/career/alumni/requests/pending",
      headers: { cookie: "erp_session=student-2-session" },
    });
    assert.equal(studentInboxAttempt.status, 403);

    const inbox = await invokeRouter(router, {
      url: "/career/alumni/requests/pending",
      headers: { cookie: "erp_session=admin-session", "x-admin-password": "test-admin" },
    });
    assert.equal(inbox.status, 200);
    assert.equal(inbox.body.items[0].requesterName, "Student Two");
    assert.equal(inbox.body.items[0].alumniName, "Dev Patel");

    const decided = await invokeRouter(router, {
      method: "PATCH",
      url: `/career/alumni/requests/${inbox.body.items[0].id}`,
      headers: { cookie: "erp_session=admin-session", "x-admin-password": "test-admin" },
      body: { decision: "accept", note: "Introduced over email" },
    });
    assert.equal(decided.status, 200);
    assert.equal(decided.body.status, "accepted");

    const sent = await invokeRouter(router, {
      url: "/career/alumni/requests/sent",
      headers: { cookie: "erp_session=student-2-session" },
    });
    assert.equal(sent.body.items[0].status, "accepted");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
