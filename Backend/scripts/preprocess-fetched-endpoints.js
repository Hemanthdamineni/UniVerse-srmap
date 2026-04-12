#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { normalizeArtifactItem } = require("../src/services/erpPayloadNormalizer");

function safeJsonParse(text, fileLabel) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    throw new Error(`Failed to parse JSON (${fileLabel}): ${message}`);
  }
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeKey(dropdown, subitem) {
  const d = String(dropdown || "").trim();
  const s = String(subitem || "").trim();
  return `${d}::${s}`;
}

function isLikelyNumericHeaderTable(headers) {
  if (!Array.isArray(headers) || headers.length === 0) return false;
  const normalized = headers.map((h) => String(h || "").trim());
  const numeric = normalized.filter((h) => /^\d+$/.test(h));
  return numeric.length >= Math.max(3, Math.floor(normalized.length / 2));
}

function normalizeTable(table) {
  const headers = Array.isArray(table?.headers) ? table.headers : [];
  const rowCount =
    typeof table?.rowCount === "number" ? table.rowCount : undefined;
  const sampleRows = Array.isArray(table?.sampleRows) ? table.sampleRows : [];

  const extraKeys = new Set();
  for (const row of sampleRows) {
    if (!row || typeof row !== "object") continue;
    for (const key of Object.keys(row)) {
      if (!headers.includes(key)) extraKeys.add(key);
    }
  }

  const kind = isLikelyNumericHeaderTable(headers) ? "matrix" : "records";

  return {
    index: typeof table?.index === "number" ? table.index : undefined,
    kind,
    headers,
    rowCount,
    extraKeys: [...extraKeys].sort(),
    sampleRows,
  };
}

function normalizeParsed(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  const pageHeading = parsed.pageHeading ? String(parsed.pageHeading) : "";
  const textPreview = parsed.textPreview ? String(parsed.textPreview) : "";
  const tableCount =
    typeof parsed.tableCount === "number" ? parsed.tableCount : undefined;
  const tables = Array.isArray(parsed.tables) ? parsed.tables : [];

  return {
    pageHeading,
    textPreview,
    tableCount,
    tables: tables.map(normalizeTable),
  };
}

function rowLooksLikeHeaderDup(headers, row) {
  if (!Array.isArray(headers) || !headers.length) return false;
  if (!row || typeof row !== "object") return false;
  return headers.every((h) => {
    const v = row[h];
    if (v == null) return false;
    return String(v).trim().toLowerCase() === String(h).trim().toLowerCase();
  });
}

function getColKeys(row) {
  if (!row || typeof row !== "object") return [];
  return Object.keys(row)
    .filter((k) => /^col\d+$/i.test(k))
    .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
}

function projectRowValues(row, baseHeaders) {
  const values = [];
  for (const h of baseHeaders) values.push(row ? row[h] : undefined);
  const colKeys = getColKeys(row);
  for (const k of colKeys) values.push(row[k]);
  return { values, colKeys };
}

function remapRowsWithNewHeaders(sampleRows, baseHeaders, newHeaders) {
  const nextRows = [];
  for (const row of sampleRows) {
    const { values } = projectRowValues(row, baseHeaders);
    const next = {};
    for (let i = 0; i < newHeaders.length; i++) {
      next[newHeaders[i]] = values[i] ?? "";
    }
    nextRows.push(next);
  }
  return nextRows;
}

function uniquifyHeaders(headers) {
  const seen = new Map();
  return headers.map((h) => {
    const name = String(h || "").trim() || "(empty)";
    const count = seen.get(name) || 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    return `${name} (${count + 1})`;
  });
}

function fixTimeTableSubjectsTable(table) {
  // Table where subject code is stored in "Subjects Description" and remaining columns are shifted.
  const headers = table.headers || [];
  const headerSig = headers.map((h) => String(h || "").trim());
  const isKnownBad =
    headerSig.length === 4 &&
    headerSig[0] === "Subjects Description" &&
    headerSig[1] === "L-T-P-C" &&
    headerSig[2] === "Faculty Name" &&
    headerSig[3] === "Class Room Name";

  if (!isKnownBad) return table;

  const baseHeaders = headers;
  const newHeaders = [
    "Subject Code",
    "Subject Description",
    "L-T-P-C",
    "Faculty Name",
    "Class Room Name",
  ];

  const cleanedRows = Array.isArray(table.sampleRows) ? [...table.sampleRows] : [];
  if (cleanedRows.length && rowLooksLikeHeaderDup(baseHeaders, cleanedRows[0])) {
    cleanedRows.shift();
  }

  const nextRows = [];
  for (const row of cleanedRows) {
    const next = {
      "Subject Code": row?.["Subjects Description"] ?? "",
      "Subject Description": row?.["L-T-P-C"] ?? "",
      "L-T-P-C": row?.["Faculty Name"] ?? "",
      "Faculty Name": row?.["Class Room Name"] ?? "",
      "Class Room Name": row?.col5 ?? "",
    };
    nextRows.push(next);
  }

  const issues = Array.isArray(table.issues) ? table.issues : [];
  issues.push("Fixed shifted headers: inserted Subject Code; remapped classroom from col5.");

  return {
    ...table,
    headers: newHeaders,
    kind: "records",
    extraKeys: [],
    sampleRows: nextRows,
    issues,
  };
}

function fixFeePaidGroupHeaderTable(table) {
  const headers = table.headers || [];
  const headerSig = headers.map((h) => String(h || "").trim());
  const isKnownBad =
    headerSig.length === 3 &&
    headerSig[0] === "Fixed/Advances" &&
    headerSig[1] === "Receipts/Payments" &&
    headerSig[2] === "Due";
  if (!isKnownBad) return table;

  const baseHeaders = headers;
  const rows = Array.isArray(table.sampleRows) ? [...table.sampleRows] : [];
  if (rows.length && rowLooksLikeHeaderDup(baseHeaders, rows[0])) rows.shift();

  const headerRow = rows[0];
  if (!headerRow) return table;

  // Promote the first remaining row as header row if it exposes colN fields.
  const colKeys = getColKeys(headerRow);
  if (!colKeys.length) return table;

  let newHeaders = [
    headerRow[baseHeaders[0]] ?? baseHeaders[0],
    headerRow[baseHeaders[1]] ?? baseHeaders[1],
    headerRow[baseHeaders[2]] ?? baseHeaders[2],
    ...colKeys.map((k) => headerRow[k] ?? k),
  ].map((h) => String(h || "").trim());

  // Disambiguate duplicate "Amount" columns: first is due, second is paid.
  const amountIndexes = [];
  for (let i = 0; i < newHeaders.length; i++) {
    if (newHeaders[i] === "Amount") amountIndexes.push(i);
  }
  if (amountIndexes.length >= 2) {
    newHeaders[amountIndexes[0]] = "Amount (Due)";
    newHeaders[amountIndexes[1]] = "Amount (Paid)";
  }

  newHeaders = uniquifyHeaders(newHeaders);

  rows.shift(); // remove promoted header row
  const nextRows = remapRowsWithNewHeaders(rows, baseHeaders, newHeaders);

  const issues = Array.isArray(table.issues) ? table.issues : [];
  issues.push("Promoted second header row (group headers -> column headers).");

  return {
    ...table,
    headers: newHeaders,
    kind: "records",
    extraKeys: [],
    sampleRows: nextRows,
    issues,
  };
}

function fixAttendanceDetailsSplitHeader(table) {
  const headers = table.headers || [];
  const headerSig = headers.map((h) => String(h || "").trim());
  const odIndex = headerSig.indexOf("OD/ML Taken");
  const presentPctIndex = headerSig.indexOf("Present % P / (P+A+OD)");
  if (odIndex === -1 || presentPctIndex === -1) return table;
  if (presentPctIndex !== odIndex + 1) return table; // only handle the known “missing two columns” case

  const rows = Array.isArray(table.sampleRows) ? [...table.sampleRows] : [];
  if (rows.length && rowLooksLikeHeaderDup(headers, rows[0])) rows.shift();

  const strayIndex = rows.findIndex((r) => {
    const values = Object.values(r || {}).map((v) => String(v || "").trim());
    return values.includes("Present(P)") && values.includes("Absent(A)");
  });
  if (strayIndex !== -1) rows.splice(strayIndex, 1);

  // Desired order (per UI): ... OD/ML Taken -> Present % -> OD ML % approved -> Attendance % -> Present(P) -> Absent(A)
  // The scraped rows usually have an extra trailing col (e.g., col9) that we use for Attendance %.
  const newHeaders = [...headers, "Present(P)", "Absent(A)"];

  const nextRows = [];
  for (const row of rows) {
    const next = {};

    for (const h of headers) next[h] = row?.[h] ?? "";

    // The parser shifted these: Present(P) is currently under Present %, etc.
    const presentP = row?.["Present % P / (P+A+OD)"] ?? "";
    const presentPct = row?.["OD ML % approved"] ?? "";
    const odMlPct = row?.["Attendance %"] ?? "";
    const attendancePct =
      row?.col9 ?? row?.col10 ?? row?.col11 ?? "";

    next["Present % P / (P+A+OD)"] = presentPct;
    next["OD ML % approved"] = odMlPct;
    next["Attendance %"] = attendancePct;
    next["Present(P)"] = presentP;
    next["Absent(A)"] = row?.col10 ?? "";

    nextRows.push(next);
  }

  const issues = Array.isArray(table.issues) ? table.issues : [];
  issues.push(
    "Moved Present(P)/Absent(A) to end; removed stray sub-header row; remapped shifted percent/count values (uses trailing colN for Attendance % when present)."
  );

  return {
    ...table,
    headers: newHeaders,
    kind: "records",
    extraKeys: [],
    sampleRows: nextRows,
    issues,
  };
}

function removeInternalMarksNestedHeaderRow(item) {
  if (item.key !== "Examination::Internal Mark Details") return item;
  if (!item.data || !Array.isArray(item.data.tables) || !item.data.tables.length) return item;

  const nextTables = item.data.tables.map((t) => {
    if (t.index !== 0) return t;
    const rows = Array.isArray(t.sampleRows) ? [...t.sampleRows] : [];
    const before = rows.length;
    const filtered = rows.filter((r) => {
      const hay = JSON.stringify(r || {});
      const hasConducted = /Mark Secured\(Conducted\)/i.test(hay);
      const hasConverted = /Mark Secured\(Converted\)/i.test(hay);
      const hasMidSem = /Mid Semester Exam/i.test(hay);
      if (hasConducted && hasConverted && hasMidSem) return false;

      // Also drop the nested header row variant that only contains the 3 header labels.
      const subjCode = String(r?.["Subject Code"] || "").trim();
      const subjDesc = String(r?.["Subject Description"] || "").trim();
      const marksObtained = String(r?.["Marks Obtained"] || "").trim();
      if (
        subjCode.toLowerCase() === "name" &&
        /mark secured\(conducted\)/i.test(subjDesc) &&
        /mark secured\(converted\)/i.test(marksObtained)
      ) {
        return false;
      }

      return true;
    });
    if (filtered.length === before) return t;
    return {
      ...t,
      sampleRows: filtered,
      issues: [...(t.issues || []), "Removed nested sub-table header row that was flattened into a parent cell."],
    };
  });

  return { ...item, data: { ...item.data, tables: nextTables } };
}

function postProcessItem(item) {
  return normalizeArtifactItem(item);
}

function normalizeResult(result, baseDir) {
  const dropdown = String(result?.dropdown || "");
  const subitem = String(result?.subitem || "");
  const key = result?.key ? String(result.key) : normalizeKey(dropdown, subitem);

  const endpoint = result?.endpoint || {};
  const method = String(endpoint?.method || "").toUpperCase() || "GET";
  const url = String(endpoint?.url || "");
  const params =
    endpoint && typeof endpoint.params === "object" && endpoint.params
      ? endpoint.params
      : {};

  const rawFile = result?.rawFile ? String(result.rawFile) : "";
  const rawPath = rawFile ? path.resolve(baseDir, rawFile) : "";

  return {
    id: slugify(key) || slugify(`${dropdown}-${subitem}`) || String(result?.index || ""),
    key,
    dropdown,
    subitem,
    request: { method, url, params },
    response: {
      ok: Boolean(result?.ok),
      status: typeof result?.status === "number" ? result.status : null,
      contentType: String(result?.contentType || ""),
    },
    files: {
      rawFile: rawFile || null,
      rawPath: rawPath || null,
    },
    data: normalizeParsed(result?.parsed),
    error: result?.error ? String(result.error) : null,
  };
}

function groupByDropdown(items) {
  const grouped = {};
  for (const item of items) {
    const dropdown = item.dropdown || "Unknown";
    if (!grouped[dropdown]) grouped[dropdown] = {};
    const subitem = item.subitem || "(empty)";
    grouped[dropdown][subitem] = item;
  }
  return grouped;
}

function main() {
  const [, , inFileArg, outFileArg] = process.argv;
  const inFile =
    inFileArg ||
    path.join(__dirname, "../data/direct-api-output/fetched-endpoints.json");
  const outFile =
    outFileArg ||
    path.join(__dirname, "../data/direct-api-output/fetched-endpoints.typed.json");

  const absIn = path.resolve(inFile);
  const absOut = path.resolve(outFile);
  const baseDir = path.dirname(absIn);

  const rawText = fs.readFileSync(absIn, "utf8");
  const input = safeJsonParse(rawText, absIn);

  const results = Array.isArray(input?.results) ? input.results : [];
  const items = results.map((r) => postProcessItem(normalizeResult(r, baseDir)));

  const itemsByKey = {};
  for (const item of items) {
    itemsByKey[item.key] = item;
  }

  const typed = {
    schemaVersion: 1,
    source: {
      file: absIn,
      discoveryFile: input?.discoveryFile || null,
      requestBase: input?.requestBase || null,
      generatedAt: input?.generatedAt || null,
    },
    stats: {
      total: items.length,
      successCount:
        typeof input?.successCount === "number"
          ? input.successCount
          : items.filter((i) => i.response.ok).length,
      failureCount:
        typeof input?.failureCount === "number"
          ? input.failureCount
          : items.filter((i) => !i.response.ok).length,
    },
    items,
    itemsByKey,
    grouped: groupByDropdown(items),
  };

  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  fs.writeFileSync(absOut, JSON.stringify(typed, null, 2));
  process.stdout.write(`Wrote ${absOut}\n`);
}

main();
