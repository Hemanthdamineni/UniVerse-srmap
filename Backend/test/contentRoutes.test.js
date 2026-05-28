const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const { ContentStore } = require("../src/services/contentStore");
const { createContentRoutes } = require("../src/routes/contentRoutes");

function makeStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "content-routes-test-"));
  return new ContentStore(path.join(tempDir, "content.sqlite"));
}

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

test("content admin routes enforce password and expose lifecycle workflow", async () => {
  const store = makeStore();
  const app = express();
  app.use(express.json());
  app.use("/api", createContentRoutes({ contentStore: store, adminPassword: "secret" }));
  const { server, baseUrl } = await listen(app);

  try {
    const denied = await fetch(`${baseUrl}/api/content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "announcement", title: "Hidden Draft" }),
    });
    assert.equal(denied.status, 403);

    const created = await fetch(`${baseUrl}/api/content`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-password": "secret", "x-admin-actor": "admin-route" },
      body: JSON.stringify({ type: "announcement", title: "Launch Notice", lifecycleState: "draft" }),
    });
    assert.equal(created.status, 200);
    const createdBody = await created.json();
    assert.equal(createdBody.data.lifecycleState, "draft");

    const workflow = await fetch(`${baseUrl}/api/content/admin/workflow`, {
      headers: { "x-admin-password": "secret" },
    });
    assert.equal(workflow.status, 200);
    const workflowBody = await workflow.json();
    assert.ok(workflowBody.data.transitions.some((transition) => transition.action === "publish"));

    const preview = await fetch(`${baseUrl}/api/content/bulk/preview`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-password": "secret" },
      body: JSON.stringify({ ids: [createdBody.data.id], action: "publish" }),
    });
    assert.equal(preview.status, 200);
    const previewBody = await preview.json();
    assert.equal(previewBody.data.valid, true);

    const executed = await fetch(`${baseUrl}/api/content/bulk/execute`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-password": "secret" },
      body: JSON.stringify({ ids: [createdBody.data.id], action: "publish", reason: "Ready to publish" }),
    });
    assert.equal(executed.status, 200);

    const history = await fetch(`${baseUrl}/api/content/${createdBody.data.id}/history`, {
      headers: { "x-admin-password": "secret" },
    });
    assert.equal(history.status, 200);
    const historyBody = await history.json();
    assert.ok(historyBody.data.items.some((entry) => entry.action === "publish"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
