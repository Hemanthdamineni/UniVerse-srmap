const test = require("node:test");
const assert = require("node:assert/strict");

const { ErpAggregationService } = require("../src/services/erpAggregationService");
const { InMemoryErpCacheStore } = require("../src/services/erpCacheStore");

function makeService({ liveImpl, resolveMode = "cached-first", scrapeTargets } = {}) {
  const cacheStore = new InMemoryErpCacheStore();
  const targets =
    scrapeTargets ||
    {
      dashboard: [{ dropdown: "Academic", subitem: "Time Table" }],
      "academic/time-table": [{ dropdown: "Academic", subitem: "Time Table" }],
      profile: [],
    };

  const liveService = {
    scrapeByKey: liveImpl || (async (sessionId, pageKey) => ({ sessionId, pageKey, live: true })),
    scrapeTargets: targets,
  };

  const sessionStore = {
    async getOrThrow(sessionId) {
      if (!sessionId) {
        const error = new Error("Invalid or expired sessionId");
        error.status = 401;
        throw error;
      }
      return {
        loggedIn: true,
        profileData: {
          TableContent: {
            "Student Name": "Demo Student",
            "Register No.": "RA2026001",
            Semester: "6",
            "Program / Section": "B.Tech CSE / A",
          },
        },
      };
    },
  };

  const pagePolicyStore = {
    resolveMode: () => resolveMode,
  };

  const service = new ErpAggregationService({
    liveService,
    cacheStore,
    pagePolicyStore,
    sessionStore,
  });

  return {
    service,
    cacheStore,
  };
}

test("returns live response then cache-fresh on subsequent request", async () => {
  let liveCalls = 0;

  const { service } = makeService({
    liveImpl: async () => {
      liveCalls += 1;
      return {
        Academic: {
          "Time Table": {
            title: "Time Table",
            text: "Class schedule",
            tables: [[{ Day: "Monday", Slot: "08:00 - 08:50" }]],
          },
        },
      };
    },
  });

  const first = await service.getPage({
    pageKey: "academic/time-table",
    sessionId: "s-1",
  });

  const second = await service.getPage({
    pageKey: "academic/time-table",
    sessionId: "s-1",
  });

  assert.equal(first.source, "live");
  assert.equal(second.source, "cache-fresh");
  assert.equal(liveCalls, 1);
});

test("adds fee-paid source row counts to ERP response metadata", async () => {
  const { service } = makeService({
    scrapeTargets: {
      "finance/payment-acknowledgment": [
        { dropdown: "Finance", subitem: "Payment Acknowledgment" },
      ],
      profile: [],
    },
    liveImpl: async () => ({
      Finance: {
        "Payment Acknowledgment": {
          title: "Payment Acknowledgment",
          tables: [[{ "Receipt No.": "R-1", Amount: "500" }]],
        },
      },
    }),
  });

  const result = await service.getPage({
    pageKey: "finance/payment-acknowledgment",
    sessionId: "s-1",
  });

  assert.equal(result.meta.financePaidIntegrity.rawRowCount, 1);
  assert.deepEqual(result.meta.financePaidIntegrity.sources[0], {
    pageKey: "finance/payment-acknowledgment",
    label: "Payment Acknowledgment",
    dropdown: "Finance",
    subitem: "Payment Acknowledgment",
    status: "loaded",
    tableCount: 1,
    rowCount: 1,
    warnings: [],
  });
});

test("accepts meaningful text-only payloads for timetable pages", async () => {
  const { service } = makeService({
    liveImpl: async () => ({
      Academic: {
        "Time Table": {
          title: "Time Table",
          text: "Classes will be announced shortly. Please check back after the timetable office publishes the updated schedule.",
          tables: [],
        },
      },
    }),
  });

  const result = await service.getPage({
    pageKey: "academic/time-table",
    sessionId: "s-1",
  });

  assert.equal(result.source, "live");
  assert.equal(result.data.Academic["Time Table"].tables.length, 0);
});

test("accepts meaningful text-only payloads for attendance sections when mapped targets exist", async () => {
  const { service } = makeService({
    scrapeTargets: {
      "academic/attendance-details": [
        { dropdown: "Academic", subitem: "Attendance Details" },
        { dropdown: "Academic", subitem: "OD/ML Details" },
      ],
      profile: [],
    },
    liveImpl: async () => ({
      Academic: {
        "Attendance Details": {
          title: "Attendance Details",
          text: "Attendance for the current term is being recalculated and will be available once faculty verification is complete.",
          tables: [],
        },
        "OD/ML Details": {
          title: "OD/ML Details",
          text: "No OD or ML requests are pending approval for the selected semester.",
          tables: [],
        },
      },
    }),
  });

  const result = await service.getPage({
    pageKey: "academic/attendance-details",
    sessionId: "s-1",
  });

  assert.equal(result.source, "live");
  assert.equal(result.data.Academic["Attendance Details"].tables.length, 0);
  assert.equal(result.data.Academic["OD/ML Details"].tables.length, 0);
});

test("accepts structured form-only payloads for student-attendance pages", async () => {
  const { service } = makeService({
    scrapeTargets: {
      "academic/student-attendance": [{ dropdown: "Academic", subitem: "Student Attendance" }],
      profile: [],
    },
    liveImpl: async () => ({
      Academic: {
        "Student Attendance": {
          title: "Student AttendanceNew",
          text: "Use the form below to submit attendance.",
          tables: [],
          document: {
            title: "Student AttendanceNew",
            root: {
              id: "root",
              type: "container",
              props: { variant: "section" },
              children: [
                {
                  id: "erp-1",
                  type: "text",
                  props: { text: "Student AttendanceNew" },
                  children: [],
                },
                {
                  id: "erp-2",
                  type: "form",
                  props: { title: "Attendance Form" },
                  children: [
                    {
                      id: "erp-3",
                      type: "field",
                      props: {
                        name: "acode",
                        label: "Attendance Code",
                        inputType: "text",
                        value: "",
                        required: true,
                      },
                      children: [],
                    },
                    {
                      id: "erp-4",
                      type: "button",
                      props: {
                        label: "Submit",
                        inputType: "submit",
                        action: {
                          type: "submit_form",
                          target: "students/transaction/studentattendanceresources.jsp",
                          method: "POST",
                          onSuccess: "reload_page",
                        },
                      },
                      children: [],
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    }),
  });

  const result = await service.getPage({
    pageKey: "academic/student-attendance",
    sessionId: "s-1",
  });

  assert.equal(result.source, "live");
  assert.equal(result.data.Academic["Student Attendance"].tables.length, 0);
  assert.equal(result.data.Academic["Student Attendance"].document.root.children.length, 2);
});

test("accepts document-structured sap attachment payloads without tables", async () => {
  const { service } = makeService({
    scrapeTargets: {
      "sap/attachments": [{ dropdown: "SAP", subitem: "Attachments" }],
      profile: [],
    },
    liveImpl: async () => ({
      SAP: {
        Attachments: {
          title: "Attachments",
          text: "Upload your SAP documents using the form below.",
          tables: [],
          document: {
            title: "Attachments",
            root: {
              id: "root",
              type: "container",
              props: { variant: "section" },
              children: [
                {
                  id: "erp-1",
                  type: "text",
                  props: { text: "Upload your SAP documents using the form below." },
                  children: [],
                },
                {
                  id: "erp-2",
                  type: "container",
                  props: { variant: "group" },
                  children: [
                    {
                      id: "erp-3",
                      type: "text",
                      props: { text: "No attachments submitted yet." },
                      children: [],
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    }),
  });

  const result = await service.getPage({
    pageKey: "sap/attachments",
    sessionId: "s-1",
  });

  assert.equal(result.source, "live");
  assert.equal(result.data.SAP.Attachments.tables.length, 0);
  assert.equal(result.data.SAP.Attachments.document.root.children.length, 2);
});

test("fails closed for cached-first when live fails", async () => {
  const { service } = makeService({
    liveImpl: async () => {
      throw new Error("live down");
    },
  });

  await assert.rejects(
    () =>
      service.getPage({
        pageKey: "dashboard",
        sessionId: "s-1",
      }),
    /live down/i
  );
});

test("propagates session expiry as unauthorized", async () => {
  const { service } = makeService({
    liveImpl: async () => {
      const error = new Error("ERP session expired. Please sign in again.");
      error.status = 401;
      error.code = "SESSION_EXPIRED";
      throw error;
    },
  });

  await assert.rejects(
    () =>
      service.getPage({
        pageKey: "dashboard",
        sessionId: "s-1",
      }),
    (error) => {
      assert.equal(error.code, "SESSION_EXPIRED");
      assert.equal(error.status, 401);
      return true;
    }
  );
});

test("serves cache-stale without session and keeps request successful", async () => {
  const { service, cacheStore } = makeService({
    liveImpl: async () => {
      throw new Error("should not be called");
    },
  });

  const key = service.cacheKeyFor("anonymous", "dashboard");
  await cacheStore.set(
    key,
    {
      pageKey: "dashboard",
      data: {
        Academic: {
          "Time Table": {
            title: "Time Table",
            text: "Cached timetable",
            tables: [[{ Day: "Tuesday", Slot: "09:00 - 09:50" }]],
          },
        },
      },
      fetchedAt: new Date(Date.now() - 120_000).toISOString(),
      staleAt: Date.now() - 10_000,
      expiresAt: Date.now() + 120_000,
    },
    120_000
  );

  const result = await service.getPage({
    pageKey: "dashboard",
    sessionId: "",
  });

  assert.equal(result.source, "cache-stale");
  assert.equal(result.data.Academic["Time Table"].title, "Time Table");
});

test("fails closed when live payload is malformed for table page", async () => {
  const { service } = makeService({
    liveImpl: async () => ({
      Academic: {
        "Time Table": {
          title: "Time Table",
          text: "Welcome to SRM University. Login with your Application number and Date of Birth in DDMMYYYY format. $(function(){ ... }).fail(function(jqxhr,textstatus,errorthrown){})",
          tables: [],
        },
      },
    }),
  });

  await assert.rejects(async () => {
    await service.getPage({
      pageKey: "academic/time-table",
      sessionId: "s-1",
    });
  }, (error) => {
    assert.equal(error.code, "INVALID_UPSTREAM_PAYLOAD");
    assert.equal(error.status, 502);
    return true;
  });
});

test("drops malformed cached payload and fails closed without session", async () => {
  const { service, cacheStore } = makeService({
    liveImpl: async () => {
      throw new Error("should not be called");
    },
  });

  const key = service.cacheKeyFor("anonymous", "academic/time-table");
  await cacheStore.set(
    key,
    {
      pageKey: "academic/time-table",
      data: {
        Academic: {
          "Time Table": {
            title: "Time Table",
            text: "Welcome to SRM University, login with your Application number in DDMMYYYY format",
            tables: [],
          },
        },
      },
      fetchedAt: new Date().toISOString(),
      staleAt: Date.now() + 120_000,
      expiresAt: Date.now() + 300_000,
    },
    300_000
  );

  await assert.rejects(async () => {
    await service.getPage({
      pageKey: "academic/time-table",
      sessionId: "",
    });
  }, (error) => {
    assert.equal(error.code, "UNAUTHORIZED");
    assert.equal(error.status, 401);
    return true;
  });
});

test("fails closed when profile payload is invalid", async () => {
  const { service } = makeService({
    liveImpl: async () => ({
      Academic: {
        Profile: {
          title: "PROFILE",
          text: "Welcome to SRM University, login with your Application number",
          tables: [],
        },
      },
    }),
  });

  await assert.rejects(async () => {
    await service.getPage({
      pageKey: "profile",
      sessionId: "s-1",
    });
  }, (error) => {
    assert.equal(error.code, "INVALID_UPSTREAM_PAYLOAD");
    assert.equal(error.status, 502);
    return true;
  });
});
