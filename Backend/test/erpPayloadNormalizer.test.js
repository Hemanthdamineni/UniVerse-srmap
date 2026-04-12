const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeRuntimePayload,
  stableHeaderFingerprint,
} = require("../src/services/erpPayloadNormalizer");

test("normalizeRuntimePayload repairs shifted timetable subject headers", () => {
  const payload = {
    title: "TIME TABLE",
    tables: [
      [],
      [
        {
          "Subjects Description": "Subjects Description",
          "L-T-P-C": "L-T-P-C",
          "Faculty Name": "Faculty Name",
          "Class Room Name": "Class Room Name",
        },
        {
          "Subjects Description": "CSE 304",
          "L-T-P-C": "Operating Systems",
          "Faculty Name": "3-0-0-3",
          "Class Room Name": "Dr. Ada",
          col5: "LH-201",
        },
      ],
    ],
  };

  const result = normalizeRuntimePayload(payload, {
    dropdown: "Academic",
    subitem: "Time Table",
  });

  const row = result.payload.tables[1][0];
  assert.equal(row["Subject Code"], "CSE 304");
  assert.equal(row["Subject Description"], "Operating Systems");
  assert.equal(row["L-T-P-C"], "3-0-0-3");
  assert.equal(row["Faculty Name"], "Dr. Ada");
  assert.equal(row["Class Room Name"], "LH-201");
  assert.ok(result.meta.appliedRules.includes("normalize_timetable_subject_headers"));
});

test("normalizeRuntimePayload repairs shifted attendance split headers", () => {
  const payload = {
    title: "ATTENDANCE DETAILS",
    tables: [
      [
        {
          "Subject Code": "CSE 304",
          "Subject Description": "Operating Systems",
          ClassesConducted: "45",
          "Attendance Entered (Slots)": "42",
          "OD/ML Taken": "2",
          "Present % P / (P+A+OD)": "40",
          "OD ML % approved": "88.89",
          "Attendance %": "91.11",
          col9: "93.33",
          col10: "5",
        },
      ],
    ],
  };

  const result = normalizeRuntimePayload(payload, {
    dropdown: "Academic",
    subitem: "Attendance Details",
  });

  const row = result.payload.tables[0][0];
  assert.equal(row["Present(P)"], "40");
  assert.equal(row["Absent(A)"], "5");
  assert.equal(row["Present % P / (P+A+OD)"], "88.89");
  assert.equal(row["OD ML % approved"], "91.11");
  assert.equal(row["Attendance %"], "93.33");
  assert.ok(result.meta.appliedRules.includes("repair_attendance_split_headers"));
});

test("normalizeRuntimePayload removes nested internal marks header rows", () => {
  const payload = {
    title: "INTERNAL MARK DETAILS",
    tables: [
      [
        {
          "Subject Code": "Name",
          "Subject Description": "Mark Secured(Conducted)",
          "Marks Obtained": "Mark Secured(Converted)",
          "Max.Marks": "Mid Semester Exam",
        },
        {
          "Subject Code": "CSE 304",
          "Subject Description": "Operating Systems",
          "Marks Obtained": "48",
          "Max.Marks": "50",
        },
      ],
    ],
  };

  const result = normalizeRuntimePayload(payload, {
    dropdown: "Examination",
    subitem: "Internal Mark Details",
  });

  assert.equal(result.payload.tables[0].length, 1);
  assert.equal(result.payload.tables[0][0]["Subject Code"], "CSE 304");
  assert.ok(result.meta.appliedRules.includes("remove_internal_marks_nested_header"));
});

test("stableHeaderFingerprint is deterministic for equivalent headers", () => {
  const first = stableHeaderFingerprint(["Subject Code", "Subject Description", "Attendance %"]);
  const second = stableHeaderFingerprint(["Subject Code", "Subject Description", "Attendance %"]);

  assert.equal(first, second);
});
