const crypto = require("crypto");
const path = require("path");

const RESOURCE_TYPES = new Set(["link", "file", "note", "quiz", "flashcard", "pyq"]);
const ROADMAP_NODE_TYPES = new Set(["concept", "resource", "quiz", "milestone"]);
const DIFFICULTY_LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const QUESTION_DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const EXAM_TYPES = new Set(["mid-semester", "end-semester", "supplementary", "model"]);

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix = "") {
  const value = crypto.randomUUID();
  return prefix ? `${prefix}_${value}` : value;
}

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toNullableString(value) {
  const normalized = toSafeString(value);
  return normalized || null;
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableInteger(value) {
  const normalized = toSafeString(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function ensureObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function parseJson(value, fallback = null) {
  const normalized = toSafeString(value);
  if (!normalized) return fallback;
  try {
    return JSON.parse(normalized);
  } catch {
    return fallback;
  }
}

function stringifyJson(value, fallback = "[]") {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function normalizeUnit(unit) {
  return toSafeString(unit)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTagList(tags) {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map((tag) => toSafeString(tag)).filter(Boolean))];
  }
  if (typeof tags === "string") {
    return normalizeTagList(
      tags
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );
  }
  return [];
}

function normalizePathSegment(value, fallback = "misc") {
  const normalized = toSafeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function createHttpError(status, message, code = "") {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function assertCondition(condition, status, message, code = "") {
  if (!condition) {
    throw createHttpError(status, message, code);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function startOfDayIso(date = new Date()) {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy.toISOString();
}

function addDaysIso(isoValue, days) {
  const date = new Date(isoValue);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function recencyScore(isoValue) {
  const createdAt = new Date(isoValue).getTime();
  if (!Number.isFinite(createdAt)) return 0;
  const ageDays = Math.max(0, (Date.now() - createdAt) / (24 * 60 * 60 * 1000));
  return 1 / (1 + ageDays / 30);
}

function buildFileStoragePath(rootDir, subjectCode, type, originalName = "") {
  const ext = path.extname(originalName || "").slice(0, 12).replace(/[^a-zA-Z0-9.]/g, "");
  const fileName = `${Date.now()}-${crypto.randomUUID()}${ext || ""}`;
  return path.join(
    rootDir,
    normalizePathSegment(subjectCode, "subject"),
    normalizePathSegment(type, "file"),
    fileName
  );
}

function safeParseStructuredContent(value) {
  if (value && typeof value === "object") return value;
  return parseJson(value, null);
}

function toBooleanInteger(value) {
  return value ? 1 : 0;
}

module.exports = {
  RESOURCE_TYPES,
  ROADMAP_NODE_TYPES,
  DIFFICULTY_LEVELS,
  QUESTION_DIFFICULTIES,
  EXAM_TYPES,
  nowIso,
  randomId,
  toSafeString,
  toNullableString,
  toInteger,
  toNullableInteger,
  toNumber,
  ensureArray,
  ensureObject,
  parseJson,
  stringifyJson,
  normalizeUnit,
  normalizeTagList,
  normalizePathSegment,
  createHttpError,
  assertCondition,
  clamp,
  startOfDayIso,
  addDaysIso,
  recencyScore,
  buildFileStoragePath,
  safeParseStructuredContent,
  toBooleanInteger,
};
