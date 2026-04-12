#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

function ts() {
  return new Date().toISOString();
}

function log(message) {
  process.stdout.write(`[${ts()}] ${message}\n`);
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function unquote(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^['"]([\s\S]*)['"]$/);
  if (!match) return raw;
  return match[1]
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

function safeReadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    throw new Error(`Failed to parse JSON (${filePath}): ${msg}`);
  }
}

function safeWriteJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

function parseArgs(argv) {
  const out = {
    input: path.resolve(__dirname, "../data/direct-api-output/fetched-endpoints.typed.json"),
    output: path.resolve(__dirname, "../data/direct-api-output/erp-ui-map.json"),
    max: 0,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--in" || arg === "--input") {
      out.input = path.resolve(String(argv[i + 1] || ""));
      i += 1;
      continue;
    }
    if (arg === "--out" || arg === "--output") {
      out.output = path.resolve(String(argv[i + 1] || ""));
      i += 1;
      continue;
    }
    if (arg === "--max") {
      out.max = Number(argv[i + 1] || 0);
      i += 1;
      continue;
    }
  }

  return out;
}

function normalizeUrlCandidate(value) {
  const text = cleanText(value);
  if (!text) return "";
  return unquote(text);
}

function resolveRawHtmlPath({ item, typedFile, typedData }) {
  const candidates = [];

  if (item?.files?.rawPath) candidates.push(path.resolve(String(item.files.rawPath)));

  if (item?.files?.rawFile) {
    const rawFile = String(item.files.rawFile);
    candidates.push(path.resolve(path.dirname(typedFile), rawFile));
    candidates.push(path.resolve(__dirname, "../data/direct-api-output", rawFile));

    if (typedData?.source?.file) {
      candidates.push(path.resolve(path.dirname(String(typedData.source.file)), rawFile));
    }
  }

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath;
  }

  return null;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

function getElementRef($, element, index) {
  const node = $(element);
  const tag = String(element?.tagName || element?.name || "").toLowerCase();
  const id = cleanText(node.attr("id"));
  const name = cleanText(node.attr("name"));
  const className = cleanText(node.attr("class"));

  const parts = [tag || "node"];
  if (id) parts.push(`#${id}`);
  if (!id && className) {
    const classParts = className
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((value) => `.${value}`);
    parts.push(...classParts);
  }

  return {
    index,
    tag: tag || "node",
    id: id || undefined,
    name: name || undefined,
    className: className || undefined,
    selectorHint: parts.join(""),
  };
}

function extractHeadersFromTable($, table) {
  const headerCells = table.find("thead tr").last().find("th, td");
  const headers = [];

  if (headerCells.length > 0) {
    headerCells.each((_idx, cell) => headers.push(cleanText($(cell).text())));
    return headers;
  }

  const firstRow = table.find("tr").first();
  if (!firstRow.length) return headers;

  firstRow.find("th, td").each((_idx, cell) => headers.push(cleanText($(cell).text())));
  return headers;
}

function makeUniqueHeaders(headers) {
  const seen = new Map();
  return headers.map((header, idx) => {
    const base = cleanText(header) || `col${idx + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

function extractTableSampleRows($, table, headers) {
  const dataRows = table.find("tbody tr").length
    ? table.find("tbody tr")
    : table.find("tr").slice(1);

  const rows = [];

  dataRows.each((_rowIndex, rowEl) => {
    if (rows.length >= 3) return false;

    const cells = $(rowEl).find("td");
    if (!cells.length) return undefined;

    const row = {};
    cells.each((cellIndex, cellEl) => {
      const key = headers[cellIndex] || `col${cellIndex + 1}`;
      row[key] = cleanText($(cellEl).text());
    });

    if (Object.values(row).some((value) => Boolean(cleanText(value)))) {
      rows.push(row);
    }

    return undefined;
  });

  return rows;
}

function countDataRows($, table) {
  const bodyRows = table.find("tbody tr");
  if (bodyRows.length > 0) {
    let count = 0;
    bodyRows.each((_idx, rowEl) => {
      if ($(rowEl).find("td").length > 0) count += 1;
    });
    return count;
  }

  const rows = table.find("tr").slice(1);
  let count = 0;
  rows.each((_idx, rowEl) => {
    if ($(rowEl).find("td").length > 0) count += 1;
  });
  return count;
}

function parseActionExpr(rawExpression) {
  const value = cleanText(String(rawExpression || "").replace(/^javascript:/i, "").replace(/;$/, ""));
  if (!value) return null;

  const functionCall = value.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/);
  if (functionCall) {
    const functionName = functionCall[1];
    const argsText = cleanText(functionCall[2]);
    const args = argsText
      ? splitTopLevel(argsText, ",").map((entry) => normalizeArgValue(entry))
      : [];

    const action = {
      kind: "function-call",
      functionName,
      args,
      raw: value,
    };

    if (functionName === "funLoadDetails" && args.length > 0 && Number.isInteger(args[0])) {
      action.kind = "load-details";
      action.targetId = args[0];
    }

    return action;
  }

  let match = value.match(/\$\(["']#([^"']+)["']\)\.submit\(\)/);
  if (match) {
    return {
      kind: "submit-form",
      formId: match[1],
      raw: value,
    };
  }

  match = value.match(/document\.getElementById\(["']([^"']+)["']\)\.submit\(\)/);
  if (match) {
    return {
      kind: "submit-form",
      formId: match[1],
      raw: value,
    };
  }

  match = value.match(/window\.open\(([^)]+)\)/);
  if (match) {
    const args = splitTopLevel(match[1], ",").map((entry) => normalizeArgValue(entry));
    return {
      kind: "open-window",
      args,
      raw: value,
    };
  }

  return {
    kind: "expression",
    raw: value,
  };
}

function normalizeArgValue(value) {
  const trimmed = cleanText(value);
  if (!trimmed) return "";

  if (/^['"].*['"]$/.test(trimmed)) return unquote(trimmed);
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (/^(true|false)$/i.test(trimmed)) return /^true$/i.test(trimmed);

  return trimmed;
}

function splitTopLevel(text, separatorChar) {
  const out = [];
  let current = "";
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let quote = null;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (quote) {
      current += ch;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === "(") depthParen += 1;
    else if (ch === ")") depthParen = Math.max(0, depthParen - 1);
    else if (ch === "{") depthBrace += 1;
    else if (ch === "}") depthBrace = Math.max(0, depthBrace - 1);
    else if (ch === "[") depthBracket += 1;
    else if (ch === "]") depthBracket = Math.max(0, depthBracket - 1);

    const isTopLevel = depthParen === 0 && depthBrace === 0 && depthBracket === 0;

    if (ch === separatorChar && isTopLevel) {
      out.push(cleanText(current));
      current = "";
      continue;
    }

    current += ch;
  }

  if (cleanText(current)) out.push(cleanText(current));
  return out;
}

function readBalancedGroup(source, openIndex, openChar, closeChar) {
  if (source[openIndex] !== openChar) return null;

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (ch === openChar) {
      depth += 1;
      continue;
    }

    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: source.slice(openIndex + 1, i),
          end: i,
        };
      }
    }
  }

  return null;
}

function parseObjectLiteralPairs(objectLiteral) {
  const raw = cleanText(objectLiteral);
  if (!raw.startsWith("{") || !raw.endsWith("}")) return [];

  const body = raw.slice(1, -1).trim();
  if (!body) return [];

  const pairs = splitTopLevel(body, ",");
  const out = [];

  for (const pair of pairs) {
    const idx = pair.indexOf(":");
    if (idx === -1) continue;

    const key = cleanText(pair.slice(0, idx)).replace(/^['"]|['"]$/g, "");
    const valueRaw = cleanText(pair.slice(idx + 1));
    if (!key) continue;

    out.push({
      key,
      value: normalizeArgValue(valueRaw),
      rawValue: valueRaw,
    });
  }

  return out;
}

function resolveStringExpr(expr, stringVars) {
  const raw = cleanText(expr);
  if (!raw) return null;

  if (/^['"].*['"]$/.test(raw)) return unquote(raw);

  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) {
    return Object.prototype.hasOwnProperty.call(stringVars, raw) ? stringVars[raw] : null;
  }

  if (!raw.includes("+")) return null;
  const parts = splitTopLevel(raw, "+");
  if (!parts.length) return null;

  let combined = "";
  for (const part of parts) {
    const trimmed = cleanText(part);
    if (!trimmed) continue;

    if (/^['"].*['"]$/.test(trimmed)) {
      combined += unquote(trimmed);
      continue;
    }

    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed) && Object.prototype.hasOwnProperty.call(stringVars, trimmed)) {
      combined += stringVars[trimmed];
      continue;
    }

    return null;
  }

  return combined || null;
}

function parseStringVariableAssignments(source) {
  const out = {};
  const regex = /(?:var|let|const)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(['"](?:\\.|[^'"\\])*['"])(?:\s*;|\s*$)/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const name = match[1];
    const value = unquote(match[2]);
    out[name] = value;
  }

  return out;
}

function parsePayloadHints(functionBody) {
  const hints = {};

  const serializeRegex = /(?:var|let|const)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\$\(["']#?([^"']+)["']\)\.serializeArray\(\)\s*;/g;
  let match;
  while ((match = serializeRegex.exec(functionBody)) !== null) {
    const varName = match[1];
    const formRef = match[2];
    hints[varName] = {
      source: "serializeArray",
      formRef,
      pushedParams: [],
    };
  }

  const pushRegex = /([A-Za-z_][A-Za-z0-9_]*)\.push\(\s*\{\s*name\s*:\s*['"]([^'"]+)['"]\s*,\s*value\s*:\s*([^}]+)\s*\}\s*\)\s*;/g;
  while ((match = pushRegex.exec(functionBody)) !== null) {
    const arrName = match[1];
    if (!hints[arrName]) {
      hints[arrName] = {
        source: "array",
        formRef: null,
        pushedParams: [],
      };
    }

    hints[arrName].pushedParams.push({
      name: match[2],
      value: normalizeArgValue(match[3]),
      rawValue: cleanText(match[3]),
    });
  }

  return hints;
}

function parseFunctionBlocks(source) {
  const functions = [];
  const regex = /function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const name = match[1];
    const args = splitTopLevel(match[2], ",").map((entry) => cleanText(entry)).filter(Boolean);
    const openIndex = source.indexOf("{", match.index);
    if (openIndex === -1) continue;

    const balanced = readBalancedGroup(source, openIndex, "{", "}");
    if (!balanced) continue;

    const body = balanced.content;

    functions.push({
      name,
      args,
      body,
      start: match.index,
      end: balanced.end,
    });

    regex.lastIndex = balanced.end + 1;
  }

  return functions;
}

function stripSourceRanges(source, ranges) {
  if (!ranges.length) return source;
  let out = "";
  let cursor = 0;

  const ordered = [...ranges].sort((a, b) => a.start - b.start);
  for (const range of ordered) {
    const start = Math.max(0, range.start);
    const end = Math.min(source.length - 1, range.end);
    if (start > cursor) out += source.slice(cursor, start);
    if (end >= start) out += " ".repeat(end - start + 1);
    cursor = end + 1;
  }

  if (cursor < source.length) out += source.slice(cursor);
  return out;
}

function extractSubmitCalls(source) {
  const forms = [];

  const jqueryRegex = /\$\(["']#([^"']+)["']\)\.submit\(\)/g;
  let match;
  while ((match = jqueryRegex.exec(source)) !== null) {
    forms.push(match[1]);
  }

  const domRegex = /document\.getElementById\(["']([^"']+)["']\)\.submit\(\)/g;
  while ((match = domRegex.exec(source)) !== null) {
    forms.push(match[1]);
  }

  return Array.from(new Set(forms));
}

function extractFunctionInvocations(source) {
  const blocked = new Set([
    "if",
    "for",
    "while",
    "switch",
    "catch",
    "return",
    "alert",
    "confirm",
    "parseInt",
    "parseFloat",
    "Number",
    "String",
    "Date",
    "Object",
    "Array",
    "setTimeout",
    "setInterval",
  ]);

  const calls = [];
  const regex = /([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const fnName = match[1];
    if (blocked.has(fnName)) continue;
    if (fnName === "post" || fnName === "get") continue;

    if (match.index > 0 && source[match.index - 1] === ".") continue;

    const rawArgs = cleanText(match[2]);
    const args = rawArgs ? splitTopLevel(rawArgs, ",").map((entry) => normalizeArgValue(entry)) : [];

    calls.push({
      functionName: fnName,
      args,
      rawArgs,
    });
  }

  return uniqueBy(calls, (entry) => `${entry.functionName}::${entry.rawArgs}`);
}

function parsePayloadExpression(payloadExpr, payloadHints, stringVars) {
  const raw = cleanText(payloadExpr);
  if (!raw) return null;

  if (raw.startsWith("{")) {
    const params = parseObjectLiteralPairs(raw);
    return {
      kind: "object",
      params,
    };
  }

  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw) && payloadHints[raw]) {
    return {
      kind: payloadHints[raw].source,
      formRef: payloadHints[raw].formRef || undefined,
      pushedParams: payloadHints[raw].pushedParams || [],
      variable: raw,
    };
  }

  const resolved = resolveStringExpr(raw, stringVars);
  if (resolved !== null) {
    return {
      kind: "string",
      value: resolved,
      raw,
    };
  }

  return {
    kind: "expression",
    raw,
  };
}

function extractJqueryCalls(source, stringVars, payloadHints, functionName) {
  const calls = [];
  const regex = /\$\.(post|get)\s*\(/g;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const method = String(match[1] || "").toUpperCase();
    const openIndex = source.indexOf("(", match.index);
    if (openIndex === -1) continue;

    const balanced = readBalancedGroup(source, openIndex, "(", ")");
    if (!balanced) continue;

    const args = splitTopLevel(balanced.content, ",");
    const urlExpr = args[0] || "";
    const payloadExpr = args[1] || "";
    const dataTypeExpr = args.length >= 4 ? args[3] : "";

    const resolvedUrl = resolveStringExpr(urlExpr, stringVars);
    const normalizedUrl = normalizeUrlCandidate(resolvedUrl || urlExpr);

    calls.push({
      method: method || "POST",
      url: normalizedUrl || undefined,
      urlExpr: cleanText(urlExpr) || undefined,
      payload: parsePayloadExpression(payloadExpr, payloadHints, stringVars),
      dataType: dataTypeExpr ? normalizeArgValue(dataTypeExpr) : undefined,
      fromFunction: functionName || undefined,
      rawCall: cleanText(source.slice(match.index, balanced.end + 1)),
    });

    regex.lastIndex = balanced.end + 1;
  }

  return calls;
}

function extractScriptAnalysis($) {
  const scriptBodies = [];
  $("script").each((_idx, scriptEl) => {
    const text = String($(scriptEl).html() || "");
    if (cleanText(text)) scriptBodies.push(text);
  });

  const scriptSource = scriptBodies.join("\n\n");
  const globalVars = parseStringVariableAssignments(scriptSource);
  const functionBlocks = parseFunctionBlocks(scriptSource);

  const functions = [];
  const apiCalls = [];
  const submitCalls = [];
  const helperCalls = [];

  for (const block of functionBlocks) {
    const localStringVars = {
      ...globalVars,
      ...parseStringVariableAssignments(block.body),
    };

    const payloadHints = parsePayloadHints(block.body);
    const fnApiCalls = extractJqueryCalls(block.body, localStringVars, payloadHints, block.name);
    const fnSubmits = extractSubmitCalls(block.body);
    const fnCalls = extractFunctionInvocations(block.body);

    functions.push({
      name: block.name,
      args: block.args,
      submitsForms: fnSubmits,
      invokes: fnCalls,
      apiCalls: fnApiCalls.map((call) => ({
        method: call.method,
        url: call.url,
        urlExpr: call.urlExpr,
        payload: call.payload,
        dataType: call.dataType,
      })),
    });

    apiCalls.push(...fnApiCalls);
    submitCalls.push(...fnSubmits);
    helperCalls.push(...fnCalls);
  }

  const declarationRanges = functionBlocks.map((block) => ({
    start: block.start,
    end: block.end,
  }));
  const topLevelSource = stripSourceRanges(scriptSource, declarationRanges);
  const topLevelApiCalls = extractJqueryCalls(topLevelSource, globalVars, {}, undefined);

  const mergedApiCalls = uniqueBy([...apiCalls, ...topLevelApiCalls], (call) => {
    return [
      call.fromFunction || "top-level",
      call.method,
      call.url || call.urlExpr || "",
      JSON.stringify(call.payload || null),
      call.dataType || "",
    ].join("::");
  });

  const allSubmitCalls = Array.from(new Set([...submitCalls, ...extractSubmitCalls(scriptSource)]));

  const loadDetailsTargets = Array.from(
    new Set(
      (scriptSource.match(/funLoadDetails\(\s*(\d+)\s*\)/g) || [])
        .map((value) => {
          const match = value.match(/(\d+)/);
          return match ? Number(match[1]) : null;
        })
        .filter((value) => Number.isInteger(value))
    )
  ).sort((a, b) => a - b);

  return {
    scriptCount: scriptBodies.length,
    functionCount: functions.length,
    functions,
    apiCalls: mergedApiCalls,
    submittedFormIds: allSubmitCalls,
    loadDetailsTargets,
    referencedStringVars: globalVars,
  };
}

function extractTables($, scopeRoot) {
  const tables = [];

  scopeRoot.find("table").each((index, tableEl) => {
    const table = $(tableEl);
    const headers = makeUniqueHeaders(extractHeadersFromTable($, table));
    const sampleRows = extractTableSampleRows($, table, headers);

    tables.push({
      ...getElementRef($, tableEl, index),
      headers,
      rowCount: countDataRows($, table),
      hasInteractiveControls:
        table.find("button, input[type='button'], input[type='submit'], a[onclick], a[href^='javascript:']").length > 0,
      sampleRows,
    });
  });

  return tables;
}

function findFieldLabel($, fieldEl, formRoot) {
  const field = $(fieldEl);
  const fieldId = cleanText(field.attr("id"));

  if (fieldId) {
    const explicit = formRoot
      .find("label")
      .filter((_idx, labelEl) => cleanText($(labelEl).attr("for")) === fieldId)
      .first();
    if (explicit.length) return cleanText(explicit.text());
  }

  const wrappingLabel = field.closest("label");
  if (wrappingLabel.length) {
    const value = cleanText(wrappingLabel.text());
    if (value) return value;
  }

  const closestTd = field.closest("td, th");
  if (closestTd.length) {
    const row = closestTd.closest("tr");
    if (row.length) {
      const cells = row.find("td, th");
      if (cells.length >= 2) {
        const first = cells.first();
        if (!first.is(closestTd)) {
          const text = cleanText(first.text());
          if (text) return text;
        }
      }
    }
  }

  return cleanText(field.attr("placeholder")) || undefined;
}

function extractFormFields($, formEl) {
  const fields = [];
  const formRoot = $(formEl);

  formRoot.find("input, select, textarea").each((index, fieldEl) => {
    const field = $(fieldEl);
    const tag = String(fieldEl.tagName || fieldEl.name || "").toLowerCase();
    const type = cleanText(field.attr("type")) || (tag === "select" ? "select" : tag === "textarea" ? "textarea" : "text");

    if (["submit", "button", "reset", "image"].includes(type.toLowerCase())) {
      return;
    }

    const name = cleanText(field.attr("name"));
    const id = cleanText(field.attr("id"));
    const value = cleanText(field.attr("value"));
    const label = findFieldLabel($, fieldEl, formRoot);

    const fieldEntry = {
      ...getElementRef($, fieldEl, index),
      type,
      name: name || undefined,
      id: id || undefined,
      label: label || undefined,
      placeholder: cleanText(field.attr("placeholder")) || undefined,
      required:
        field.is("[required]") || /validate\[required\]/i.test(cleanText(field.attr("class"))) || false,
      disabled: field.is(":disabled"),
      readOnly: field.is("[readonly]"),
      maxLength: field.attr("maxlength") ? Number(field.attr("maxlength")) || undefined : undefined,
      value: value || undefined,
    };

    if (tag === "select") {
      const options = [];
      field.find("option").each((optIndex, optionEl) => {
        if (optIndex >= 25) return false;
        const optionNode = $(optionEl);
        options.push({
          value: cleanText(optionNode.attr("value")),
          label: cleanText(optionNode.text()),
          selected: optionNode.is(":selected"),
        });
        return undefined;
      });
      fieldEntry.options = options;
    }

    fields.push(fieldEntry);
  });

  return fields;
}

function extractActionableControls($, scopeRoot) {
  const controls = [];

  scopeRoot
    .find("button, input[type='button'], input[type='submit'], input[type='reset'], a[onclick], a[href^='javascript:']")
    .each((index, el) => {
      const node = $(el);
      const tag = String(el.tagName || el.name || "").toLowerCase();
      const type = cleanText(node.attr("type"));
      const text = tag === "input" ? cleanText(node.attr("value")) : cleanText(node.text());
      const onclick = cleanText(node.attr("onclick"));
      const href = cleanText(node.attr("href"));
      const actionExpr = onclick || (href && /^javascript:/i.test(href) ? href : "");

      const parentForm = node.closest("form");
      const formId = cleanText(parentForm.attr("id")) || cleanText(parentForm.attr("name"));

      controls.push({
        ...getElementRef($, el, index),
        type: type || undefined,
        label: text || undefined,
        onclick: onclick || undefined,
        href: href || undefined,
        formRef: formId || undefined,
        inferredAction: actionExpr ? parseActionExpr(actionExpr) : null,
      });
    });

  return uniqueBy(controls, (control) => {
    return [
      control.tag,
      control.id || "",
      control.name || "",
      control.label || "",
      control.onclick || "",
      control.href || "",
      control.formRef || "",
    ].join("::");
  });
}

function extractLinks($, scopeRoot) {
  const links = [];

  scopeRoot.find("a[href]").each((index, linkEl) => {
    const link = $(linkEl);
    const href = cleanText(link.attr("href"));
    if (!href || /^javascript:/i.test(href)) return;

    links.push({
      ...getElementRef($, linkEl, index),
      label: cleanText(link.text()) || undefined,
      href,
      target: cleanText(link.attr("target")) || undefined,
      title: cleanText(link.attr("title")) || undefined,
      external: /^https?:\/\//i.test(href) || href.startsWith("//"),
    });
  });

  return uniqueBy(links, (entry) => `${entry.href}::${entry.label || ""}::${entry.target || ""}`);
}

function extractForms($, scopeRoot) {
  const forms = [];

  scopeRoot.find("form").each((index, formEl) => {
    const form = $(formEl);
    const fields = extractFormFields($, formEl);

    forms.push({
      ...getElementRef($, formEl, index),
      id: cleanText(form.attr("id")) || undefined,
      name: cleanText(form.attr("name")) || undefined,
      method: cleanText(form.attr("method")).toUpperCase() || "GET",
      action: cleanText(form.attr("action")) || undefined,
      target: cleanText(form.attr("target")) || undefined,
      autoComplete: cleanText(form.attr("autocomplete")) || undefined,
      fieldCount: fields.length,
      requiredFieldCount: fields.filter((field) => field.required).length,
      fields,
    });
  });

  return forms;
}

function inferIntegrationHints(item, forms, controls, scriptAnalysis) {
  const primaryFetch = {
    method: item?.request?.method || "POST",
    url: item?.request?.url || "",
    params: item?.request?.params || {},
  };

  const mutationCalls = (scriptAnalysis.apiCalls || []).filter((call) => {
    const url = cleanText(call.url || call.urlExpr || "");
    if (!url) return false;
    return !/funLoadDetails/i.test(url);
  });

  const uniqueMutations = uniqueBy(mutationCalls, (call) => {
    return [call.method, call.url || call.urlExpr || "", call.fromFunction || ""].join("::");
  }).map((call) => ({
    method: call.method,
    url: call.url || call.urlExpr,
    fromFunction: call.fromFunction,
    payload: call.payload,
  }));

  const callableActions = controls
    .map((control) => control.inferredAction)
    .filter(Boolean)
    .map((action) => {
      if (action.kind === "function-call") {
        return {
          type: "function",
          name: action.functionName,
          args: action.args,
        };
      }
      if (action.kind === "load-details") {
        return {
          type: "load-details",
          targetId: action.targetId,
        };
      }
      if (action.kind === "submit-form") {
        return {
          type: "submit-form",
          formId: action.formId,
        };
      }
      return {
        type: action.kind,
        raw: action.raw,
      };
    });

  const formRequirements = forms.map((form) => ({
    formId: form.id || form.name || form.selectorHint,
    method: form.method,
    action: form.action || null,
    requiredFields: form.fields
      .filter((field) => field.required)
      .map((field) => ({
        name: field.name || field.id || field.selectorHint,
        label: field.label || null,
        type: field.type,
      })),
  }));

  const suggestedFlow = [];
  suggestedFlow.push({
    step: 1,
    description: "Load page content using mapped fetch endpoint",
    request: primaryFetch,
  });

  if (formRequirements.length) {
    suggestedFlow.push({
      step: suggestedFlow.length + 1,
      description: "Render detected forms with required fields before enabling submit",
      forms: formRequirements,
    });
  }

  if (uniqueMutations.length) {
    suggestedFlow.push({
      step: suggestedFlow.length + 1,
      description: "Wire submit/actions to mutation endpoints discovered in scripts",
      mutations: uniqueMutations,
    });
  }

  if (scriptAnalysis.loadDetailsTargets && scriptAnalysis.loadDetailsTargets.length > 0) {
    suggestedFlow.push({
      step: suggestedFlow.length + 1,
      description: "Handle in-page navigation actions triggered by funLoadDetails",
      loadDetailsTargets: scriptAnalysis.loadDetailsTargets,
    });
  }

  return {
    primaryFetch,
    formRequirements,
    mutations: uniqueMutations,
    actionableControls: callableActions,
    suggestedFlow,
  };
}

function analyzeHtmlPage(item, html, rawPath) {
  const $ = cheerio.load(html);
  const scopeRoot = $("#divContent").length ? $("#divContent").first() : $("body");

  const pageHeading =
    cleanText(scopeRoot.find("h1, h2, h3").first().text()) ||
    cleanText($("title").first().text()) ||
    item?.subitem ||
    "";

  const tables = extractTables($, scopeRoot);
  const forms = extractForms($, scopeRoot);
  const controls = extractActionableControls($, scopeRoot);
  const links = extractLinks($, scopeRoot);
  const scriptAnalysis = extractScriptAnalysis($);

  const integration = inferIntegrationHints(item, forms, controls, scriptAnalysis);

  return {
    id: item?.id || null,
    key: item?.key || null,
    dropdown: item?.dropdown || null,
    subitem: item?.subitem || null,
    pageHeading,
    files: {
      rawPath,
      rawFile: item?.files?.rawFile || null,
    },
    request: item?.request || null,
    response: item?.response || null,
    summary: {
      tableCount: tables.length,
      formCount: forms.length,
      controlCount: controls.length,
      linkCount: links.length,
      scriptFunctionCount: scriptAnalysis.functionCount,
      apiCallCount: scriptAnalysis.apiCalls.length,
      hasMutationEndpoints: integration.mutations.length > 0,
    },
    ui: {
      tables,
      forms,
      controls,
      links,
    },
    scripts: scriptAnalysis,
    integration,
  };
}

function buildGlobalStats(pages) {
  return {
    totalPages: pages.length,
    withTables: pages.filter((page) => page.summary.tableCount > 0).length,
    withForms: pages.filter((page) => page.summary.formCount > 0).length,
    withControls: pages.filter((page) => page.summary.controlCount > 0).length,
    withScriptApiCalls: pages.filter((page) => page.summary.apiCallCount > 0).length,
    withMutations: pages.filter((page) => page.summary.hasMutationEndpoints).length,
  };
}

function buildEndpointUsage(pages) {
  const fetchEndpoints = {};
  const mutationEndpoints = {};

  for (const page of pages) {
    const fetchUrl = cleanText(page?.request?.url || "");
    if (fetchUrl) {
      if (!fetchEndpoints[fetchUrl]) fetchEndpoints[fetchUrl] = [];
      fetchEndpoints[fetchUrl].push({
        key: page.key,
        method: page?.request?.method || "POST",
      });
    }

    for (const mutation of page?.integration?.mutations || []) {
      const url = cleanText(mutation.url || "");
      if (!url) continue;

      if (!mutationEndpoints[url]) mutationEndpoints[url] = [];
      mutationEndpoints[url].push({
        key: page.key,
        method: mutation.method,
        fromFunction: mutation.fromFunction || null,
      });
    }
  }

  return {
    fetchEndpoints,
    mutationEndpoints,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(args.input)) {
    throw new Error(`Input file not found: ${args.input}`);
  }

  const typedData = safeReadJson(args.input);
  const items = Array.isArray(typedData?.items) ? typedData.items : [];

  if (!items.length) {
    throw new Error(`No items found in typed endpoint file: ${args.input}`);
  }

  const limit = args.max > 0 ? Math.min(items.length, args.max) : items.length;
  const pages = [];
  const missingRaw = [];

  log(`Analyzing ${limit}/${items.length} endpoint pages...`);

  for (let i = 0; i < limit; i += 1) {
    const item = items[i];
    const rawPath = resolveRawHtmlPath({ item, typedFile: args.input, typedData });

    if (!rawPath || !fs.existsSync(rawPath)) {
      missingRaw.push({
        key: item?.key || `${item?.dropdown || "Unknown"}::${item?.subitem || "Unknown"}`,
        rawFile: item?.files?.rawFile || null,
        rawPath: rawPath || null,
      });
      continue;
    }

    const html = fs.readFileSync(rawPath, "utf8");
    pages.push(analyzeHtmlPage(item, html, rawPath));
  }

  const output = {
    schemaVersion: 1,
    generatedAt: ts(),
    source: {
      typedFile: args.input,
      typedGeneratedAt: typedData?.source?.generatedAt || null,
      analyzedItems: pages.length,
      totalItems: items.length,
    },
    stats: buildGlobalStats(pages),
    endpointUsage: buildEndpointUsage(pages),
    missingRaw,
    pages,
  };

  safeWriteJson(args.output, output);

  log(`Wrote UI map: ${args.output}`);
  log(
    `Pages=${output.stats.totalPages}, forms=${output.stats.withForms}, tables=${output.stats.withTables}, controls=${output.stats.withControls}, mutations=${output.stats.withMutations}`
  );

  if (missingRaw.length > 0) {
    log(`Warning: ${missingRaw.length} pages skipped due to missing raw HTML.`);
  }
}

main();
