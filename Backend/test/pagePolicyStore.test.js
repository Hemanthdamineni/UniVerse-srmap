const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { PagePolicyStore } = require("../src/services/pagePolicyStore");

function makePolicyFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "policy-test-"));
  const file = path.join(dir, "erp-page-policy.json");
  fs.writeFileSync(file, JSON.stringify(content, null, 2));
  return file;
}

test("resolves override before prefix rules", () => {
  const policyPath = makePolicyFile({
    defaultMode: "cached-first",
    liveFirstPrefixes: ["finance/"],
    overrides: {
      "finance/fee-due-details": "cached-first",
    },
  });

  const store = new PagePolicyStore(policyPath);

  assert.equal(store.resolveMode("finance/online-payment-verification"), "live-first");
  assert.equal(store.resolveMode("finance/fee-due-details"), "cached-first");
});

test("uses default mode when no rule matches", () => {
  const policyPath = makePolicyFile({
    defaultMode: "live-first",
    liveFirstPrefixes: [],
    cachedFirstPrefixes: [],
    overrides: {},
  });

  const store = new PagePolicyStore(policyPath);
  assert.equal(store.resolveMode("academic/time-table"), "live-first");
});
