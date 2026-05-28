const test = require("node:test");
const assert = require("node:assert/strict");

const scrapeTargets = require("../src/config/scrapeTargets");
const {
  extractFinanceFeePaidSourceStats,
} = require("../src/services/erpFinanceIntegrity");

test("fee-paid source scrape targets stay one-to-one for per-source visibility", () => {
  assert.deepEqual(scrapeTargets["finance/fee-paid-details"], [
    { dropdown: "Finance", subitem: "Fee Paid Details" },
  ]);
  assert.deepEqual(scrapeTargets["finance/payment-acknowledgment"], [
    { dropdown: "Finance", subitem: "Payment Acknowledgment" },
  ]);
  assert.deepEqual(scrapeTargets["finance/online-payment-verification"], [
    { dropdown: "Finance", subitem: "Online Payment Verification" },
  ]);
});

test("extractFinanceFeePaidSourceStats reports all three source row counts for the composite page", () => {
  const stats = extractFinanceFeePaidSourceStats({
    pageKey: "finance/fee-paid",
    data: {
      Finance: {
        "Fee Paid Details": {
          tables: [[{ "Receipt No.": "R-1" }, { "Receipt No.": "R-2" }]],
        },
        "Payment Acknowledgment": {
          tables: [[{ "Transaction No.": "T-1" }]],
        },
        "Online Payment Verification": {
          tables: [[]],
        },
      },
    },
  });

  assert.equal(stats.rawRowCount, 3);
  assert.deepEqual(
    stats.sources.map((source) => [source.label, source.status, source.rowCount]),
    [
      ["Fee Paid Details", "loaded", 2],
      ["Payment Acknowledgment", "loaded", 1],
      ["Online Payment Verification", "empty", 0],
    ]
  );
  assert.match(stats.sources[2].warnings[0], /zero tabular rows/i);
});
