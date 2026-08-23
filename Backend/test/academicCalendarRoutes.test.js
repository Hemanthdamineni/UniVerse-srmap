const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createAcademicCalendarRoutes,
  loadAcademicCalendar,
} = require("../src/routes/academicCalendarRoutes");

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

async function invokeCalendarRoute() {
  const router = createAcademicCalendarRoutes();
  const layer = router.stack.find((entry) => entry.route?.path === "/academic-calendar");
  assert.ok(layer, "Expected /academic-calendar route to exist");

  const req = {
    method: "GET",
    url: "/academic-calendar",
    originalUrl: "/api/academic-calendar",
    requestId: "test-academic-calendar",
  };
  const res = createMockResponse();

  await layer.route.stack[0].handle(req, res);
  return res;
}

test("GET /academic-calendar returns segregated calendar data", async () => {
  const response = await invokeCalendarRoute();
  assert.equal(response.statusCode, 200);

  const payload = response.payload;
  assert.equal(payload.success, true);

  const data = payload.data;
  assert.ok(Array.isArray(data.oddSemesterData) && data.oddSemesterData.length > 0);
  assert.ok(Array.isArray(data.evenSemesterData) && data.evenSemesterData.length > 0);
  assert.ok(Array.isArray(data.summerTermData) && data.summerTermData.length > 0);
  assert.ok(Array.isArray(data.oddSemesterHolidays) && data.oddSemesterHolidays.length > 0);
  assert.ok(Array.isArray(data.evenSemesterHolidays) && data.evenSemesterHolidays.length > 0);
  assert.ok(Array.isArray(data.importantNotes) && data.importantNotes.length > 0);

  const holiday = data.oddSemesterHolidays[0];
  assert.equal(typeof holiday.occasion, "string");
  assert.equal(typeof holiday.date, "string");
  assert.equal(typeof holiday.day, "string");

  const event = data.oddSemesterData[0];
  assert.equal(typeof event.details, "string");
});

test("calendar route serves static source header and caches the payload", async () => {
  const first = await invokeCalendarRoute();
  const second = await invokeCalendarRoute();
  assert.equal(first.getHeader("x-erp-source"), "static");
  assert.deepEqual(second.payload, first.payload);
});

test("loadAcademicCalendar parses every semester section from disk", () => {
  const data = loadAcademicCalendar();
  assert.equal(typeof data, "object");
  for (const key of [
    "oddSemesterData",
    "evenSemesterData",
    "summerTermData",
    "oddSemesterHolidays",
    "evenSemesterHolidays",
    "importantNotes",
  ]) {
    assert.ok(Array.isArray(data[key]), `Expected ${key} to be an array`);
  }
});
