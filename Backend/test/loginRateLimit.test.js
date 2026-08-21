const test = require("node:test");
const assert = require("node:assert/strict");

const { createLoginRateLimitMiddleware } = require("../src/middleware/rateLimit");

function createMockRequest({ ip = "203.0.113.10", forwardedFor = "" } = {}) {
  const headers = {};
  if (forwardedFor) headers["x-forwarded-for"] = forwardedFor;
  return {
    ip,
    requestId: "req-login-1",
    header(name) {
      return headers[String(name).toLowerCase()] || "";
    },
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    status(code) {
      this.statusCode = Number(code);
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test("login limiter allows normal traffic then rejects the excess with 429", async () => {
  const limiter = createLoginRateLimitMiddleware({});
  const next = () => next.calls += 1;
  next.calls = 0;

  let lastRes = null;
  for (let i = 0; i < 20; i++) {
    lastRes = createMockResponse();
    await limiter(createMockRequest(), lastRes, next);
    assert.equal(lastRes.statusCode, 200);
  }
  assert.equal(next.calls, 20);

  const blockedRes = createMockResponse();
  await limiter(createMockRequest(), blockedRes, next);
  assert.equal(blockedRes.statusCode, 429);
  assert.equal(blockedRes.body?.error?.code, "RATE_LIMITED");
  assert.match(blockedRes.body?.error?.message || "", /Too many login attempts/i);
  assert.equal(next.calls, 20, "blocked request must not reach the handler");
  assert.ok(Number(blockedRes.headers["retry-after"]) >= 1);
  assert.equal(blockedRes.headers["x-ratelimit-limit"], "20");
});

test("login limiter tracks client IPs independently", async () => {
  const limiter = createLoginRateLimitMiddleware({});
  const next = () => next.calls += 1;
  next.calls = 0;

  for (let i = 0; i < 25; i++) {
    await limiter(createMockRequest({ ip: "198.51.100.7" }), createMockResponse(), next);
  }

  const otherIpRes = createMockResponse();
  await limiter(
    createMockRequest({ ip: "198.51.100.8", forwardedFor: "198.51.100.8" }),
    otherIpRes,
    next
  );

  assert.equal(otherIpRes.statusCode, 200, "a different IP still has its own budget");
  assert.equal(otherIpRes.body, null);
});

test("login limiter prefers x-forwarded-for over socket ip", async () => {
  const seen = [];
  const limiter = createLoginRateLimitMiddleware({});
  const next = () => next.calls += 1;
  next.calls = 0;

  for (let i = 0; i < 21; i++) {
    const res = createMockResponse();
    await limiter(
      createMockRequest({ ip: "10.0.0.1", forwardedFor: "203.0.113.99" }),
      res,
      next
    );
    seen.push(res.statusCode);
  }

  assert.equal(seen[19], 200);
  assert.equal(seen[20], 429);
});

test("login limiter enforces via redis when a client is provided", async () => {
  let incrCalls = 0;
  const storedKeys = new Set();
  const redisClient = {
    async incr(key) {
      incrCalls += 1;
      storedKeys.add(key);
      return incrCalls;
    },
    async expire(key, ttlSec) {
      assert.ok(Number(ttlSec) >= 1, "expire receives a positive ttl");
    },
    async ttl() {
      return 42;
    },
  };

  const limiter = createLoginRateLimitMiddleware({ redisClient });
  const next = () => next.calls += 1;
  next.calls = 0;

  let lastRes = null;
  for (let i = 0; i < 21; i++) {
    lastRes = createMockResponse();
    await limiter(createMockRequest(), lastRes, next);
  }

  assert.equal(lastRes.statusCode, 429);
  assert.equal(lastRes.headers["retry-after"], "42");
  assert.equal(lastRes.headers["x-ratelimit-remaining"], "0");
  assert.equal(next.calls, 20);
  assert.equal(incrCalls, 21);
  assert.equal(storedKeys.size, 1);
  assert.ok(storedKeys.values().next().value.startsWith("ratelimit:login:"));
});

test("login limiter degrades to allow when redis errors", async () => {
  const failingClient = {
    async incr() {
      throw new Error("redis down");
    },
    async expire() {},
    async ttl() {
      throw new Error("redis down");
    },
  };

  const limiter = createLoginRateLimitMiddleware({ redisClient: failingClient });
  const next = () => next.calls += 1;
  next.calls = 0;

  const res = createMockResponse();
  await limiter(createMockRequest(), res, next);

  assert.equal(res.statusCode, 200, "availability wins over enforcement when redis fails");
  assert.equal(res.body, null);
  assert.equal(next.calls, 1);
});
