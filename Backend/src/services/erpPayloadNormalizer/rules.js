const {
  cleanText,
  cloneJson,
  rowLooksLikeHeaderDup,
  getColKeys,
  remapRowsWithNewHeaders,
  uniquifyHeaders,
} = require("./tableUtils");

function isKnownBadTimetableSubjectsTable(headers) {
  const headerSig = headers.map((header) => cleanText(header));
  const trailingHeaders = headerSig.slice(4);
  return (
    headerSig.length >= 4 &&
    headerSig[0] === "Subjects Description" &&
    headerSig[1] === "L-T-P-C" &&
    headerSig[2] === "Faculty Name" &&
    headerSig[3] === "Class Room Name" &&
    trailingHeaders.every((header) => /^col\d+$/i.test(header))
  );
}

function applyDuplicateHeaderRowRule(table) {
  if (!Array.isArray(table?.sampleRows) || table.sampleRows.length === 0) return null;
  if (!rowLooksLikeHeaderDup(table.headers, table.sampleRows[0])) return null;

  return {
    table: {
      ...table,
      sampleRows: table.sampleRows.slice(1),
      issues: [...(table.issues || []), "Removed duplicated header row from sampleRows."],
    },
    appliedRule: "remove_duplicated_header_row",
    issue: "Removed duplicated header row from sample rows.",
  };
}

function applyTimetableSubjectsRule(table) {
  if (!isKnownBadTimetableSubjectsTable(table?.headers || [])) return null;

  const baseHeaders = table.headers || [];
  const cleanedRows = Array.isArray(table.sampleRows) ? [...table.sampleRows] : [];
  const looksLikeShiftedHeaderEcho =
    cleanedRows.length > 0 &&
    cleanText(cleanedRows[0]?.[baseHeaders[0]]) === "Subjects Description" &&
    cleanText(cleanedRows[0]?.[baseHeaders[1]]) === "L-T-P-C" &&
    cleanText(cleanedRows[0]?.[baseHeaders[2]]) === "Faculty Name" &&
    cleanText(cleanedRows[0]?.[baseHeaders[3]]) === "Class Room Name";

  if (cleanedRows.length && (rowLooksLikeHeaderDup(baseHeaders, cleanedRows[0]) || looksLikeShiftedHeaderEcho)) {
    cleanedRows.shift();
  }

  const nextRows = [];
  for (const row of cleanedRows) {
    nextRows.push({
      "Subject Code": row?.["Subjects Description"] ?? "",
      "Subject Description": row?.["L-T-P-C"] ?? "",
      "L-T-P-C": row?.["Faculty Name"] ?? "",
      "Faculty Name": row?.["Class Room Name"] ?? "",
      "Class Room Name": row?.col5 ?? "",
    });
  }

  return {
    table: {
      ...table,
      headers: [
        "Subject Code",
        "Subject Description",
        "L-T-P-C",
        "Faculty Name",
        "Class Room Name",
      ],
      kind: "records",
      extraKeys: [],
      sampleRows: nextRows,
      issues: [
        ...(table.issues || []),
        "Fixed shifted timetable subject headers and restored classroom data from trailing col5.",
      ],
    },
    appliedRule: "normalize_timetable_subject_headers",
    issue: "Normalized shifted timetable subject headers.",
  };
}

function applyFeePaidGroupHeaderRule(table) {
  const headerSig = (table?.headers || []).map((header) => cleanText(header));
  const isKnownBad =
    headerSig.length === 3 &&
    headerSig[0] === "Fixed/Advances" &&
    headerSig[1] === "Receipts/Payments" &&
    headerSig[2] === "Due";

  if (!isKnownBad) return null;

  const baseHeaders = table.headers || [];
  const rows = Array.isArray(table.sampleRows) ? [...table.sampleRows] : [];
  if (rows.length && rowLooksLikeHeaderDup(baseHeaders, rows[0])) {
    rows.shift();
  }

  const headerRow = rows[0];
  if (!headerRow) return null;

  const colKeys = getColKeys(headerRow);
  if (!colKeys.length) return null;

  let newHeaders = [
    headerRow[baseHeaders[0]] ?? baseHeaders[0],
    headerRow[baseHeaders[1]] ?? baseHeaders[1],
    headerRow[baseHeaders[2]] ?? baseHeaders[2],
    ...colKeys.map((key) => headerRow[key] ?? key),
  ].map((header) => cleanText(header));

  const amountIndexes = [];
  for (let index = 0; index < newHeaders.length; index += 1) {
    if (newHeaders[index] === "Amount") amountIndexes.push(index);
  }

  if (amountIndexes.length >= 2) {
    newHeaders[amountIndexes[0]] = "Amount (Due)";
    newHeaders[amountIndexes[1]] = "Amount (Paid)";
  }

  newHeaders = uniquifyHeaders(newHeaders);
  rows.shift();

  return {
    table: {
      ...table,
      headers: newHeaders,
      kind: "records",
      extraKeys: [],
      sampleRows: remapRowsWithNewHeaders(rows, baseHeaders, newHeaders),
      issues: [
        ...(table.issues || []),
        "Promoted grouped fee-paid header row into canonical column headers.",
      ],
    },
    appliedRule: "promote_fee_paid_group_headers",
    issue: "Promoted grouped fee-paid header row.",
  };
}

function applyAttendanceSplitHeaderRule(table) {
  const headers = table?.headers || [];
  const headerSig = headers.map((header) => cleanText(header));
  const odIndex = headerSig.indexOf("OD/ML Taken");
  const presentPctIndex = headerSig.indexOf("Present % P / (P+A+OD)");
  if (odIndex === -1 || presentPctIndex !== odIndex + 1) return null;

  const rows = Array.isArray(table.sampleRows) ? [...table.sampleRows] : [];
  if (rows.length && rowLooksLikeHeaderDup(headers, rows[0])) {
    rows.shift();
  }

  const strayIndex = rows.findIndex((row) => {
    const values = Object.values(row || {}).map((value) => cleanText(value));
    return values.includes("Present(P)") && values.includes("Absent(A)");
  });
  if (strayIndex !== -1) {
    rows.splice(strayIndex, 1);
  }

  const newHeaders = [...headers, "Present(P)", "Absent(A)"];
  const nextRows = [];

  for (const row of rows) {
    const next = {};
    for (const header of headers) next[header] = row?.[header] ?? "";

    const presentP = row?.["Present % P / (P+A+OD)"] ?? "";
    const presentPct = row?.["OD ML % approved"] ?? row?.["OD ML % Approved"] ?? "";
    const odMlPct = row?.["Attendance %"] ?? "";
    const attendancePct = row?.col9 ?? row?.col10 ?? row?.col11 ?? "";

    next["Present % P / (P+A+OD)"] = presentPct;
    next["OD ML % approved"] = odMlPct;
    next["Attendance %"] = attendancePct;
    next["Present(P)"] = presentP;
    next["Absent(A)"] = row?.col10 ?? "";

    nextRows.push(next);
  }

  return {
    table: {
      ...table,
      headers: newHeaders,
      kind: "records",
      extraKeys: [],
      sampleRows: nextRows,
      issues: [
        ...(table.issues || []),
        "Moved Present(P)/Absent(A) to canonical columns and repaired shifted attendance percentages.",
      ],
    },
    appliedRule: "repair_attendance_split_headers",
    issue: "Repaired shifted attendance percentage and count columns.",
  };
}

function applyTableRules(table, context) {
  let nextTable = cloneJson(table);
  const appliedRules = [];
  const issues = [];
  const ruleFns = [
    applyDuplicateHeaderRowRule,
    applyTimetableSubjectsRule,
    applyAttendanceSplitHeaderRule,
    applyFeePaidGroupHeaderRule,
  ];

  for (const ruleFn of ruleFns) {
    const result = ruleFn(nextTable, context);
    if (!result) continue;
    nextTable = result.table;
    appliedRules.push(result.appliedRule);
    issues.push(result.issue);
  }

  return {
    table: nextTable,
    appliedRules,
    issues,
  };
}

function removeInternalMarksNestedHeaderRows(table) {
  const rows = Array.isArray(table?.sampleRows) ? [...table.sampleRows] : [];
  const before = rows.length;

  const filtered = rows.filter((row) => {
    const serialized = JSON.stringify(row || {});
    const hasConducted = /Mark Secured\(Conducted\)/i.test(serialized);
    const hasConverted = /Mark Secured\(Converted\)/i.test(serialized);
    const hasMidSemester = /Mid Semester Exam/i.test(serialized);
    if (hasConducted && hasConverted && hasMidSemester) return false;

    const subjectCode = cleanText(row?.["Subject Code"]).toLowerCase();
    const subjectDescription = cleanText(row?.["Subject Description"]);
    const marksObtained = cleanText(row?.["Marks Obtained"]);
    if (
      subjectCode === "name" &&
      /mark secured\(conducted\)/i.test(subjectDescription) &&
      /mark secured\(converted\)/i.test(marksObtained)
    ) {
      return false;
    }

    return true;
  });

  if (filtered.length === before) return null;

  return {
    ...table,
    sampleRows: filtered,
    issues: [
      ...(table.issues || []),
      "Removed nested internal-mark sub-header row flattened into the parent table.",
    ],
  };
}

module.exports = {
  applyTableRules,
  removeInternalMarksNestedHeaderRows,
};
