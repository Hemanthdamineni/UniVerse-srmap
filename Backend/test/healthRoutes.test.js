const test = require("node:test");
const assert = require("node:assert/strict");

const { createHealthRoutes } = require("../src/routes/healthRoutes");

function createRouter() {
  return createHealthRoutes({
    sessionStore: { size: async () => 2 },
    discoveryRepository: { getHealth: () => ({ loaded: true, filePath: "/tmp/discovery.json" }) },
    pagePolicyStore: { getHealth: () => ({ policyPath: "/tmp/policy.json" }) },
    redisClient: null,
    externalDataStore: { ping: () => true },
    contentStore: { ping: () => true },
    integrityService: {
      evaluate: () => ({
        ok: false,
        checkedAt: new Date().toISOString(),
        failures: ["discovery_artifact_stale"],
      }),
    },
    careerStore: null,
  });
}

function createMockResponse() {
  const headers = {};
  return {
    statusCode: 200,
    payload: null,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
    },
    getHeader(name) {
      return headers[String(name).toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

async function invokeRoute(path) {
  const router = createRouter();
  const layer = router.stack.find((entry) => entry.route?.path === path);
  assert.ok(layer, `Expected route ${path} to exist`);

  const req = {
    method: "GET",
    url: path,
    originalUrl: `/api${path}`,
    requestId: `test-${path.replace(/\W+/g, "-")}`,
  };
  const res = createMockResponse();

  await layer.route.stack[0].handle(req, res);
  return res;
}

test("health route includes integrity diagnostics", async () => {
  const response = await invokeRoute("/health");
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.ok, true);
  assert.equal(response.payload.integrity.ok, false);
  assert.ok(Array.isArray(response.payload.integrity.failures));
  assert.deepEqual(response.payload.career, { enabled: false });
});

test("ready route reports integrity status fields", async () => {
  const response = await invokeRoute("/ready");
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.ok, true);
  assert.equal(response.payload.checks.integrityEvaluated, true);
  assert.equal(response.payload.checks.integrityOk, false);
  assert.equal(response.payload.integrity.ok, false);
});
