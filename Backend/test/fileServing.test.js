const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const express = require("express");

const { SessionStore } = require("../src/services/core/sessionServices");
const { createCompetitionRoutes } = require("../src/routes/competitionRoutes");

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

function request(port, options, body = "") {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, ...options }, (res) => {
      let response = "";
      res.on("data", (chunk) => { response += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body: response }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

function makeApp() {
  const sessionStore = new SessionStore(60_000);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "competition-private-"));
  const store = {
    submissionsDir: path.join(root, "submissions"),
    certificatesDir: path.join(root, "certificates"),
    assertEventPermission() {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    },
    assertCanSubmit() {
      const error = new Error("Forbidden");
      error.status = 403;
      throw error;
    },
  };
  fs.mkdirSync(store.submissionsDir, { recursive: true });
  fs.mkdirSync(store.certificatesDir, { recursive: true });
  fs.writeFileSync(path.join(store.submissionsDir, "private.txt"), "secret");
  const app = express();
  app.use("/api", createCompetitionRoutes({ competitionStore: store, sessionStore, submissionsDir: store.submissionsDir }));
  return { app, root };
}

test("runtime files: anonymous requests cannot retrieve the former public /files namespace", async () => {
  const { app, root } = makeApp();
  const { server, port } = await listen(app);
  try {
    const response = await request(port, { path: "/files/submissions/private.txt", method: "GET" });
    assert.equal(response.status, 404);
    assert.doesNotMatch(response.body, /secret/);
  } finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("uploads: an anonymous multipart request is rejected before Multer writes a file", async () => {
  const { app, root } = makeApp();
  const { server, port } = await listen(app);
  const boundary = "----erp-test-boundary";
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="forbidden.png"',
    "Content-Type: image/png",
    "",
    "not-an-image",
    `--${boundary}--`,
    "",
  ].join("\r\n");
  try {
    const response = await request(port, {
      path: "/api/competitions/event-1/certificate-template/image",
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": Buffer.byteLength(body) },
    }, body);
    assert.equal(response.status, 401);
    assert.equal(fs.readdirSync(path.join(root, "certificates", "templates")).length, 0);
  } finally {
    server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
