const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { chromium, request } = require("playwright");
const { parseHtmlContent } = require("./htmlParser");
const { normalizeRuntimePayload } = require("./erpPayloadNormalizer");
const { cleanText } = require("../utils/text");
const {
  BASE_ORIGIN,
  BASE_PATH,
  LOGIN_URL,
  LOGIN_POST_URL,
  LOGIN_PREAUTH_TTL_MS,
} = require("../config/env");
const {
  createLoginAttemptId,
  createLoginAttemptTrace,
} = require("./loginDiagnostics");

let _captureDir = null;

function setCaptureDir(dir) {
  _captureDir = dir;
}

const ERP_SESSION_EXPIRED_HTML_PATTERNS = [
  /studentloginpage/i,
  /studentlogintoportal/i,
  /id\s*=\s*["']frmSL["']/i,
  /name\s*=\s*["']ccode["']/i,
  /id\s*=\s*["']ccode["']/i,
  /id\s*=\s*["']UserName["']/i,
  /id\s*=\s*["']AuthKey["']/i,
  /captcha/i,
];

const ERP_SESSION_EXPIRED_TEXT_PATTERNS = [
  /\blogin with your application number\b/i,
  /\bddmmyyyy\b/i,
  /\bstudentloginpage\b/i,
  /\bstudentlogintoportal\b/i,
  /\btxt(username|authkey)\b/i,
  /\bcaptcha\b/i,
  /\bapplication number\b/i,
];

const AUTHENTICATED_REFERER = `${BASE_ORIGIN}${BASE_PATH}/HRDsystem`;
const LOGIN_AUTH_PROBE_ENDPOINT = {
  method: "POST",
  url: "students/report/studentreportresources.jsp",
  paramsTemplate: { ids: "10" },
  argId: 10,
};
const LOGIN_AUTH_PROBE_MENU_ITEM = {
  dropdown: "Academic",
  subitem: "Time Table",
};

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

async function createApiContext(storageState = null, options = {}) {
  const baseURL = `${BASE_ORIGIN}${BASE_PATH.replace(/\/+$/, "")}/`;
  const referer =
    String(options?.referer || "").trim() ||
    (storageState ? AUTHENTICATED_REFERER : LOGIN_URL);
  return request.newContext({
    baseURL,
    storageState: storageState || undefined,
    timeout: 30000,
    extraHTTPHeaders: {
      Referer: referer,
      Origin: BASE_ORIGIN,
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
  });
}

function resolveLoginUrl(candidate, fallback = LOGIN_URL) {
  const raw = String(candidate || "").trim();
  if (!raw) return fallback;
  return new URL(raw, fallback).toString();
}

function extractStaticAssignments(html) {
  const fields = {};
  const regex = /\$\("#"\s*\+\s*"([^"]+)"\)\.val\(\s*(["'])(.*?)\2\s*\);/gs;

  for (const match of html.matchAll(regex)) {
    const [expression, fieldId, , value] = match;
    if (/\+\s*\$\(/.test(expression) || /\$\(/.test(value)) continue;
    fields[fieldId] = value;
  }

  return fields;
}

function extractScriptValueAssignments(html) {
  const assignments = [];
  const patterns = [
    /\$\("#"\s*\+\s*"([^"]+)"\)\.val\(\s*(["'])(.*?)\2\s*\+\s*\$\("#"\s*\+\s*"([^"]+)"\)\.val\(\)\s*\+\s*(["'])(.*?)\5\s*\);/gs,
    /\$\("#"\s*\+\s*"([^"]+)"\)\.val\(\s*(["'])(.*?)\2\s*\+\s*\$\("#([^"]+)"\)\.val\(\)\s*\+\s*(["'])(.*?)\5\s*\);/gs,
    /\$\("#([^"]+)"\)\.val\(\s*(["'])(.*?)\2\s*\+\s*\$\("#"\s*\+\s*"([^"]+)"\)\.val\(\)\s*\+\s*(["'])(.*?)\5\s*\);/gs,
    /\$\("#([^"]+)"\)\.val\(\s*(["'])(.*?)\2\s*\+\s*\$\("#([^"]+)"\)\.val\(\)\s*\+\s*(["'])(.*?)\5\s*\);/gs,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const targetFieldId = match[1];
      const prefix = match[3];
      const sourceFieldId = match[4];
      const suffix = match[6];
      if (!targetFieldId || !sourceFieldId) continue;

      const duplicate = assignments.some(
        (entry) =>
          entry.targetFieldId === targetFieldId &&
          entry.sourceFieldId === sourceFieldId &&
          entry.prefix === prefix &&
          entry.suffix === suffix
      );
      if (duplicate) continue;

      assignments.push({
        targetFieldId,
        prefix,
        sourceFieldId,
        suffix,
      });
    }
  }

  return assignments;
}

function extractScrubbedFieldIds(html) {
  const fieldIds = new Set();
  const regex = /\$\("#"\s*\+\s*"([^"]+)"\)\.val\((["'])\.{3,}\2\);/gs;

  for (const match of html.matchAll(regex)) {
    const fieldId = String(match[1] || "").trim();
    if (fieldId) fieldIds.add(fieldId);
  }

  return fieldIds;
}

function parseLoginBootstrap(html = "") {
  const $ = cheerio.load(html);
  const form =
    $("#frmSL").first().length > 0
      ? $("#frmSL").first()
      : $('form[action*="StudentLoginToPortal"]').first();

  if (!form.length) {
    const error = new Error("Unable to locate ERP login form.");
    error.status = 502;
    throw error;
  }

  const hiddenFields = {};
  const inputFieldsById = {};
  form.find('input[type="hidden"][name]').each((_idx, input) => {
    const name = String($(input).attr("name") || "").trim();
    if (!name) return;
    hiddenFields[name] = String($(input).attr("value") || "");
  });
  form.find("input[id], textarea[id]").each((_idx, input) => {
    const id = String($(input).attr("id") || "").trim();
    if (!id) return;
    inputFieldsById[id] = {
      id,
      name: String($(input).attr("name") || "").trim(),
      type: String($(input).attr("type") || "").trim().toLowerCase(),
      placeholder: String($(input).attr("placeholder") || "").trim(),
      itemref: String($(input).attr("itemref") || "").trim(),
      patterns: String($(input).attr("patterns") || "").trim(),
    };
  });

  const captchaInput =
    form.find('input[id="ccode"]').first().length > 0
      ? form.find('input[id="ccode"]').first()
      : form.find('input[placeholder*="Captcha"]').first();

  const captchaFieldName = String(captchaInput.attr("name") || "ccode").trim() || "ccode";
  const captchaImage =
    form.find('img[src*="captcha"]').first().length > 0
      ? form.find('img[src*="captcha"]').first()
      : $('img[src*="captcha"]').first();
  const captchaUrl = resolveLoginUrl(captchaImage.attr("src"), LOGIN_URL);
  const formAction = resolveLoginUrl(form.attr("action"), LOGIN_POST_URL);

  if (!captchaUrl) {
    const error = new Error("Unable to locate ERP captcha URL.");
    error.status = 502;
    throw error;
  }

  const scriptAssignments = extractScriptValueAssignments(html);
  const scrubbedFieldIds = extractScrubbedFieldIds(html);
  const assignmentSourceIds = Array.from(new Set(scriptAssignments.map((entry) => entry.sourceFieldId)));
  const passwordSourceId =
    assignmentSourceIds.find((fieldId) => inputFieldsById[fieldId]?.type === "password") ||
    assignmentSourceIds.find((fieldId) => scrubbedFieldIds.has(fieldId)) ||
    assignmentSourceIds.find((fieldId) =>
      /auth|pass/i.test(
        `${fieldId} ${inputFieldsById[fieldId]?.name || ""} ${inputFieldsById[fieldId]?.placeholder || ""} ${
          inputFieldsById[fieldId]?.itemref || ""
        }`
      )
    ) ||
    null;
  const usernameSourceId =
    assignmentSourceIds.find((fieldId) => fieldId !== passwordSourceId) ||
    assignmentSourceIds[0] ||
    null;

  const credentialAssignments = {
    username:
      scriptAssignments.find((entry) => entry.sourceFieldId === usernameSourceId) || null,
    password:
      scriptAssignments.find((entry) => entry.sourceFieldId === passwordSourceId) || null,
  };

  return {
    captchaUrl,
    captchaFieldName,
    formAction,
    hiddenFields,
    credentialAssignments,
    staticAssignments: extractStaticAssignments(html),
    inputFieldsById,
    sourceFieldIds: {
      username: usernameSourceId,
      password: passwordSourceId,
    },
  };
}

function describeFormField(element, $) {
  if (!element || !$.contains($.root()[0], element)) return null;

  const id = String($(element).attr("id") || "").trim();
  const name = String($(element).attr("name") || "").trim();
  const type = String($(element).attr("type") || "").trim().toLowerCase();
  const placeholder = String($(element).attr("placeholder") || "").trim();
  const itemref = String($(element).attr("itemref") || "").trim();

  if (!id && !name) return null;

  return {
    id,
    name,
    type,
    placeholder,
    itemref,
  };
}

function findLoginFormField(form, $, { ids = [], names = [], predicate = null } = {}) {
  for (const id of ids) {
    const match = form.find(`input[id="${id}"], textarea[id="${id}"]`).first();
    const field = describeFormField(match[0], $);
    if (field) return field;
  }

  for (const name of names) {
    const match = form.find(`input[name="${name}"], textarea[name="${name}"]`).first();
    const field = describeFormField(match[0], $);
    if (field) return field;
  }

  if (typeof predicate !== "function") return null;

  const matches = form.find("input, textarea").toArray();
  for (const element of matches) {
    const field = describeFormField(element, $);
    if (!field) continue;
    if (predicate(field)) return field;
  }

  return null;
}

function extractLoginFieldTargets(html = "") {
  const $ = cheerio.load(html);
  const form =
    $("#frmSL").first().length > 0
      ? $("#frmSL").first()
      : $('form[action*="StudentLoginToPortal"]').first();

  if (!form.length) {
    return {
      username: null,
      password: null,
      captcha: null,
      hasSubmitButton: false,
    };
  }

  const bootstrap = parseLoginBootstrap(html);
  const username = findLoginFormField(form, $, {
    ids: [
      bootstrap?.sourceFieldIds?.username,
      "UserName",
      "txtUserName",
      "userName",
    ].filter(Boolean),
    names: ["UserName", "txtUserName", "userName"],
    predicate: (field) =>
      field.type !== "hidden" &&
      /user|application|register/i.test(`${field.id} ${field.name} ${field.placeholder} ${field.itemref}`),
  });

  const password = findLoginFormField(form, $, {
    ids: [bootstrap?.sourceFieldIds?.password, "AuthKey", "txtAuthKey", "password"].filter(Boolean),
    names: ["AuthKey", "txtAuthKey", "password"],
    predicate: (field) =>
      field.type === "password" ||
      /auth|pass/i.test(`${field.id} ${field.name} ${field.placeholder} ${field.itemref}`),
  });

  const captcha = findLoginFormField(form, $, {
    ids: ["ccode", "captcha"],
    names: ["ccode", "captcha"],
    predicate: (field) =>
      field.type !== "hidden" && /captcha|code/i.test(`${field.id} ${field.name} ${field.placeholder}`),
  });

  const fallbackVisibleInputs = form
    .find('input:not([type="hidden"]):not([type="submit"]):not([type="button"])')
    .toArray()
    .map((element) => describeFormField(element, $))
    .filter(Boolean);

  return {
    username:
      username ||
      fallbackVisibleInputs.find(
        (field) =>
          field &&
          field.type !== "password" &&
          field.id !== captcha?.id &&
          field.name !== captcha?.name
      ) ||
      null,
    password:
      password ||
      fallbackVisibleInputs.find((field) => field && field.type === "password") ||
      null,
    captcha,
    hasSubmitButton:
      form.find('button[type="submit"], input[type="submit"], button:not([type])').first().length > 0,
  };
}

function escapeAttributeValue(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildFieldSelector(field) {
  if (!field) return null;
  if (field.id) return `[id="${escapeAttributeValue(field.id)}"]`;
  if (field.name) return `[name="${escapeAttributeValue(field.name)}"]`;
  return null;
}

function buildLoginPayload({ username, password, captcha, loginBootstrap }) {
  const payload = new URLSearchParams();
  const hiddenFields = loginBootstrap?.hiddenFields || {};
  const inputFieldsById = loginBootstrap?.inputFieldsById || {};

  function resolveSubmitFieldName(fieldIdOrName) {
    const raw = String(fieldIdOrName || "").trim();
    if (!raw) return "";
    return String(inputFieldsById[raw]?.name || raw).trim();
  }

  // 1. Hidden fields first (original values)
  for (const [name, value] of Object.entries(hiddenFields)) {
    payload.append(name, String(value ?? ""));
  }

  // 2. Dynamic credential assignments (obfuscated format support)
  const credentialAssignments = loginBootstrap?.credentialAssignments || {};
  if (credentialAssignments.username?.targetFieldId) {
    payload.set(
      resolveSubmitFieldName(credentialAssignments.username.targetFieldId),
      `${credentialAssignments.username.prefix}${username}${credentialAssignments.username.suffix}`
    );
  }
  if (credentialAssignments.password?.targetFieldId) {
    payload.set(
      resolveSubmitFieldName(credentialAssignments.password.targetFieldId),
      `${credentialAssignments.password.prefix}${password}${credentialAssignments.password.suffix}`
    );
  }

  // 3. Static assignments (e.g. anti-CSRF tokens)
  for (const [fieldId, value] of Object.entries(loginBootstrap?.staticAssignments || {})) {
    payload.set(resolveSubmitFieldName(fieldId), String(value ?? ""));
  }

  // 4. Source visible fields (when detected by JS parser)
  if (loginBootstrap?.sourceFieldIds?.username) {
    payload.set(resolveSubmitFieldName(loginBootstrap.sourceFieldIds.username), String(username));
  }
  if (loginBootstrap?.sourceFieldIds?.password) {
    payload.set(resolveSubmitFieldName(loginBootstrap.sourceFieldIds.password), String(password));
  }

  // 5. Hardcoded hidden-target fallback (common across all ERP form versions)
  payload.set("txtUserName", String(username));
  payload.set("txtAuthKey", String(password));

  // 6. Captcha fields
  payload.set(loginBootstrap?.captchaFieldName || "ccode", String(captcha));
  payload.set("ccode", String(captcha));

  // 7. Ensure EVERY input field from the form is present in the payload.
  //    The ERP may reject the request if expected fields are missing, even when
  //    the JS parser failed to detect them (e.g. simplified form without obfuscation).
  //    Visible password fields get the mangled value the ERP's own JS produces.
  for (const [id, field] of Object.entries(inputFieldsById)) {
    const fieldName = String(field.name || "").trim();
    if (!fieldName) continue;
    if (payload.has(fieldName)) continue;

    if (field.type === "password") {
      // The ERP's JS sets the visible password field to "......." before submit
      payload.set(fieldName, ".......");
    } else if (hiddenFields[fieldName] !== undefined) {
      payload.set(fieldName, String(hiddenFields[fieldName] ?? ""));
    } else {
      payload.set(fieldName, "");
    }
  }

  return payload;
}

function validatePasswordResetPassword(value) {
  const password = String(value || "");
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (!/\d/.test(password)) {
    return "Password must include at least one number.";
  }
  return "";
}

function makeAuthError(code, message, status = 401, extra = {}) {
  const error = new Error(message);
  error.code = String(code || "UNAUTHORIZED").trim().toUpperCase();
  error.status = Number(status) || 500;
  if (extra && typeof extra === "object" && Object.keys(extra).length > 0) {
    error.extra = extra;
  }
  return error;
}

function isUsableProfileData(profileData) {
  const table = profileData?.TableContent || {};
  const keys = Object.keys(table).map((key) => String(key || "").trim().toLowerCase());
  if (keys.length < 4) return false;

  const expected = [
    "student name",
    "register no",
    "semester",
    "program",
    "specialization",
    "student contact number",
  ];

  const hits = expected.filter((token) => keys.some((key) => key.includes(token))).length;
  return hits >= 2;
}

function isLoginFailureResponse(html = "", hasSidebar = false) {
  return (
    /invalid captcha/i.test(html) ||
    /invalid login/i.test(html) ||
    (/studentloginpage/i.test(html) && !hasSidebar)
  );
}

function looksLikeLoginPage(html = "", parsed = null) {
  const rawHtml = String(html || "");
  if (!rawHtml && !parsed) return false;
  if (rawHtml && ERP_SESSION_EXPIRED_HTML_PATTERNS.some((pattern) => pattern.test(rawHtml))) {
    return true;
  }

  const payloadText = collectParsedPayloadText(parsed) || rawHtml.replace(/<[^>]+>/g, " ");
  return ERP_SESSION_EXPIRED_TEXT_PATTERNS.some((pattern) => pattern.test(payloadText));
}

function classifyLoginResponse(html = "", { hasSidebar = false, finalUrl = "", httpStatus = 200 } = {}) {
  const rawHtml = String(html || "");
  const normalizedUrl = String(finalUrl || "");
  const statusCode = Number(httpStatus || 0);
  if (/invalid captcha/i.test(rawHtml)) {
    return {
      classifier: "invalid_captcha",
      authenticated: false,
      failureCode: "INVALID_CAPTCHA",
      status: 401,
      message: "Invalid captcha. Please try again.",
    };
  }
  if (/invalid login/i.test(rawHtml)) {
    return {
      classifier: "invalid_credentials",
      authenticated: false,
      failureCode: "INVALID_CREDENTIALS",
      status: 401,
      message: "Invalid username or password. Please try again.",
    };
  }

  if (statusCode >= 400) {
    return {
      classifier: "unknown_upstream_state",
      authenticated: false,
      failureCode: "",
      status: statusCode || 502,
      message: "ERP verification request failed.",
    };
  }

  const hasShell =
    hasSidebar ||
    /id\s*=\s*["']sidebar-menu["']/i.test(rawHtml) ||
    (/hrdsystem/i.test(normalizedUrl) && !looksLikeLoginPage(rawHtml));
  if (hasShell) {
    return {
      classifier: "authenticated_shell",
      authenticated: true,
      failureCode: "",
      status: 200,
      message: "",
    };
  }

  if (looksLikeLoginPage(rawHtml)) {
    return {
      classifier: "login_page",
      authenticated: false,
      failureCode: "",
      status: 401,
      message: "ERP returned the login page again.",
    };
  }

  return {
    classifier: "unknown_upstream_state",
    authenticated: false,
    failureCode: "",
    status: 502,
    message: "ERP returned an unknown login response.",
  };
}

function buildFallbackProfileData(username, profileData = null) {
  const normalizedUsername = String(username || "").trim();
  const existing = profileData && typeof profileData === "object" ? profileData : {};
  const existingTable =
    existing.TableContent && typeof existing.TableContent === "object" ? existing.TableContent : {};

  const tableContent = {
    ...existingTable,
  };

  if (normalizedUsername) {
    if (!String(tableContent["Register No."] || "").trim()) {
      tableContent["Register No."] = normalizedUsername;
    }
    if (!String(tableContent.Name || "").trim() && !String(tableContent["Student Name"] || "").trim()) {
      tableContent.Name = normalizedUsername;
    }
  }

  return {
    PageHeading: existing.PageHeading || "PROFILE",
    TableContent: tableContent,
    tables: Array.isArray(existing.tables) ? existing.tables : [],
    text: typeof existing.text === "string" ? existing.text : "",
    meta: {
      ...(existing.meta && typeof existing.meta === "object" ? existing.meta : {}),
      profileIncomplete: true,
      source: "login-session-fallback",
    },
  };
}

function makeSessionExpiredError(message = "ERP session expired. Please sign in again.") {
  const error = new Error(message);
  error.status = 401;
  error.code = "SESSION_EXPIRED";
  return error;
}

function collectParsedPayloadText(payload) {
  if (!payload || typeof payload !== "object") return "";

  const parts = [];
  if (typeof payload.title === "string") parts.push(payload.title);
  if (typeof payload.text === "string") parts.push(payload.text);

  if (payload.TableContent && typeof payload.TableContent === "object") {
    for (const [key, value] of Object.entries(payload.TableContent)) {
      parts.push(String(key || ""));
      parts.push(String(value || ""));
    }
  }

  if (Array.isArray(payload.tables)) {
    for (const table of payload.tables.slice(0, 2)) {
      if (!Array.isArray(table)) continue;
      for (const row of table.slice(0, 3)) {
        if (!row || typeof row !== "object") continue;
        parts.push(...Object.values(row).map((value) => String(value || "")));
      }
    }
  }

  return parts.join(" ");
}

function isErpSessionExpiredResponse(html = "", parsed = null) {
  const rawHtml = String(html || "");
  if (rawHtml && ERP_SESSION_EXPIRED_HTML_PATTERNS.some((pattern) => pattern.test(rawHtml))) {
    return true;
  }

  const payloadText = collectParsedPayloadText(parsed);
  if (!payloadText) return false;

  const hasSessionExpiryText = ERP_SESSION_EXPIRED_TEXT_PATTERNS.some((pattern) =>
    pattern.test(payloadText)
  );
  if (!hasSessionExpiryText) return false;

  const hasStructuredData =
    Boolean(parsed?.TableContent && Object.keys(parsed.TableContent).length > 0) ||
    (Array.isArray(parsed?.tables) && parsed.tables.some((table) => Array.isArray(table) && table.length > 0));

  return !hasStructuredData;
}

async function verifyAuthenticatedShellFromStorageState(storageState) {
  const api = await createApiContext(storageState);
  try {
    const finalUrl = resolveLoginUrl(
      LOGIN_AUTH_PROBE_ENDPOINT.url,
      `${BASE_ORIGIN}${BASE_PATH}/`
    );
    try {
      const parsed = await callEndpointViaApi(
        api,
        LOGIN_AUTH_PROBE_ENDPOINT,
        LOGIN_AUTH_PROBE_MENU_ITEM
      );
      const html = String(parsed?.rawHtml || "");
      const authenticated = !looksLikeLoginPage(html, parsed);

      return {
        storageState: await api.storageState(),
        html,
        finalUrl,
        httpStatus: parsed?.status || 200,
        classifier: authenticated ? "authenticated_shell" : "login_page",
        authenticated,
      };
    } catch (error) {
      if (String(error?.code || "").trim().toUpperCase() === "SESSION_EXPIRED") {
        return {
          storageState: await api.storageState(),
          html: "",
          finalUrl,
          httpStatus: error?.status || 401,
          classifier: "login_page",
          authenticated: false,
        };
      }
      throw error;
    }
  } finally {
    await api.dispose();
  }
}

async function probeProfileFromStorageState(storageState, finalUrl = "") {
  const api = await createApiContext(storageState);
  try {
    try {
      const profileData = await fetchProfileViaApi(api, { includeRawHtml: true });
      const valid = isUsableProfileData(profileData);

      return {
        storageState: await api.storageState(),
        profileData,
        valid,
        profileStatus: valid ? "ready" : "deferred",
        classifier: valid ? "authenticated_shell" : "unknown_upstream_state",
        finalUrl,
        rawHtml: profileData?.rawHtml || "",
      };
    } catch (error) {
      if (String(error?.code || "").trim().toUpperCase() === "SESSION_EXPIRED") {
        return {
          storageState: await api.storageState(),
          profileData: null,
          valid: false,
          profileStatus: "deferred",
          classifier: "profile_probe_login_page",
          finalUrl,
          rawHtml: "",
          error,
        };
      }
      throw error;
    }
  } finally {
    await api.dispose();
  }
}

async function submitPayloadInBrowser(page, { username, password, captcha, loginBootstrap }) {
  const payload = buildLoginPayload({
    username,
    password,
    captcha,
    loginBootstrap,
  });
  const formAction = loginBootstrap?.formAction || LOGIN_POST_URL;
  let navigationError = null;
  const navigation = page
    .waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 15000,
    })
    .catch((error) => {
      navigationError = error;
      return null;
    });

  const fields = Object.fromEntries(payload.entries());
  await page.evaluate(
    ({ action, formFields }) => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = action;
      form.style.display = "none";

      Object.entries(formFields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.name = name;
        input.value = String(value ?? "");
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    },
    {
      action: formAction,
      formFields: fields,
    }
  );

  await navigation;
  if (!navigationError) {
    try {
      await page.waitForLoadState("networkidle", { timeout: 10000 });
    } catch {
      // Some ERP pages keep polling; DOM content is sufficient for cookie/bootstrap capture.
    }
  }

  return Array.from(new Set(Object.keys(fields)));
}

async function submitLoginInBrowser({ storageState, loginBootstrap, username, password, captcha }) {
  const browser = await chromium.launch({
    headless: true,
    timeout: 30000,
  });

  const context = await browser.newContext({
    storageState: storageState || undefined,
    viewport: { width: 1366, height: 768 },
    timeout: 30000,
  });

  const page = await context.newPage();

  try {
    const loginHtml = String(loginBootstrap?.loginHtml || "").trim();
    const fieldTargets = extractLoginFieldTargets(loginHtml);
    let submissionMeta = {
      mode: "synthetic_form",
      submittedFieldNames: [],
      visibleFieldIds: [],
      hiddenTargetIds: [],
    };

    if (loginHtml) {
      const loginRouteUrl = LOGIN_URL;
      await page.route(loginRouteUrl, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: loginHtml,
        });
      });

      await page.goto(loginRouteUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      await page.waitForSelector("#frmSL", { timeout: 10000 });
      const usernameSelector = buildFieldSelector(fieldTargets.username);
      const passwordSelector = buildFieldSelector(fieldTargets.password);
      const captchaSelector = buildFieldSelector(fieldTargets.captcha);
      const canFillVisibleFields = Boolean(usernameSelector && passwordSelector && captchaSelector);

      if (canFillVisibleFields) {
        submissionMeta = {
          mode: "interactive_form",
          submittedFieldNames: [],
          visibleFieldIds: [
            fieldTargets.username?.id || fieldTargets.username?.name || "",
            fieldTargets.password?.id || fieldTargets.password?.name || "",
            fieldTargets.captcha?.id || fieldTargets.captcha?.name || "",
          ].filter(Boolean),
          hiddenTargetIds: [
            loginBootstrap?.credentialAssignments?.username?.targetFieldId,
            loginBootstrap?.credentialAssignments?.password?.targetFieldId,
            ...Object.keys(loginBootstrap?.staticAssignments || {}),
          ].filter(Boolean),
        };
        await page.locator(usernameSelector).first().fill(String(username), { timeout: 3000 });
        await page.locator(passwordSelector).first().fill(String(password), { timeout: 3000 });
        await page.locator(captchaSelector).first().fill(String(captcha), { timeout: 3000 });

        const navigation = page
          .waitForNavigation({
            waitUntil: "domcontentloaded",
            timeout: 15000,
          })
          .catch(() => null);

        if (fieldTargets.hasSubmitButton) {
          await page
            .locator('#frmSL button[type="submit"], #frmSL input[type="submit"], #frmSL button:not([type])')
            .first()
            .click({ timeout: 5000 });
        } else {
          await page.evaluate(() => {
            const form = document.querySelector("#frmSL");
            if (!form) return;
            if (typeof form.requestSubmit === "function") {
              form.requestSubmit();
              return;
            }
            form.submit();
          });
        }

        await navigation;
      } else {
        submissionMeta = {
          mode: "synthetic_form",
          submittedFieldNames: await submitPayloadInBrowser(page, {
            username,
            password,
            captcha,
            loginBootstrap,
          }),
          visibleFieldIds: [],
          hiddenTargetIds: [
            loginBootstrap?.credentialAssignments?.username?.targetFieldId,
            loginBootstrap?.credentialAssignments?.password?.targetFieldId,
            ...Object.keys(loginBootstrap?.staticAssignments || {}),
          ].filter(Boolean),
        };
      }
    } else {
      await page.setContent("<html><body></body></html>", {
        waitUntil: "domcontentloaded",
      });
      submissionMeta = {
        mode: "synthetic_form",
        submittedFieldNames: await submitPayloadInBrowser(page, {
          username,
          password,
          captcha,
          loginBootstrap,
        }),
        visibleFieldIds: [],
        hiddenTargetIds: [
          loginBootstrap?.credentialAssignments?.username?.targetFieldId,
          loginBootstrap?.credentialAssignments?.password?.targetFieldId,
          ...Object.keys(loginBootstrap?.staticAssignments || {}),
        ].filter(Boolean),
      };
    }

    let hasSidebar = false;
    try {
      await page.waitForSelector("#sidebar-menu", { timeout: 12000 });
      hasSidebar = true;
    } catch {
      try {
        await page.waitForLoadState("networkidle", { timeout: 10000 });
      } catch {
        // Some ERP pages keep polling; DOM content is sufficient for cookie/bootstrap capture.
      }
    }

    const html = await page.content();

    return {
      html,
      hasSidebar,
      httpStatus: 200,
      storageState: await context.storageState(),
      finalUrl: page.url(),
      submissionMeta,
    };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function submitLoginViaApi({ storageState, loginBootstrap, username, password, captcha }) {
  const payload = buildLoginPayload({
    username,
    password,
    captcha,
    loginBootstrap,
  });

  const submittedFieldNames = Array.from(new Set(Array.from(payload.keys())));
  const api = await createApiContext(storageState, { referer: LOGIN_URL });
  try {
    const response = await api.post(loginBootstrap?.formAction || LOGIN_POST_URL, {
      form: Object.fromEntries(payload.entries()),
      headers: {
        Referer: LOGIN_URL,
      },
    });

    return {
      html: await response.text(),
      hasSidebar: false,
      httpStatus: response.status(),
      storageState: await api.storageState(),
      finalUrl: typeof response.url === "function" ? response.url() : loginBootstrap?.formAction || LOGIN_POST_URL,
      submissionMeta: {
        mode: "api_form",
        submittedFieldNames,
        visibleFieldIds: [
          loginBootstrap?.sourceFieldIds?.username,
          loginBootstrap?.sourceFieldIds?.password,
          loginBootstrap?.captchaFieldName,
        ].filter(Boolean),
        hiddenTargetIds: [
          loginBootstrap?.credentialAssignments?.username?.targetFieldId,
          loginBootstrap?.credentialAssignments?.password?.targetFieldId,
          ...Object.keys(loginBootstrap?.staticAssignments || {}),
        ].filter(Boolean),
      },
    };
  } finally {
    await api.dispose();
  }
}

async function fetchCaptcha(options = {}) {
  const loginAttemptId =
    String(options?.loginAttemptId || "").trim() || createLoginAttemptId();
  const trace = createLoginAttemptTrace({ loginAttemptId });
  const api = await createApiContext();
  try {
    const bootstrapStartedAt = Date.now();
    const loginResp = await api.get("StudentLoginPage");
    const loginHtml = await loginResp.text();
    const loginBootstrap = {
      ...parseLoginBootstrap(loginHtml),
      loginHtml,
    };
    const storageAfterBootstrap = await api.storageState();
    trace.recordStage({
      stage: "bootstrap_page",
      startedAt: bootstrapStartedAt,
      classifier: "login_page",
      httpStatus: loginResp.status(),
      finalUrl: typeof loginResp.url === "function" ? loginResp.url() : LOGIN_URL,
      storageStateAfter: storageAfterBootstrap,
    });

    const captchaStartedAt = Date.now();
    const captchaResp = await api.get(loginBootstrap.captchaUrl);
    const captchaBuffer = await captchaResp.body();
    const latestStorageState = await api.storageState();

    if (!captchaResp.ok() || !captchaBuffer.length) {
      const error = new Error(
        `ERP captcha fetch failed with status ${captchaResp.status()} from ${loginBootstrap.captchaUrl}`
      );
      error.status = 502;
      trace.recordStage({
        stage: "captcha_fetch",
        startedAt: captchaStartedAt,
        classifier: "unknown_upstream_state",
        httpStatus: captchaResp.status(),
        finalUrl: loginBootstrap.captchaUrl,
        storageStateBefore: storageAfterBootstrap,
        storageStateAfter: latestStorageState,
        error,
      });
      throw error;
    }

    trace.recordStage({
      stage: "captcha_fetch",
      startedAt: captchaStartedAt,
      classifier: "login_page",
      httpStatus: captchaResp.status(),
      finalUrl: loginBootstrap.captchaUrl,
      storageStateBefore: storageAfterBootstrap,
      storageStateAfter: latestStorageState,
    });

    const issuedAt = Date.now();

    return {
      captchaBase64: `data:image/png;base64,${captchaBuffer.toString("base64")}`,
      storageState: latestStorageState,
      loginBootstrap,
      issuedAt,
      expiresInMs: LOGIN_PREAUTH_TTL_MS,
      expiresAt: new Date(issuedAt + LOGIN_PREAUTH_TTL_MS).toISOString(),
      loginAttemptId,
    };
  } finally {
    await api.dispose();
  }
}

function assertFreshPreAuthAttempt(preAuthAttempt, loginAttemptId, nowFn = () => Date.now()) {
  const issuedAt = Number(preAuthAttempt?.issuedAt || 0);
  if (!issuedAt) {
    throw makeAuthError("CAPTCHA_EXPIRED", "Captcha expired. Please refresh and try again.", 401, {
      loginAttemptId,
    });
  }

  const ageMs = Math.max(0, nowFn() - issuedAt);
  if (ageMs > LOGIN_PREAUTH_TTL_MS) {
    throw makeAuthError("CAPTCHA_EXPIRED", "Captcha expired. Please refresh and try again.", 401, {
      loginAttemptId,
      issuedAt,
      expiresInMs: LOGIN_PREAUTH_TTL_MS,
      expiresAt: new Date(issuedAt + LOGIN_PREAUTH_TTL_MS).toISOString(),
    });
  }
}

function buildFailureResult({ storageState, loginAttemptId, classifier, failureCode, status, message }) {
  return {
    success: false,
    storageState,
    loginAttemptId,
    classifier,
    failureCode,
    status,
    message,
  };
}

function classifyPasswordResetInitiateResponse(html = "", httpStatus = 200) {
  const rawHtml = String(html || "");
  const $ = cheerio.load(rawHtml);
  const title = cleanText($("title").first().text()).toLowerCase();
  const hasOtpField =
    $('input[name="passwordotp"]').length > 0 ||
    $('input[id*="otp" i]').length > 0 ||
    /passwordotp/i.test(rawHtml);

  if (/invalid captcha/i.test(rawHtml)) {
    return {
      success: false,
      code: "INVALID_CAPTCHA",
      status: 401,
      message: "Invalid captcha. Please try again.",
    };
  }

  if (httpStatus >= 400) {
    return {
      success: false,
      code: "UPSTREAM_UNAVAILABLE",
      status: httpStatus,
      message: "Password reset initiation failed.",
    };
  }

  if (title.includes("password reset") || hasOtpField) {
    return {
      success: true,
      code: "",
      status: 200,
      message: "OTP sent successfully.",
    };
  }

  if (title.includes("student login")) {
    return {
      success: false,
      code: "PASSWORD_RESET_UNAVAILABLE",
      status: 429,
      message: "Password reset is temporarily unavailable. Please try again later.",
    };
  }

  return {
    success: false,
    code: "PASSWORD_RESET_FAILED",
    status: 502,
    message: "Unable to start password reset. Please try again.",
  };
}

async function ensureLoginBootstrap(storageState, loginBootstrap) {
  if (loginBootstrap) return loginBootstrap;

  const bootstrapApi = await createApiContext(storageState, { referer: LOGIN_URL });
  try {
    const loginPageResp = await bootstrapApi.get("StudentLoginPage");
    const loginHtml = await loginPageResp.text();
    return {
      ...parseLoginBootstrap(loginHtml),
      loginHtml,
    };
  } finally {
    await bootstrapApi.dispose();
  }
}

async function initiatePasswordReset({
  storageState,
  loginBootstrap,
  preAuthAttempt,
  username,
  captcha,
}) {
  const loginAttemptId =
    String(preAuthAttempt?.loginAttemptId || "").trim() || createLoginAttemptId();
  assertFreshPreAuthAttempt(preAuthAttempt, loginAttemptId);

  const activeBootstrap = await ensureLoginBootstrap(storageState, loginBootstrap);
  const payload = buildLoginPayload({
    username: String(username || "").trim().toUpperCase(),
    password: "",
    captcha: String(captcha || "").trim(),
    loginBootstrap: activeBootstrap,
  });

  const api = await createApiContext(storageState, { referer: LOGIN_URL });
  try {
    const response = await api.post("StudentPasswordResetInitiate", {
      form: Object.fromEntries(payload.entries()),
      headers: {
        Referer: LOGIN_URL,
      },
    });

    const html = await response.text();
    const classification = classifyPasswordResetInitiateResponse(html, response.status());
    return {
      ...classification,
      storageState: await api.storageState(),
      loginAttemptId,
    };
  } finally {
    await api.dispose();
  }
}

async function completePasswordReset({ username, otp, newPassword }) {
  const validationMessage = validatePasswordResetPassword(newPassword);
  if (validationMessage) {
    const error = new Error(validationMessage);
    error.status = 422;
    error.code = "INVALID_PASSWORD";
    throw error;
  }

  const api = await createApiContext(null, { referer: LOGIN_URL });
  try {
    const response = await api.post("usermanager/loginmanager/loginmanagerresources.jsp", {
      form: {
        cpassword: String(newPassword || ""),
        ids: "1",
        txtUserName: String(username || "").trim().toUpperCase(),
        passwordotp: String(otp || "").trim(),
      },
      headers: {
        Referer: LOGIN_URL,
      },
    });

    const raw = await response.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    const resultStatus = String(data?.resultstatus ?? "").trim();
    if (resultStatus === "1") {
      return {
        success: true,
        status: response.status(),
        message: "Password changed successfully.",
        data,
      };
    }

    return {
      success: false,
      status: 401,
      code: "INVALID_OTP",
      message: "Invalid OTP. Please try again.",
      data,
    };
  } finally {
    await api.dispose();
  }
}

async function finalizeAuthenticatedLogin({
  storageState,
  username,
  finalUrl,
  loginAttemptId,
  trace,
  probeProfileFn,
}) {
  const profileStartedAt = Date.now();
  const profileAttempt = await probeProfileFn(storageState, finalUrl);
  trace.recordStage({
    stage: "profile_probe",
    startedAt: profileStartedAt,
    classifier: profileAttempt.classifier,
    finalUrl: profileAttempt.finalUrl || finalUrl,
    storageStateBefore: storageState,
    storageStateAfter: profileAttempt.storageState,
    error: profileAttempt.error || null,
    artifactPayload:
      profileAttempt.profileStatus !== "ready"
        ? {
            html: profileAttempt.rawHtml || "",
            finalUrl: profileAttempt.finalUrl || finalUrl,
            classifier: profileAttempt.classifier,
          }
        : null,
  });

  if (profileAttempt.profileStatus === "ready") {
    return {
      success: true,
      storageState: profileAttempt.storageState,
      profileData: profileAttempt.profileData,
      profileStatus: "ready",
      loginAttemptId,
    };
  }

  return {
    success: true,
    storageState: profileAttempt.storageState,
    profileStatus: "deferred",
    loginAttemptId,
  };
}

async function loginWithCaptcha(
  { storageState, username, password, captcha, loginBootstrap, preAuthAttempt, sessionId = "" },
  overrides = {}
) {
  const deps = {
    submitLoginViaApiFn: overrides.submitLoginViaApiFn || submitLoginViaApi,
    submitLoginInBrowserFn: overrides.submitLoginInBrowserFn || submitLoginInBrowser,
    verifyAuthenticatedShellFn:
      overrides.verifyAuthenticatedShellFn || verifyAuthenticatedShellFromStorageState,
    probeProfileFn: overrides.probeProfileFn || probeProfileFromStorageState,
    traceFactory: overrides.traceFactory || createLoginAttemptTrace,
    nowFn: overrides.nowFn || (() => Date.now()),
  };
  const loginAttemptId =
    String(preAuthAttempt?.loginAttemptId || "").trim() || createLoginAttemptId();
  const trace = deps.traceFactory({
    loginAttemptId,
    sessionId,
    secrets: [username, password, captcha],
  });

  assertFreshPreAuthAttempt(preAuthAttempt, loginAttemptId, deps.nowFn);

  let activeBootstrap = loginBootstrap || null;
  if (!activeBootstrap) {
    const bootstrapApi = await createApiContext(storageState, { referer: LOGIN_URL });
    try {
      const bootstrapStartedAt = Date.now();
      const loginPageResp = await bootstrapApi.get("StudentLoginPage");
      const loginHtml = await loginPageResp.text();
      activeBootstrap = {
        ...parseLoginBootstrap(loginHtml),
        loginHtml,
      };
      trace.recordStage({
        stage: "bootstrap_page",
        startedAt: bootstrapStartedAt,
        classifier: "login_page",
        httpStatus: loginPageResp.status(),
        finalUrl: typeof loginPageResp.url === "function" ? loginPageResp.url() : LOGIN_URL,
        storageStateBefore: storageState,
        storageStateAfter: await bootstrapApi.storageState(),
      });
    } finally {
      await bootstrapApi.dispose();
    }
  }

  const normalizedAuth = {
    storageState,
    loginBootstrap: activeBootstrap,
    username: String(username),
    password: String(password),
    captcha: String(captcha),
  };

  const attempts = [];
  let latestStorageState = storageState;
  let observedUpstreamState = false;

  try {
    const submitStartedAt = Date.now();
    const apiLoginResult = await deps.submitLoginViaApiFn(normalizedAuth);
    latestStorageState = apiLoginResult.storageState;
    const submitClassification = classifyLoginResponse(apiLoginResult.html, {
      hasSidebar: apiLoginResult.hasSidebar,
      finalUrl: apiLoginResult.finalUrl,
    });
    observedUpstreamState = true;
    trace.recordStage({
      stage: "direct_submit",
      startedAt: submitStartedAt,
      classifier: submitClassification.classifier,
      httpStatus: apiLoginResult.httpStatus,
      finalUrl: apiLoginResult.finalUrl,
      storageStateBefore: storageState,
      storageStateAfter: apiLoginResult.storageState,
      artifactPayload:
        submitClassification.classifier === "authenticated_shell"
          ? null
          : {
              html: apiLoginResult.html,
              finalUrl: apiLoginResult.finalUrl,
              httpStatus: apiLoginResult.httpStatus,
              submissionMeta: apiLoginResult.submissionMeta,
            },
    });

    if (submitClassification.failureCode) {
      trace.finish({
        outcome: "failure",
        statusCode: submitClassification.status,
        errorCode: submitClassification.failureCode,
        classifier: submitClassification.classifier,
      });
      return buildFailureResult({
        storageState: latestStorageState,
        loginAttemptId,
        classifier: submitClassification.classifier,
        failureCode: submitClassification.failureCode,
        status: submitClassification.status,
        message: submitClassification.message,
      });
    }

    if (submitClassification.authenticated) {
      const loginResult = await finalizeAuthenticatedLogin({
        storageState: apiLoginResult.storageState,
        username,
        finalUrl: apiLoginResult.finalUrl,
        loginAttemptId,
        trace,
        probeProfileFn: deps.probeProfileFn,
      });
      trace.finish({
        outcome: "success",
        statusCode: 200,
        profileStatus: loginResult.profileStatus,
        classifier: submitClassification.classifier,
      });
      return loginResult;
    }

    const verifyStartedAt = Date.now();
    const directVerification = await deps.verifyAuthenticatedShellFn(apiLoginResult.storageState);
    latestStorageState = directVerification.storageState || latestStorageState;
    observedUpstreamState = true;
    trace.recordStage({
      stage: "auth_verification",
      startedAt: verifyStartedAt,
      classifier: directVerification.classifier,
      httpStatus: directVerification.httpStatus,
      finalUrl: directVerification.finalUrl,
      storageStateBefore: apiLoginResult.storageState,
      storageStateAfter: latestStorageState,
      artifactPayload:
        directVerification.authenticated
          ? null
          : {
              html: directVerification.html || "",
              finalUrl: directVerification.finalUrl,
              httpStatus: directVerification.httpStatus,
            },
    });

    if (directVerification.authenticated) {
      const loginResult = await finalizeAuthenticatedLogin({
        storageState: latestStorageState,
        username,
        finalUrl: directVerification.finalUrl,
        loginAttemptId,
        trace,
        probeProfileFn: deps.probeProfileFn,
      });
      trace.finish({
        outcome: "success",
        statusCode: 200,
        profileStatus: loginResult.profileStatus,
        classifier: directVerification.classifier,
      });
      return loginResult;
    }

    attempts.push(`direct submit could not verify auth (${directVerification.classifier})`);
  } catch (error) {
    attempts.push(`direct submit failed: ${error.message || "Unknown direct submit error"}`);
  }

  try {
    const browserStartedAt = Date.now();
    const browserLoginResult = await deps.submitLoginInBrowserFn(normalizedAuth);
    latestStorageState = browserLoginResult.storageState;
    const browserClassification = classifyLoginResponse(browserLoginResult.html, {
      hasSidebar: browserLoginResult.hasSidebar,
      finalUrl: browserLoginResult.finalUrl,
      httpStatus: browserLoginResult.httpStatus,
    });
    observedUpstreamState = true;
    trace.recordStage({
      stage: "browser_submit",
      startedAt: browserStartedAt,
      classifier: browserClassification.classifier,
      httpStatus: browserLoginResult.httpStatus,
      finalUrl: browserLoginResult.finalUrl,
      storageStateBefore: storageState,
      storageStateAfter: browserLoginResult.storageState,
      artifactPayload:
        browserClassification.classifier === "authenticated_shell"
          ? null
          : {
              html: browserLoginResult.html,
              finalUrl: browserLoginResult.finalUrl,
              submissionMeta: browserLoginResult.submissionMeta,
            },
    });

    if (browserClassification.failureCode) {
      trace.finish({
        outcome: "failure",
        statusCode: browserClassification.status,
        errorCode: browserClassification.failureCode,
        classifier: browserClassification.classifier,
      });
      return buildFailureResult({
        storageState: latestStorageState,
        loginAttemptId,
        classifier: browserClassification.classifier,
        failureCode: browserClassification.failureCode,
        status: browserClassification.status,
        message: browserClassification.message,
      });
    }

    if (browserClassification.authenticated) {
      const loginResult = await finalizeAuthenticatedLogin({
        storageState: browserLoginResult.storageState,
        username,
        finalUrl: browserLoginResult.finalUrl,
        loginAttemptId,
        trace,
        probeProfileFn: deps.probeProfileFn,
      });
      trace.finish({
        outcome: "success",
        statusCode: 200,
        profileStatus: loginResult.profileStatus,
        classifier: browserClassification.classifier,
      });
      return loginResult;
    }

    const verifyStartedAt = Date.now();
    const browserVerification = await deps.verifyAuthenticatedShellFn(browserLoginResult.storageState);
    latestStorageState = browserVerification.storageState || latestStorageState;
    observedUpstreamState = true;
    trace.recordStage({
      stage: "auth_verification",
      startedAt: verifyStartedAt,
      classifier: browserVerification.classifier,
      httpStatus: browserVerification.httpStatus,
      finalUrl: browserVerification.finalUrl,
      storageStateBefore: browserLoginResult.storageState,
      storageStateAfter: latestStorageState,
      artifactPayload:
        browserVerification.authenticated
          ? null
          : {
              html: browserVerification.html || "",
              finalUrl: browserVerification.finalUrl,
              httpStatus: browserVerification.httpStatus,
            },
    });

    if (browserVerification.authenticated) {
      const loginResult = await finalizeAuthenticatedLogin({
        storageState: latestStorageState,
        username,
        finalUrl: browserVerification.finalUrl,
        loginAttemptId,
        trace,
        probeProfileFn: deps.probeProfileFn,
      });
      trace.finish({
        outcome: "success",
        statusCode: 200,
        profileStatus: loginResult.profileStatus,
        classifier: browserVerification.classifier,
      });
      return loginResult;
    }

    attempts.push(`browser submit could not verify auth (${browserVerification.classifier})`);
  } catch (error) {
    attempts.push(`browser submit failed: ${error.message || "Unknown browser submit error"}`);
  }

  const combined = makeAuthError(
    observedUpstreamState ? "LOGIN_VERIFICATION_FAILED" : "UPSTREAM_UNAVAILABLE",
    observedUpstreamState
      ? "Unable to verify ERP login. Please refresh captcha and try again."
      : "ERP login is temporarily unavailable. Please try again.",
    502,
    {
      loginAttemptId,
      attempts,
    }
  );
  trace.finish({
    outcome: "failure",
    statusCode: combined.status,
    errorCode: combined.code,
    classifier: observedUpstreamState ? "unknown_upstream_state" : "upstream_unavailable",
  });
  throw combined;
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
  createApiContext,
  fetchCaptcha,
  loginWithCaptcha,
  initiatePasswordReset,
  completePasswordReset,
  validatePasswordResetPassword,
  callEndpointViaApi,
  fetchProfileViaApi,
  submitAttendanceCodeViaApi,
  isUsableProfileData,
  buildFallbackProfileData,
  extractLoginFieldTargets,
  parseLoginBootstrap,
  buildLoginPayload,
  classifyLoginResponse,
  isErpSessionExpiredResponse,
  makeSessionExpiredError,
  setCaptureDir,
  redactSensitiveText: require("./loginDiagnostics").redactSensitiveText,
  sanitizeArtifactPayload: require("./loginDiagnostics").sanitizeArtifactPayload,
};
