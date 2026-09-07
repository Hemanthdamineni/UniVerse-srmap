const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

const { UserDirectoryStore } = require("../src/services/core/userDirectoryStore");
const { createUserDirectoryRoutes } = require("../src/routes/userDirectoryRoutes");

function makeStore(name) {
  return new UserDirectoryStore({
    dbPath: path.join(os.tmpdir(), `user-directory-${name}-${process.pid}-${Date.now()}.sqlite`),
  });
}

function invokeRouter(router, { url, headers = {} }) {
  return new Promise((resolve, reject) => {
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const parsed = new URL(url, "http://localhost");
    const req = {
      method: "GET",
      url: `${parsed.pathname}${parsed.search}`,
      originalUrl: `${parsed.pathname}${parsed.search}`,
      baseUrl: "",
      path: parsed.pathname,
      headers: lower,
      body: {},
      query: Object.fromEntries(parsed.searchParams.entries()),
      header: (n) => lower[String(n).toLowerCase()] || "",
      get: (n) => lower[String(n).toLowerCase()] || "",
    };
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(n, v) {
        this.headers[n.toLowerCase()] = v;
      },
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(p) {
        resolve({ status: this.statusCode, body: p });
        return this;
      },
      send(p) {
        resolve({ status: this.statusCode, body: p });
        return this;
      },
    };
    router.handle(req, res, (err) => (err ? reject(err) : resolve({ status: res.statusCode, body: null })));
  });
}

const sessionStore = {
  async getOrThrow() {
    return {
      loggedIn: true,
      profileData: { TableContent: { "Register No.": "AP-VIEWER", "Student Name": "Org Aniser" } },
    };
  },
};

test("record upserts and ignores blanks / role placeholders", () => {
  const store = makeStore("record");
  store.record("AP1", "Asha Rao");
  store.record("AP1", "Asha K. Rao"); // update
  store.record("AP2", "");            // ignored
  store.record("", "Nobody");         // ignored
  store.record("AP3", "student");     // placeholder → ignored
  store.record("AP4", "  Bala  ");    // trimmed

  const resolved = store.resolve(["AP1", "AP2", "AP3", "AP4", "AP-UNKNOWN"]);
  assert.deepEqual(resolved, [
    { id: "AP1", name: "Asha K. Rao" },
    { id: "AP2", name: null },
    { id: "AP3", name: null },
    { id: "AP4", name: "Bala" },
    { id: "AP-UNKNOWN", name: null },
  ]);
});

test("resolve de-dupes, trims, and preserves input order", () => {
  const store = makeStore("resolve");
  store.record("AP1", "One");
  store.record("AP2", "Two");
  assert.deepEqual(store.resolve([" AP2 ", "AP1", "AP2", ""]), [
    { id: "AP2", name: "Two" },
    { id: "AP1", name: "One" },
  ]);
  assert.deepEqual(store.resolve([]), []);
});

test("GET /users/resolve returns names for known ids and null for the rest", async () => {
  const store = makeStore("route");
  store.record("AP1", "Asha Rao");
  store.record("AP2", "Bala Iyer");

  const router = createUserDirectoryRoutes({ userDirectory: store, sessionStore, adminPassword: "x" });
  const res = await invokeRouter(router, {
    url: "/users/resolve?ids=AP1,AP2,AP-NOBODY",
    headers: { cookie: "erp_session=s1" },
  });

  assert.equal(res.status, 200);
  assert.deepEqual(res.body.items, [
    { id: "AP1", name: "Asha Rao" },
    { id: "AP2", name: "Bala Iyer" },
    { id: "AP-NOBODY", name: null },
  ]);
});

test("GET /users/resolve requires authentication", async () => {
  const store = makeStore("route-auth");
  const router = createUserDirectoryRoutes({
    userDirectory: store,
    sessionStore: {
      async getOrThrow() {
        throw new Error("no session");
      },
    },
    adminPassword: "x",
  });
  const res = await invokeRouter(router, { url: "/users/resolve?ids=AP1" });
  assert.equal(res.status, 401);
});

test("the resolve endpoint also records the viewer via the shared middleware", async () => {
  const store = makeStore("route-record");
  const router = createUserDirectoryRoutes({ userDirectory: store, sessionStore, adminPassword: "x" });
  await invokeRouter(router, { url: "/users/resolve?ids=AP1", headers: { cookie: "erp_session=s1" } });
  assert.deepEqual(store.resolve(["AP-VIEWER"]), [{ id: "AP-VIEWER", name: "Org Aniser" }]);
});
