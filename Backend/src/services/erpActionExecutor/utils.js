const { BASE_PATH } = require("../../config/env");
const { normalizeMutationUrl } = require("../erpUiMapStore");

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function makeError(message, status = 400, code = "BAD_REQUEST") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeExpectedUrl(url) {
  const normalized = normalizeMutationUrl(url);
  if (!normalized) return "";

  const basePath = cleanText(BASE_PATH).replace(/^\/+/, "").replace(/\/+$/, "");
  if (basePath && normalized.toLowerCase().startsWith(`${basePath.toLowerCase()}/`)) {
    return normalized.slice(basePath.length + 1);
  }

  return normalized;
}

function extractMessageFromResponse(raw, fallback = "Action executed") {
  const text = cleanText(raw);
  if (!text) return fallback;

  if (/otp/i.test(text) && /send|sent|verify|verification/i.test(text)) {
    return "OTP request submitted";
  }

  if (/attendance/i.test(text) && /success|accepted|marked/i.test(text)) {
    return "Attendance submitted";
  }

  if (/success|submitted|saved|updated/i.test(text)) {
    return text.slice(0, 160);
  }

  return fallback;
}

function extractStudentId(profileData) {
  const table = profileData?.TableContent || {};
  for (const [key, value] of Object.entries(table)) {
    if (!/student\s*id|\bstu\s*id\b/i.test(String(key || ""))) continue;
    const match = String(value || "").match(/\b(\d{3,})\b/);
    if (match) return match[1];
  }
  return "";
}

function parseExamMonthValue(rawValue) {
  const parts = String(rawValue || "")
    .split(",")
    .map((part) => cleanText(part))
    .filter(Boolean);
  if (parts.length < 3) return null;
  const [examMonth, examYear, sid] = parts;
  if (!examMonth || !examYear || !sid) return null;
  return { examMonth, examYear, sid };
}

function selectFieldValue(field, payload) {
  const fieldName = cleanText(field?.name);
  const fieldId = cleanText(field?.id);

  if (fieldName && Object.prototype.hasOwnProperty.call(payload, fieldName)) {
    return payload[fieldName];
  }
  if (fieldId && Object.prototype.hasOwnProperty.call(payload, fieldId)) {
    return payload[fieldId];
  }

  const explicitValue = cleanText(field?.value);
  if (explicitValue) return explicitValue;

  if (cleanText(field?.type).toLowerCase() === "select" && Array.isArray(field?.options)) {
    const selected = field.options.find((option) => option?.selected) || field.options[0];
    const value = cleanText(selected?.value);
    if (value) return value;
  }

  return "";
}

function shouldIncludeHtml(action, url, contentType) {
  const label = cleanText(action?.label).toLowerCase();
  const endpoint = normalizeExpectedUrl(url).toLowerCase();
  const normalizedType = cleanText(contentType).toLowerCase();

  if (normalizedType.includes("text/html")) return true;
  if (action?.kind === "local-print" || action?.kind === "table-row-action") return true;
  if (label.includes("print")) return true;
  if (endpoint.includes("studentsonlinepaymentresponse.jsp")) return true;
  if (endpoint.includes("printstudentexamapplication.jsp")) return true;
  return false;
}

module.exports = {
  cleanText,
  makeError,
  normalizeExpectedUrl,
  extractMessageFromResponse,
  extractStudentId,
  parseExamMonthValue,
  selectFieldValue,
  shouldIncludeHtml,
};
