const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const express = require("express");

const { createRequestContextMiddleware } = require("../src/middleware/requestContext");
const { createUserContextMiddleware } = require("../src/utils/eventsAuth");
const { ensureAuthenticatedForUploads } = require("../src/middleware/fileServing");

function tempDbPath() {
  return path.join(os.tmpdir(), `fileserving-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
}

function makeApp() {
  const { SessionStore } = require("../src/services/core/sessionServices");
  const sessionStore = new SessionStore(60_000);

  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "uploads-"));
  const app = express();
  app.use(createRequestContextMiddleware());
  app.use(createUserContextMiddleware({ sessionStore }));
  app.use("/uploads", ensureAuthenticatedForUploads);
  app.use("/uploads", express.static(uploadsDir));
  fs.writeFileSync(path.join(uploadsDir, "sample.bin"), "hello");
  return { app, sessionStore, uploadsDir };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

function fetch(port, path, cookie) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { host: "127.0.0.1", port, path, headers: cookie ? { Cookie: cookie } : {} },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on("error", reject);
  });
}

test("file-serving: /uploads returns 401 when no session cookie is set", async () => {
  const { app, sessionStore, uploadsDir } = await makeApp();
  const { server, port } = await listen(app);
  try {
    const res = await fetch(port, "/uploads/sample.bin");
    assert.equal(res.status, 401);
    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.error.code, "RESOURCE_AUTH_REQUIRED");
    assert.equal(typeof body.requestId, "string");
  } finally {
    server.close();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  }
});

test("file-serving: /uploads returns 200 when a logged-in session is set", async () => {
  const { app, sessionStore, uploadsDir } = await makeApp();
  const sessionId = await sessionStore.create({ loggedIn: false });
  await sessionStore.update(sessionId, {
    loggedIn: true,
    username: "AP23110010001",
    profileData: { userId: "AP23110010001", name: "Test User", role: "student" },
  });
  const { server, port } = await listen(app);
  try {
    const res = await fetch(port, "/uploads/sample.bin", `erp_session=${sessionId}`);
    assert.equal(res.status, 200);
    assert.equal(res.body, "hello");
  } finally {
    server.close();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  }
});

test("file-serving: /uploads returns 401 for an anonymous (loggedIn=false) session", async () => {
  const { app, sessionStore, uploadsDir } = await makeApp();
  const sessionId = await sessionStore.create({ loggedIn: false });
  const { server, port } = await listen(app);
  try {
    const res = await fetch(port, "/uploads/sample.bin", `erp_session=${sessionId}`);
    assert.equal(res.status, 401);
  } finally {
    server.close();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  }
});

test("file-serving: /uploads is not gated for /files/* paths (positive control)", async () => {
  // The policy says /files/* stay public. Verify by mounting
  // /files/submissions in the test app without the auth gate.
  const filesDir = fs.mkdtempSync(path.join(os.tmpdir(), "files-"));
  fs.writeFileSync(path.join(filesDir, "submission.pdf"), "shared-doc");
  const app = express();
  app.use(createRequestContextMiddleware());
  app.use(createUserContextMiddleware({ sessionStore: new (require("../src/services/core/sessionServices").SessionStore)(60_000) }));
  app.use("/files/submissions", express.static(filesDir));
  const { server, port } = await listen(app);
  try {
    const res = await fetch(port, "/files/submissions/submission.pdf");
    assert.equal(res.status, 200);
    assert.equal(res.body, "shared-doc");
  } finally {
    server.close();
    fs.rmSync(filesDir, { recursive: true, force: true });
  }
});
