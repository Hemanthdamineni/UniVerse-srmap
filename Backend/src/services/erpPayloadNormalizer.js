function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeSectionKey(dropdown, subitem) {
  return `${cleanText(dropdown)}::${cleanText(subitem)}`;
}

function tableHeadersFromRows(rows) {
  const headers = [];
  const seen = new Set();

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    for (const key of Object.keys(row)) {
      const normalized = String(key || "").trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      headers.push(normalized);
    }
  }

  return headers;
}

function rowLooksLikeHeaderDup(headers, row) {
  if (!Array.isArray(headers) || !headers.length) return false;
  if (!row || typeof row !== "object") return false;

  return headers.every((header) => {
    const value = row[header];
    if (value == null) return false;
    return cleanText(value).toLowerCase() === cleanText(header).toLowerCase();
  });
}

function getColKeys(row) {
  if (!row || typeof row !== "object") return [];

  return Object.keys(row)
    .filter((key) => /^col\d+$/i.test(key))
    .sort((left, right) => Number(left.slice(3)) - Number(right.slice(3)));
}

function projectRowValues(row, baseHeaders) {
  const values = [];
  for (const header of baseHeaders) values.push(row ? row[header] : undefined);

  const colKeys = getColKeys(row);
  for (const key of colKeys) values.push(row[key]);

  return { values, colKeys };
}

function remapRowsWithNewHeaders(sampleRows, baseHeaders, newHeaders) {
  const nextRows = [];
  for (const row of sampleRows) {
    const { values } = projectRowValues(row, baseHeaders);
    const next = {};
    for (let index = 0; index < newHeaders.length; index += 1) {
      next[newHeaders[index]] = values[index] ?? "";
    }
    nextRows.push(next);
  }
  return nextRows;
}

function uniquifyHeaders(headers) {
  const seen = new Map();

  return headers.map((header) => {
    const name = cleanText(header) || "(empty)";
    const count = seen.get(name) || 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    return `${name} (${count + 1})`;
  });
}

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

function runtimeTableToSummary(rows, index) {
  const sampleRows = cloneJson(Array.isArray(rows) ? rows : []);
  return {
    index,
    kind: "records",
    headers: tableHeadersFromRows(sampleRows),
    rowCount: sampleRows.length,
    extraKeys: [],
    sampleRows,
    issues: [],
  };
}

function summaryToRuntimeTable(table) {
  if (!Array.isArray(table?.sampleRows)) return [];

  return table.sampleRows.map((row) => {
    const next = {};
    const headers = Array.isArray(table.headers) ? table.headers : [];

    for (const header of headers) {
      next[header] = row?.[header] ?? "";
    }

    for (const key of Object.keys(row || {})) {
      if (Object.prototype.hasOwnProperty.call(next, key)) continue;
      next[key] = row[key];
    }

    return next;
  });
}

function stableHeaderFingerprint(headers) {
  const joined = Array.isArray(headers) ? headers.map((header) => cleanText(header)).join("|") : "";
  let hash = 2166136261;

  for (let index = 0; index < joined.length; index += 1) {
    hash ^= joined.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a-${(hash >>> 0).toString(16)}`;
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

function applyLeafRules(nextPayload, context, diagnostics) {
  if (!Array.isArray(nextPayload?.tables)) return nextPayload;

  const normalizedTables = nextPayload.tables.map((rows, index) => {
    const summary = runtimeTableToSummary(rows, index);
    const normalized = applyTableRules(summary, context);
    diagnostics.appliedRules.push(...normalized.appliedRules);
    diagnostics.issues.push(
      ...normalized.issues.map((issue) => ({
        sectionKey: context.sectionKey,
        tableIndex: index,
        message: issue,
      }))
    );

    let table = normalized.table;
    if (context.sectionKey === "Examination::Internal Mark Details" && index === 0) {
      const cleaned = removeInternalMarksNestedHeaderRows(table);
      if (cleaned) {
        table = cleaned;
        diagnostics.appliedRules.push("remove_internal_marks_nested_header");
        diagnostics.issues.push({
          sectionKey: context.sectionKey,
          tableIndex: index,
          message: "Removed nested internal-mark header row.",
        });
      }
    }

    diagnostics.tableFingerprints.push({
      sectionKey: context.sectionKey,
      tableIndex: index,
      fingerprint: stableHeaderFingerprint(table.headers),
      headers: table.headers,
    });

    return summaryToRuntimeTable(table);
  });

  const nextMeta = {
    ...(nextPayload.meta && typeof nextPayload.meta === "object" ? nextPayload.meta : {}),
    normalization: {
      appliedRules: Array.from(new Set(diagnostics.appliedRules)),
      issues: diagnostics.issues,
      tableFingerprints: diagnostics.tableFingerprints,
      sectionKey: context.sectionKey,
    },
  };

  return {
    ...nextPayload,
    tables: normalizedTables,
    meta: nextMeta,
  };
}

function normalizeRuntimePayload(payload, context = {}) {
  if (!payload || typeof payload !== "object") {
    return {
      payload,
      meta: {
        appliedRules: [],
        issues: [],
        tableFingerprints: [],
        sectionKey: normalizeSectionKey(context.dropdown, context.subitem),
      },
    };
  }

  const diagnostics = {
    appliedRules: [],
    issues: [],
    tableFingerprints: [],
  };
  const nextPayload = cloneJson(payload);
  const sectionKey = normalizeSectionKey(context.dropdown, context.subitem);
  const normalizedPayload = applyLeafRules(nextPayload, { ...context, sectionKey }, diagnostics);

  return {
    payload: normalizedPayload,
    meta: normalizedPayload?.meta?.normalization || {
      appliedRules: [],
      issues: [],
      tableFingerprints: [],
      sectionKey,
    },
  };
}

function normalizeArtifactItem(item) {
  if (!item || typeof item !== "object" || !item.data || !Array.isArray(item.data.tables)) {
    return item;
  }

  const diagnostics = {
    appliedRules: [],
    issues: [],
    tableFingerprints: [],
  };

  const nextTables = item.data.tables.map((table, index) => {
    // First, ensure we have a summary table object
    let summary;
    if (Array.isArray(table)) {
      // If it's a raw rows array, convert to summary
      summary = runtimeTableToSummary(table, index);
    } else if (isRecord(table) && "sampleRows" in table && Array.isArray(table.sampleRows)) {
      // If it's already a summary object, use it
      summary = cloneJson(table);
    } else {
      // Skip invalid tables
      return table;
    }

    const normalized = applyTableRules(summary, {
      sectionKey: String(item.key || ""),
      dropdown: item.dropdown,
      subitem: item.subitem,
    });

    diagnostics.appliedRules.push(...normalized.appliedRules);
    diagnostics.issues.push(
      ...normalized.issues.map((issue) => ({
        sectionKey: item.key,
        tableIndex: normalized.table.index,
        message: issue,
      }))
    );

    let nextTable = normalized.table;
    if (String(item.key || "") === "Examination::Internal Mark Details" && nextTable.index === 0) {
      const cleaned = removeInternalMarksNestedHeaderRows(nextTable);
      if (cleaned) {
        nextTable = cleaned;
        diagnostics.appliedRules.push("remove_internal_marks_nested_header");
        diagnostics.issues.push({
          sectionKey: item.key,
          tableIndex: nextTable.index,
          message: "Removed nested internal-mark header row.",
        });
      }
    }

    diagnostics.tableFingerprints.push({
      sectionKey: item.key,
      tableIndex: nextTable.index,
      fingerprint: stableHeaderFingerprint(nextTable.headers),
      headers: nextTable.headers,
    });

    // Convert summary table back to runtime rows array
    return summaryToRuntimeTable(nextTable);
  });

  return {
    ...item,
    data: {
      ...item.data,
      tables: nextTables,
      normalization: {
        appliedRules: Array.from(new Set(diagnostics.appliedRules)),
        issues: diagnostics.issues,
        tableFingerprints: diagnostics.tableFingerprints,
      },
    },
  };
}

function collectLeafNormalization(value, output) {
  if (!value || typeof value !== "object") return;

  const normalization = value?.meta?.normalization;
  if (normalization && typeof normalization === "object") {
    for (const rule of normalization.appliedRules || []) {
      output.appliedRules.add(String(rule));
    }
    for (const issue of normalization.issues || []) {
      output.issues.push(issue);
    }
    for (const tableFingerprint of normalization.tableFingerprints || []) {
      output.tableFingerprints.push(tableFingerprint);
    }
  }
}

function collectNormalizationMeta(payload, targets = []) {
  const output = {
    appliedRules: new Set(),
    issues: [],
    tableFingerprints: [],
  };

  if (targets.length) {
    for (const target of targets) {
      const dropdown = cleanText(target?.dropdown);
      const subitem = cleanText(target?.subitem) || dropdown;
      const leaf = payload?.[dropdown]?.[subitem];
      collectLeafNormalization(leaf, output);
    }
  } else {
    collectLeafNormalization(payload, output);
  }

  return {
    appliedRules: Array.from(output.appliedRules),
    issues: output.issues,
    tableFingerprints: output.tableFingerprints,
  };
}

module.exports = {
  normalizeRuntimePayload,
  normalizeArtifactItem,
  collectNormalizationMeta,
  stableHeaderFingerprint,
};
