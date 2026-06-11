const cheerio = require("cheerio");
const { LOGIN_URL, LOGIN_POST_URL } = require("../../config/env");

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

module.exports = {
  resolveLoginUrl,
  parseLoginBootstrap,
  extractLoginFieldTargets,
  buildFieldSelector,
  buildLoginPayload,
};
