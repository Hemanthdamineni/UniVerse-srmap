function normalizePageKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

const TABLE_REQUIRED_PAGE_KEYS = [
  "dashboard",
  "academic/time-table",
  "academic/timetable",
  "academic/attendance-details",
  "academic/od-ml-details",
  "academic/student-wise-subjects",
  "examination/current-semester-results",
  "examination/earlier-internal-marks",
  "examination/exam-mark-details",
  "examination/internal-mark-details",
  "finance/fee-due-details",
  "finance/fee-dues",
  "finance/fee-paid-details",
  "finance/payment-acknowledgment",
  "finance/online-payment-verification",
  "finance/fee-paid",
  "finance/bank-account-details",
  "hostel/room-details",
  "transport-hostel/room-details",
];

const MEANINGFUL_TEXT_FALLBACK_PAGE_KEYS = [
  "dashboard",
  "academic/time-table",
  "academic/timetable",
  "academic/attendance-details",
  "academic/od-ml-details",
  "academic/student-attendance",
  "sap/attachments",
  "sap/details",
  "sap/feedback",
];

const defaultContract = Object.freeze({
  kind: "default",
  requireTargetSections: true,
  requireExtractedPayload: false,
  rejectSuspiciousText: true,
  minTableCount: 0,
  allowMeaningfulTextFallback: false,
});

const contractOverrides = {
  profile: {
    kind: "profile",
    requireTargetSections: false,
    requireExtractedPayload: false,
    rejectSuspiciousText: true,
    minTableCount: 0,
    allowMeaningfulTextFallback: false,
  },
  dashboard: {
    sectionRules: [
      { dropdown: "Academic", subitem: "Time Table", minTableCount: 1 },
      { dropdown: "Academic", subitem: "Attendance Details", minTableCount: 1, requiredHeadersAny: ["Subject Code"] },
      { dropdown: "Examination", subitem: "Internal Mark Details", minTableCount: 1, requiredHeadersAny: ["Subject Code", "Marks Obtained"] },
    ],
  },
  "academic/time-table": {
    sectionRules: [
      {
        dropdown: "Academic",
        subitem: "Time Table",
        minTableCount: 2,
        requiredHeadersAny: ["Subject Code", "Subject Description", "Faculty Name"],
      },
    ],
  },
  "academic/timetable": {
    sectionRules: [
      {
        dropdown: "Academic",
        subitem: "Time Table",
        minTableCount: 2,
        requiredHeadersAny: ["Subject Code", "Subject Description", "Faculty Name"],
      },
    ],
  },
  "academic/attendance-details": {
    sectionRules: [
      { dropdown: "Academic", subitem: "Attendance Details", minTableCount: 1, requiredHeadersAny: ["Subject Code", "Attendance %"] },
      { dropdown: "Academic", subitem: "OD/ML Details", minTableCount: 0 },
    ],
  },
  "examination/internal-mark-details": {
    sectionRules: [
      { dropdown: "Examination", subitem: "Internal Mark Details", minTableCount: 1, requiredHeadersAny: ["Subject Code", "Marks Obtained"] },
    ],
  },
  "examination/current-semester-results": {
    sectionRules: [
      { dropdown: "Examination", subitem: "Current Semester Results", minTableCount: 1, requiredHeadersAny: ["Subject Code", "Result", "Grade"] },
    ],
  },
  "finance/fee-dues": {
    sectionRules: [
      { dropdown: "Finance", subitem: "Fee Due Details", minTableCount: 1, requiredHeadersAny: ["Fee Category", "Fee Head", "Due Amount (INR)"] },
    ],
  },
  "finance/fee-due-details": {
    sectionRules: [
      { dropdown: "Finance", subitem: "Fee Due Details", minTableCount: 1, requiredHeadersAny: ["Fee Category", "Fee Head", "Due Amount (INR)"] },
    ],
  },
  "finance/fee-paid": {
    sectionRules: [
      { dropdown: "Finance", subitem: "Fee Paid Details", minTableCount: 1, requiredHeadersAny: ["Receipt No.", "Amount (Paid)", "Amount"] },
    ],
  },
  "finance/fee-paid-details": {
    sectionRules: [
      { dropdown: "Finance", subitem: "Fee Paid Details", minTableCount: 1, requiredHeadersAny: ["Receipt No.", "Amount (Paid)", "Amount"] },
    ],
  },
};

for (const pageKey of TABLE_REQUIRED_PAGE_KEYS) {
  contractOverrides[pageKey] = {
    kind: "default",
    requireTargetSections: true,
    requireExtractedPayload: true,
    rejectSuspiciousText: true,
    minTableCount: 1,
  };
}

for (const pageKey of MEANINGFUL_TEXT_FALLBACK_PAGE_KEYS) {
  contractOverrides[pageKey] = {
    ...(contractOverrides[pageKey] || {}),
    allowMeaningfulTextFallback: true,
  };
}

function getPayloadContract(pageKey) {
  const key = normalizePageKey(pageKey);
  const override = contractOverrides[key] || {};

  return {
    ...defaultContract,
    ...override,
  };
}

module.exports = {
  getPayloadContract,
  normalizePageKey,
};
