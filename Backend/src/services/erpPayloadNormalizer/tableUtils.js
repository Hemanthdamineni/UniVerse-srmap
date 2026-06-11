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

module.exports = {
  isRecord,
  cleanText,
  cloneJson,
  normalizeSectionKey,
  rowLooksLikeHeaderDup,
  getColKeys,
  remapRowsWithNewHeaders,
  uniquifyHeaders,
  runtimeTableToSummary,
  summaryToRuntimeTable,
  stableHeaderFingerprint,
};
