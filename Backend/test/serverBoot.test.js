const test = require("node:test");
const assert = require("node:assert/strict");

test("external seed data import is runtime-safe", () => {
  const seedModule = require("../src/data/externalSeedData");
  assert.ok(seedModule);
  assert.equal(typeof seedModule.EXTERNAL_PAGE_SEED_DATA, "object");
  assert.ok(Object.keys(seedModule.EXTERNAL_PAGE_SEED_DATA).length > 0);
});

test("server module boot path is importable", () => {
  const serverModule = require("../src/server");
  assert.equal(typeof serverModule.startServer, "function");
});
