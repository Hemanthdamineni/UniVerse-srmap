const fs = require("fs");
const path = require("path");
const { BASE_ORIGIN, BASE_PATH } = require("../../config/env");
const { parseHtmlContent } = require("../htmlParser");
const { normalizeRuntimePayload } = require("../erpPayloadNormalizer");
const { isErpSessionExpiredResponse, makeSessionExpiredError } = require("./sessionState");

let _captureDir = null;

function setCaptureDir(dir) {
  _captureDir = dir;
}

function resolveTemplateValue(rawValue, variables) {
  if (!variables) return null;
  const match = String(rawValue || "").match(/^\{\{\s*([A-Za-z0-9_]+)\s*\}\}$/);
  if (!match) return null;
  const key = match[1];
  const value = variables[key];
  return value === undefined || value === null ? null : String(value);
}

function buildEndpointRequest(endpoint, variables = null) {
  const params = {};
  const template = endpoint?.paramsTemplate || {};
  const argId = endpoint?.argId;

  for (const [key, value] of Object.entries(template)) {
    const resolved = resolveTemplateValue(value, variables);
    if (resolved !== null) {
      params[key] = resolved;
      continue;
    }

    if (value === "{{argId}}") {
      if (argId !== undefined && argId !== null) {
        params[key] = String(argId);
      }
      continue;
    }
    params[key] = String(value);
  }

  // Only attach stuId for endpoints that explicitly declare it in discovery metadata.
  if (
    (Object.prototype.hasOwnProperty.call(template, "stuId") ||
      Object.prototype.hasOwnProperty.call(params, "stuId")) &&
    variables?.stuId !== undefined &&
    variables?.stuId !== null
  ) {
    params.stuId = String(variables.stuId);
  }

  if (!Object.prototype.hasOwnProperty.call(params, "ids") && Number.isInteger(argId)) {
    params.ids = String(argId);
  }

  return params;
}

function isExternalEndpoint(endpoint) {
  const url = String(endpoint?.url || "");
  if (!url) return false;
  return /^https?:\/\//i.test(url) || url.startsWith("//");
}

async function callEndpointViaApi(api, endpoint, menuItem = null, variables = null, bodyOverride = null) {
  if (!endpoint || !endpoint.url) {
    return { error: "Endpoint mapping missing", title: "", tables: [], text: "" };
  }

  if (endpoint.external || isExternalEndpoint(endpoint)) {
    return {
      title: menuItem?.subitem || "",
      text: "External resource. Open URL in browser.",
      tables: [],
      externalUrl: endpoint.url,
    };
  }

  const method = String(endpoint.method || "POST").toUpperCase();
  const url = String(endpoint.url || "").replace(/^\/+/, "");
  const formParams = buildEndpointRequest(endpoint, variables);

  let response;
  let body;

  if (bodyOverride) {
    body = bodyOverride;
  } else {
    if (method === "GET") {
      response = await api.get(url, { params: formParams });
    } else {
      response = await api.post(url, { form: formParams });
    }
    body = await response.text();
    if (_captureDir && menuItem?.dropdown) {
      const encD = (menuItem.dropdown || "").replace(/[/\\|]/g, "_");
      const encS = (menuItem.subitem || "").replace(/[/\\|]/g, "_");
      const safeKey = `${encD}|${encS}`;
      const rawDir = path.join(_captureDir, "raw");
      if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });
      fs.writeFileSync(path.join(rawDir, `${safeKey}.html`), body, "utf8");
    }
  }

  const parsed = parseHtmlContent(body);
  if (isErpSessionExpiredResponse(body, parsed)) {
    throw makeSessionExpiredError();
  }

  const normalized = normalizeRuntimePayload(parsed, {
    dropdown: menuItem?.dropdown,
    subitem: menuItem?.subitem,
  });

  return {
    ...normalized.payload,
    status: bodyOverride ? 200 : response.status(),
    rawHtml: body,
    endpoint: {
      method,
      url,
      params: formParams,
    },
  };
}

async function fetchProfileViaApi(api, options = {}) {
  const endpoint = {
    method: "POST",
    url: "students/report/studentreportresources.jsp",
    paramsTemplate: { ids: "1" },
    argId: 1,
  };

  const parsed = await callEndpointViaApi(api, endpoint, {
    dropdown: "Profile",
    subitem: "Profile",
  });

  if (!parsed.TableContent && parsed.tables?.[0]?.length) {
    const fallback = {};
    for (const row of parsed.tables[0]) {
      const keys = Object.keys(row);
      if (keys.length >= 2) {
        const key = row[keys[0]];
        const value = row[keys[1]];
        if (key && value) fallback[key] = value;
      }
    }
    if (Object.keys(fallback).length) {
      parsed.TableContent = fallback;
    }
  }

  const profileData = {
    PageHeading: parsed.title || "PROFILE",
    TableContent: parsed.TableContent || {},
    tables: parsed.tables || [],
    text: parsed.text || "",
    meta: parsed.meta && typeof parsed.meta === "object" ? parsed.meta : undefined,
  };

  if (options?.includeRawHtml) {
    profileData.rawHtml = parsed.rawHtml || "";
  }

  return profileData;
}

async function submitAttendanceCodeViaApi(api, payload) {
  const acode = String(payload?.acode || "").trim();
  if (!acode) {
    const error = new Error("Attendance code is required");
    error.status = 400;
    throw error;
  }

  const form = new URLSearchParams();
  form.append("ids", "1");
  form.append("acode", acode);
  form.append("dynamiclatdata", String(payload?.dynamiclatdata ?? "0"));
  form.append("dynamiclonxdata", String(payload?.dynamiclonxdata ?? "0"));

  const response = await api.post("students/transaction/studentattendanceresources.jsp", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${BASE_ORIGIN}${BASE_PATH}/HRDsystem`,
    },
    data: form.toString(),
  });

  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  const resultstatus = typeof parsed?.resultstatus === "number" ? parsed.resultstatus : null;
  const result =
    String(parsed?.result || parsed?.message || "").trim() ||
    String(raw || "").trim();

  return {
    status: response.status(),
    resultstatus,
    result,
    raw,
    data: parsed,
  };
}

module.exports = {
  setCaptureDir,
  callEndpointViaApi,
  fetchProfileViaApi,
  submitAttendanceCodeViaApi,
};
