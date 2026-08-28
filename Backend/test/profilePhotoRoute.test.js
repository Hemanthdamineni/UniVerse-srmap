const test = require("node:test");
const assert = require("node:assert/strict");

const ROUTE_PATH = "/profile/photo";

function findRouteHandler(router, path, method = "get") {
  const layer = router.stack.find(
    (entry) =>
      entry.route &&
      entry.route.path === path &&
      entry.route.methods &&
      entry.route.methods[method]
  );

  assert.ok(layer, `Expected route ${method.toUpperCase()} ${path} to exist`);
  return layer.route.stack[0].handle;
}

function createMockRequest({ headers = {} } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value])
  );

  return {
    headers: normalizedHeaders,
    header(name) {
      return normalizedHeaders[String(name || "").toLowerCase()] || "";
    },
  };
}

function createMockResponse() {
  const headers = new Map();

  return {
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    status(code) {
      this.statusCode = Number(code);
      return this;
    },
    end(chunk = null) {
      this.body = chunk;
      return this;
    },
    clearedCookies: 0,
    clearCookie() {
      this.clearedCookies += 1;
      return this;
    },
  };
}

function loadRouterWithPatches({ fetchStudentPhoto } = {}) {
  const erpClient = require("../src/services/erp/erpClient");
  const originals = {
    createApiContext: erpClient.createApiContext,
    fetchStudentPhoto: erpClient.fetchStudentPhoto,
  };

  if (fetchStudentPhoto) {
    erpClient.fetchStudentPhoto = fetchStudentPhoto;
  }
  erpClient.createApiContext = async () => ({ dispose: async () => {} });

  delete require.cache[require.resolve("../src/routes/authRoutes")];

  return {
    erpClient,
    restore() {
      erpClient.createApiContext = originals.createApiContext;
      erpClient.fetchStudentPhoto = originals.fetchStudentPhoto;
      delete require.cache[require.resolve("../src/routes/authRoutes")];
    },
  };
}

function createSessionStore(session) {
  return {
    async getOrThrow() {
      if (session instanceof Error) throw session;
      return session;
    },
    async update() {},
  };
}

test("extractStudentPhotoSrc picks the navbar photo and skips the img.jpg placeholder", async () => {
  const { extractStudentPhotoSrc } = require("../src/services/erp/erpClient");

  const shell = `
    <html><body>
      <div class="profile_info"><img src="images/img.jpg" alt="default"></div>
      <img src="resources/photos/AP23110010419.jpg" alt="student">
    </body></html>`;

  assert.equal(extractStudentPhotoSrc(shell), "resources/photos/AP23110010419.jpg");
  assert.equal(extractStudentPhotoSrc("<div>no images here</div>"), "");
  assert.equal(extractStudentPhotoSrc('<img src="data:image/png;base64,AAA">'), "");
  assert.equal(extractStudentPhotoSrc(""), "");
});

test("profile photo route streams the ERP photo with image headers", async () => {
  const buffer = Buffer.from("fake-jpeg-bytes");
  const loader = loadRouterWithPatches({
    fetchStudentPhoto: async () => ({ buffer, contentType: "image/jpeg" }),
  });
  const { createAuthRoutes } = require("../src/routes/authRoutes");

  const router = createAuthRoutes({ sessionStore: createSessionStore({ storageState: { cookies: [] } }) });
  const handler = findRouteHandler(router, ROUTE_PATH);
  const res = createMockResponse();

  await handler(createMockRequest({ headers: { cookie: "erp_session=session-1" } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.getHeader("content-type"), "image/jpeg");
  assert.match(String(res.getHeader("cache-control")), /private/);
  assert.equal(res.body, buffer);
  loader.restore();
});

test("profile photo route returns a quiet 404 when the ERP has no photo", async () => {
  const loader = loadRouterWithPatches({ fetchStudentPhoto: async () => null });
  const { createAuthRoutes } = require("../src/routes/authRoutes");

  const router = createAuthRoutes({ sessionStore: createSessionStore({ storageState: { cookies: [] } }) });
  const handler = findRouteHandler(router, ROUTE_PATH);
  const res = createMockResponse();

  await handler(createMockRequest({ headers: { cookie: "erp_session=session-1" } }), res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body, null);
  assert.equal(res.clearedCookies, 0);
  loader.restore();
});

test("profile photo route never clears the app session when the ERP session is dead", async () => {
  const loader = loadRouterWithPatches();
  const { createAuthRoutes } = require("../src/routes/authRoutes");

  const router = createAuthRoutes({
    sessionStore: createSessionStore(Object.assign(new Error("session missing"), { status: 401 })),
  });
  const handler = findRouteHandler(router, ROUTE_PATH);
  const res = createMockResponse();

  await handler(createMockRequest({ headers: { cookie: "erp_session=session-1" } }), res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.clearedCookies, 0);
  loader.restore();
});
