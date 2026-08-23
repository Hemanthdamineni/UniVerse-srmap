const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createFacultyCabinRoutes,
  loadFacultyCabins,
} = require("../src/routes/facultyCabinRoutes");

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

async function invokeCabinsRoute() {
  const router = createFacultyCabinRoutes();
  const layer = router.stack.find((entry) => entry.route?.path === "/faculty-cabins");
  assert.ok(layer, "Expected /faculty-cabins route to exist");

  const req = {
    method: "GET",
    url: "/faculty-cabins",
    originalUrl: "/api/faculty-cabins",
    requestId: "test-faculty-cabins",
  };
  const res = createMockResponse();

  await layer.route.stack[0].handle(req, res);
  return res;
}

test("GET /faculty-cabins returns cabin entries with required fields", async () => {
  const response = await invokeCabinsRoute();
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.success, true);

  const data = response.payload.data;
  assert.ok(Array.isArray(data));
  assert.ok(data.length > 100, `Expected a substantial directory, got ${data.length}`);
  for (const row of data.slice(0, 10)) {
    assert.equal(typeof row.faculty, "string");
    assert.equal(typeof row.location, "string");
  }
});

test("faculty cabin route serves static source header and caches payload", async () => {
  const first = await invokeCabinsRoute();
  const second = await invokeCabinsRoute();
  assert.equal(first.getHeader("x-erp-source"), "static");
  assert.deepEqual(second.payload, first.payload);
});

test("loadFacultyCabins drops rows without a location", () => {
  const rows = loadFacultyCabins();
  assert.ok(rows.every((row) => row.faculty && row.location));
});
