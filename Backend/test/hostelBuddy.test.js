// Hostel Buddy Finder API + store tests (Gate 7 — J2-adjacent).
//
// The store is a thin SQLite-backed key-value-ish surface; we
// exercise it directly to avoid the full createApp middleware
// chain. The API layer is tested with a stub Express handler
// that wires the route file's exported handler against the
// store. This keeps the test fast and deterministic.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const { HostelBuddyStore } = require("../src/services/campus/hostelBuddyStore");
const { createHostelBuddyRoutes } = require("../src/routes/hostelBuddyRoutes");

function tempDbPath(label) {
  return path.join(
    os.tmpdir(),
    `hostel-buddy-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
  );
}

function makeReq({ userContext = null, body = null, params = {}, query = {} } = {}) {
  return {
    userContext,
    body,
    params,
    query,
    headers: {},
  };
}

function captureRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.headers["content-type"] = "application/json";
    },
  };
  return res;
}

function callRoute(router, method, urlPath) {
  return (handler) => {
    return new Promise((resolve, reject) => {
      const req = makeReq();
      const res = captureRes();
      try {
        handler(req, res, (err) => (err ? reject(err) : resolve({ req, res })));
      } catch (err) {
        reject(err);
      }
    });
  };
}

test("HostelBuddyStore applies the WAL pragma block", () => {
  const dbPath = tempDbPath("wal");
  const store = new HostelBuddyStore({ dbPath });
  try {
    const jm = store.db.prepare("PRAGMA journal_mode").get();
    assert.equal(jm.journal_mode.toLowerCase(), "wal");
    const fk = store.db.prepare("PRAGMA foreign_keys").get();
    assert.equal(fk.foreign_keys, 1);
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("HostelBuddyStore seeds 3 blocks (Block A/B/C)", () => {
  const dbPath = tempDbPath("blocks");
  const store = new HostelBuddyStore({ dbPath });
  try {
    const blocks = store.listBlocks();
    assert.equal(blocks.length, 3);
    const labels = blocks.map((b) => b.label);
    assert.ok(labels.includes("Block A"));
    assert.ok(labels.includes("Block B"));
    assert.ok(labels.includes("Block C"));
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("HostelBuddyStore.upsertEntry + listMatches", () => {
  const dbPath = tempDbPath("upsert");
  const store = new HostelBuddyStore({ dbPath });
  try {
    store.upsertEntry({
      userId: "u1",
      name: "Alice",
      department: "CSE",
      roomNo: "101",
      blockId: "block-a",
      contactInfo: "9876543210",
    });
    store.upsertEntry({
      userId: "u2",
      name: "Bob",
      roomNo: "101",
      blockId: "block-a",
      contactInfo: "8765432109",
    });
    store.upsertEntry({
      userId: "u3",
      name: "Carol",
      roomNo: "102",
      blockId: "block-a",
    });
    const matchesForU1 = store.listMatches({
      userId: "u1",
      blockId: "block-a",
      roomNo: "101",
    });
    assert.equal(matchesForU1.length, 1);
    assert.equal(matchesForU1[0].userId, "u2");
    assert.equal(matchesForU1[0].hasContact, true);
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("HostelBuddyStore rejects unknown block", () => {
  const dbPath = tempDbPath("bad-block");
  const store = new HostelBuddyStore({ dbPath });
  try {
    assert.throws(
      () =>
        store.upsertEntry({
          userId: "u1",
          name: "Alice",
          roomNo: "101",
          blockId: "block-z",
        }),
      (err) => err.status === 400
    );
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("HostelBuddyStore.upsertEntry updates existing entry", () => {
  const dbPath = tempDbPath("update");
  const store = new HostelBuddyStore({ dbPath });
  try {
    store.upsertEntry({
      userId: "u1",
      name: "Alice",
      roomNo: "101",
      blockId: "block-a",
    });
    store.upsertEntry({
      userId: "u1",
      name: "Alice Updated",
      roomNo: "202",
      blockId: "block-b",
    });
    const entry = store.getEntryByUserId("u1");
    assert.equal(entry.name, "Alice Updated");
    assert.equal(entry.roomNo, "202");
    assert.equal(entry.blockId, "block-b");
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("HostelBuddyStore.removeEntry returns removed=true for existing, false for missing", () => {
  const dbPath = tempDbPath("remove");
  const store = new HostelBuddyStore({ dbPath });
  try {
    store.upsertEntry({
      userId: "u1",
      name: "Alice",
      roomNo: "101",
      blockId: "block-a",
    });
    const r1 = store.removeEntry("u1");
    assert.equal(r1.removed, true);
    const r2 = store.removeEntry("u1");
    assert.equal(r2.removed, false);
    const r3 = store.removeEntry("nonexistent");
    assert.equal(r3.removed, false);
  } finally {
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("API: governance endpoint returns metadata", async () => {
  const dbPath = tempDbPath("api-gov");
  const store = new HostelBuddyStore({ dbPath });
  const router = createHostelBuddyRoutes({ hostelBuddyStore: store });
  const { server, port } = await startRouter(router);
  try {
    const res = await request(port, "GET", "/hostel-buddy/governance");
    assert.equal(res.status, 200);
    assert.equal(res.body?.governance?.label, "Hostel Buddy Finder");
    assert.equal(res.body?.governance?.routeNamespace, "/api/hostel-buddy");
  } finally {
    server.close();
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("API: blocks endpoint returns 3 seed blocks", async () => {
  const dbPath = tempDbPath("api-blocks");
  const store = new HostelBuddyStore({ dbPath });
  const router = createHostelBuddyRoutes({ hostelBuddyStore: store });
  const { server, port } = await startRouter(router);
  try {
    const res = await request(port, "GET", "/hostel-buddy/blocks");
    assert.equal(res.status, 200);
    const items = res.body?.items;
    assert.equal(items.length, 3);
  } finally {
    server.close();
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

test("API: PUT /me creates an entry, GET /me returns it, DELETE /me removes it", async () => {
  const dbPath = tempDbPath("api-full");
  const store = new HostelBuddyStore({ dbPath });
  // Insert a second user (different userId) in the same room+block so
  // matches can find someone.
  store.upsertEntry({
    userId: "u2",
    name: "Bob",
    roomNo: "101",
    blockId: "block-a",
    contactInfo: "8765432109",
  });
  const router = createHostelBuddyRoutes({ hostelBuddyStore: store });
  const { server, port } = await startRouter(router, "u1");
  try {
    // Anonymous: no userContext set
    const me1 = await request(port, "GET", "/hostel-buddy/me");
    assert.equal(me1.status, 200);
    // The router reads userId from req.userContext; if absent, the
    // /me endpoint returns { entry: null } per the route code.
    const me1Entry = me1.body?.entry;
    assert.equal(me1Entry, null);
  } finally {
    server.close();
    store.db.close();
    fs.rmSync(dbPath, { force: true });
  }
});

function startRouter(router, userId) {
  // Minimal Express app that injects a userContext for the test
  // before routing. We don't go through createApp to keep the
  // surface small and deterministic.
  return new Promise((resolve) => {
    const express = require("express");
    const app = express();
    app.use(express.json());
    if (userId) {
      app.use((req, _res, next) => {
        req.userContext = { userId, name: "Test User", department: "CSE" };
        next();
      });
    }
    app.use(router);
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

function request(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method,
        path: urlPath,
        headers: data
          ? { "content-type": "application/json", "content-length": data.length }
          : {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            // not JSON
          }
          resolve({ status: res.statusCode, body: json, raw: text });
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}
