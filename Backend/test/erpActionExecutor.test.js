const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { ErpUiMapStore } = require("../src/services/erp/erpUiMapStore");
const { ErpActionExecutor } = require("../src/services/erp/erpActionExecutor");

function makeUiMapFile(payload) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "erp-action-exec-"));
  const file = path.join(dir, "erp-ui-map.json");
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

function makeStoreAndExecutor() {
  const uiMap = {
    pages: [
      {
        key: "Verification::Mobile No Verification",
        dropdown: "Verification",
        subitem: "Mobile No Verification",
        ui: {
          forms: [{ id: "frmMobileNoVerify_222", fields: [{ id: "optmobilenumber", type: "text" }] }],
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
          forms: [{ id: "frmPalack", fields: [] }],
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
      {
        key: "Academic::Student Attendance",
        dropdown: "Academic",
        subitem: "Student Attendance",
        ui: {
          forms: [],
          controls: [
            {
              label: "Submit",
              inferredAction: {
                kind: "function-call",
                functionName: "funMakeConfirm",
                args: [],
              },
            },
          ],
        },
        integration: {
          mutations: [
            {
              method: "POST",
              url: "students/transaction/studentattendanceresources.jsp",
              fromFunction: "funMakeConfirm",
            },
          ],
        },
      },
      {
        key: "Finance::Payment Acknowledgment",
        dropdown: "Finance",
        subitem: "Payment Acknowledgment",
        ui: {
          forms: [{ id: "frmpaymentstatus", fields: [{ id: "txnid", type: "hidden", value: "0" }] }],
          controls: [
            {
              label: "Print",
              inferredAction: {
                kind: "function-call",
                functionName: "funPrint",
                args: [987654],
              },
            },
          ],
        },
        integration: {
          mutations: [
            {
              method: "POST",
              url: "students/transaction/studentsonlinepaymentresponse.jsp",
              fromFunction: "redirectResponse",
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
    "academic/student-attendance": [{ dropdown: "Academic", subitem: "Student Attendance" }],
    "finance/payment-acknowledgment": [{ dropdown: "Finance", subitem: "Payment Acknowledgment" }],
  };

  const uiMapStore = new ErpUiMapStore({
    uiMapFile: makeUiMapFile(uiMap),
    scrapeTargets,
  });

  const apiCalls = [];
  const sessionStore = {
    async getOrThrow(sessionId) {
      if (!sessionId) {
        const error = new Error("Invalid session");
        error.status = 401;
        throw error;
      }
      return { storageState: { cookies: [] } };
    },
    async update() {
      return undefined;
    },
  };

  const apiContextFactory = async () => ({
    async post(url, options) {
      apiCalls.push({ method: "POST", url, options });
      if (url === "students/transaction/studentsonlinepaymentresponse.jsp") {
        return {
          ok: () => true,
          status: () => 200,
          text: async () => "<html><body><h1>University Receipt</h1><div>Txn</div></body></html>",
          headers: () => ({ "content-type": "text/html; charset=UTF-8" }),
        };
      }
      if (url === "students/transaction/studentattendanceresources.jsp") {
        return {
          ok: () => true,
          status: () => 200,
          text: async () => "{\"resultstatus\":1,\"result\":\"Attendance marked successfully\"}",
          headers: () => ({ "content-type": "application/json; charset=UTF-8" }),
        };
      }
      return {
        ok: () => true,
        status: () => 200,
        text: async () => "OTP sent successfully",
      };
    },
    async get(url, options) {
      apiCalls.push({ method: "GET", url, options });
      return {
        ok: () => true,
        status: () => 200,
        text: async () => "OK",
      };
    },
    async storageState() {
      return { cookies: [] };
    },
    async dispose() {
      return undefined;
    },
  });

  const executor = new ErpActionExecutor({
    uiMapStore,
    sessionStore,
    apiContextFactory,
  });

  return { uiMapStore, executor, apiCalls };
}

test("requires sessionId", async () => {
  const { executor, uiMapStore } = makeStoreAndExecutor();
  const actionId = uiMapStore.getUiHints("verification/mobile-no-verification").sections[0].actions[0].id;

  await assert.rejects(
    () =>
      executor.execute({
        pageKey: "verification/mobile-no-verification",
        actionId,
        payload: {},
        sessionId: "",
      }),
    (error) => error && error.status === 401 && error.code === "UNAUTHORIZED"
  );
});

test("fails with service unavailable when UI mapping is not configured", async () => {
  const executor = new ErpActionExecutor({
    uiMapStore: {
      getHealth: () => ({ loaded: false }),
      getAction: () => null,
    },
    sessionStore: {
      async getOrThrow() {
        throw new Error("should not be called");
      },
    },
    apiContextFactory: async () => ({
      async dispose() {
        return undefined;
      },
    }),
  });

  await assert.rejects(
    () =>
      executor.execute({
        pageKey: "verification/mobile-no-verification",
        actionId: "act-demo-1",
        payload: {},
        sessionId: "s-1",
      }),
    (error) => {
      assert.equal(error.code, "UI_MAP_UNAVAILABLE");
      assert.equal(error.status, 503);
      return true;
    }
  );
});

test("rejects unknown action", async () => {
  const { executor } = makeStoreAndExecutor();

  await assert.rejects(
    () =>
      executor.execute({
        pageKey: "verification/mobile-no-verification",
        actionId: "missing-action",
        payload: {},
        sessionId: "s-1",
      }),
    (error) => error && error.status === 404 && error.code === "NOT_FOUND"
  );
});

test("rejects method/url mismatch", async () => {
  const { executor, uiMapStore } = makeStoreAndExecutor();
  const actionId = uiMapStore.getUiHints("verification/mobile-no-verification").sections[0].actions[0].id;

  await assert.rejects(
    () =>
      executor.execute({
        pageKey: "verification/mobile-no-verification",
        actionId,
        payload: { optmobilenumber: "9999999999" },
        sessionId: "s-1",
        expectedMethod: "GET",
      }),
    (error) => error && error.status === 400
  );

  await assert.rejects(
    () =>
      executor.execute({
        pageKey: "verification/mobile-no-verification",
        actionId,
        payload: { optmobilenumber: "9999999999" },
        sessionId: "s-1",
        expectedUrl: "students/transaction/other.jsp",
      }),
    (error) => error && error.status === 400
  );
});

test("blocks disabled actions by policy", async () => {
  const { executor, uiMapStore } = makeStoreAndExecutor();
  const actionId = uiMapStore.getUiHints("finance/bank-details").sections[0].actions[0].id;

  await assert.rejects(
    () =>
      executor.execute({
        pageKey: "finance/bank-details",
        actionId,
        payload: {},
        sessionId: "s-1",
      }),
    (error) => error && error.status === 403 && error.code === "FORBIDDEN"
  );
});

test("executes allowlisted mobile otp action", async () => {
  const { executor, uiMapStore, apiCalls } = makeStoreAndExecutor();
  const actionId = uiMapStore.getUiHints("verification/mobile-no-verification").sections[0].actions[0].id;

  const result = await executor.execute({
    pageKey: "verification/mobile-no-verification",
    actionId,
    payload: { optmobilenumber: "9492891632" },
    sessionId: "s-1",
  });

  assert.equal(result.status, 200);
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].method, "POST");
  assert.equal(apiCalls[0].url, "students/transaction/mobilenumberverificationotp.jsp");
  assert.equal(apiCalls[0].options.form.ids, "1");
  assert.equal(apiCalls[0].options.form.optmobilenumber, "9492891632");
});

test("executes attendance code submission action", async () => {
  const { executor, uiMapStore, apiCalls } = makeStoreAndExecutor();
  const actionId = uiMapStore.getUiHints("academic/student-attendance").sections[0].actions[0].id;

  const result = await executor.execute({
    pageKey: "academic/student-attendance",
    actionId,
    payload: { acode: "ABC1234" },
    sessionId: "s-1",
  });

  assert.equal(result.success, true);
  assert.equal(result.status, 200);
  assert.equal(result.url, "students/transaction/studentattendanceresources.jsp");
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].options.form.acode, "ABC1234");
});

test("executes receipt print action and returns printable html", async () => {
  const { executor, uiMapStore, apiCalls } = makeStoreAndExecutor();
  const actionId = uiMapStore.getUiHints("finance/payment-acknowledgment").sections[0].actions[0].id;

  const result = await executor.execute({
    pageKey: "finance/payment-acknowledgment",
    actionId,
    payload: {},
    sessionId: "s-1",
  });

  assert.equal(result.success, true);
  assert.equal(result.printReady, true);
  assert.match(String(result.html || ""), /University Receipt/i);
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0].url, "students/transaction/studentsonlinepaymentresponse.jsp");
  assert.equal(apiCalls[0].options.form.txnid, "987654");
});
