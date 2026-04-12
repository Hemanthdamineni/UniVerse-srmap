const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { ErpUiMapStore } = require("../src/services/erpUiMapStore");

function makeUiMapFile(payload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "erp-ui-map-store-"));
  const file = path.join(dir, "erp-ui-map.json");
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

function makeStore() {
  const uiMap = {
    generatedAt: "2026-03-07T00:00:00.000Z",
    pages: [
      {
        key: "Verification::Mobile No Verification",
        dropdown: "Verification",
        subitem: "Mobile No Verification",
        ui: {
          forms: [
            {
              id: "frmMobileNoVerify_222",
              method: "POST",
              fields: [{ id: "optmobilenumber", type: "text" }],
            },
          ],
          controls: [
            {
              label: "Send OTP",
              formRef: "frmMobileNoVerify_222",
              inferredAction: {
                kind: "function-call",
                functionName: "funSendOTP",
                args: [],
              },
            },
          ],
        },
        integration: {
          mutations: [
            {
              method: "POST",
              url: "students/transaction/mobilenumberverificationotp.jsp",
              fromFunction: "funMobileVerificationOTP",
            },
          ],
        },
      },
      {
        key: "Finance::Bank Account Details",
        dropdown: "Finance",
        subitem: "Bank Account Details",
        ui: {
          forms: [
            {
              id: "frmPalack",
              method: "POST",
              fields: [{ id: "txtBankname", type: "text" }],
            },
          ],
          controls: [
            {
              label: "Save",
              formRef: "frmPalack",
              inferredAction: {
                kind: "function-call",
                functionName: "funSave",
                args: [],
              },
            },
          ],
        },
        integration: {
          mutations: [
            {
              method: "POST",
              url: "students/transaction/studentbankdetailsresource.jsp",
              fromFunction: "funSave",
            },
          ],
        },
      },
    ],
  };

  const scrapeTargets = {
    "verification/mobile-no-verification": [
      { dropdown: "Verification", subitem: "Mobile No Verification" },
    ],
    "finance/bank-details": [{ dropdown: "Finance", subitem: "Bank Account Details" }],
  };

  return new ErpUiMapStore({
    uiMapFile: makeUiMapFile(uiMap),
    scrapeTargets,
  });
}

test("indexes sections by pageKey using scrape targets", () => {
  const store = makeStore();
  const hints = store.getUiHints("verification/mobile-no-verification");

  assert.equal(hints.success, true);
  assert.equal(hints.sections.length, 1);
  assert.equal(hints.sections[0].dropdown, "Verification");
  assert.equal(hints.sections[0].forms.length, 1);
  assert.equal(hints.sections[0].actions.length, 1);
  assert.equal(hints.capabilities.executableActionCount, 1);
});

test("marks bank save mutation as blocked in wave 1", () => {
  const store = makeStore();
  const hints = store.getUiHints("finance/bank-details");

  assert.equal(hints.sections.length, 1);
  assert.equal(hints.sections[0].actions.length, 1);

  const action = hints.sections[0].actions[0];
  assert.equal(action.kind, "mutation");
  assert.equal(action.enabled, false);
  assert.match(String(action.disabledReason || ""), /bank save/i);
});

test("resolves action by pageKey and actionId", () => {
  const store = makeStore();
  const hints = store.getUiHints("verification/mobile-no-verification");
  const actionId = hints.sections[0].actions[0].id;

  const actionRef = store.getAction("verification/mobile-no-verification", actionId);
  assert.ok(actionRef);
  assert.equal(actionRef.pageKey, "verification/mobile-no-verification");
  assert.equal(actionRef.action.id, actionId);
});

test("builds schema blocks for mapped page sections", () => {
  const store = makeStore();
  const schema = store.getRenderSchema("verification/mobile-no-verification");

  assert.equal(schema.success, true);
  assert.equal(schema.pageKey, "verification/mobile-no-verification");
  assert.ok(Array.isArray(schema.blocks));
  assert.ok(schema.blocks.length >= 4);
  assert.equal(schema.capabilities.statsBlockCount, 1);
  assert.equal(schema.capabilities.cardBlockCount, 1);
  assert.equal(schema.capabilities.formBlockCount, 1);
  assert.equal(schema.capabilities.tableBlockCount, 1);
  assert.equal(schema.capabilities.listBlockCount, 1);

  const formBlock = schema.blocks.find((block) => block.type === "form");
  assert.ok(formBlock);
  assert.equal(formBlock.sourcePageKey, "verification/mobile-no-verification");
  assert.equal(formBlock.section?.dropdown, "Verification");
  assert.equal(formBlock.section?.subitem, "Mobile No Verification");
});

test("returns stats-only schema for unmapped page key with warnings", () => {
  const store = makeStore();
  const schema = store.getRenderSchema("nonexistent/page");

  assert.equal(schema.success, true);
  assert.equal(schema.capabilities.statsBlockCount, 1);
  assert.equal(schema.capabilities.cardBlockCount, 0);
  assert.equal(schema.capabilities.tableBlockCount, 0);
  assert.ok(Array.isArray(schema.warnings));
  assert.ok(schema.warnings.some((warning) => /no schema sections generated/i.test(String(warning))));
});
