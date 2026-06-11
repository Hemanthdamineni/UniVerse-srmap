const { createHash } = require("crypto");
const { FEEDBACK_TYPES, MODERATION_STATUS } = require("./constants");

function nowIso() {
  return new Date().toISOString();
}

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeType(type) {
  const normalized = toSafeString(type).toLowerCase().replace(/-/g, "_");
  if (Object.values(FEEDBACK_TYPES).includes(normalized)) return normalized;
  const error = new Error("Unsupported campus feedback type");
  error.status = 400;
  throw error;
}

function normalizeStatus(status) {
  const normalized = toSafeString(status).toLowerCase();
  if (Object.values(MODERATION_STATUS).includes(normalized)) return normalized;
  const error = new Error("Unsupported moderation status");
  error.status = 400;
  throw error;
}

function normalizePagination({ limit, offset } = {}) {
  const normalizedLimit = Number(limit);
  const normalizedOffset = Number(offset);
  return {
    limit:
      Number.isFinite(normalizedLimit) && normalizedLimit > 0
        ? Math.min(Math.floor(normalizedLimit), 100)
        : 50,
    offset:
      Number.isFinite(normalizedOffset) && normalizedOffset > 0
        ? Math.floor(normalizedOffset)
        : 0,
  };
}

function normalizeRatings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const error = new Error("ratings object is required");
    error.status = 400;
    throw error;
  }

  const ratings = {};
  for (const [key, rawRating] of Object.entries(value)) {
    const label = toSafeString(key);
    const rating = Number(rawRating);
    if (!label) continue;
    if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
      const error = new Error("ratings must be numbers between 0 and 5");
      error.status = 400;
      throw error;
    }
    ratings[label] = Math.round(rating);
  }

  if (!Object.values(ratings).some((rating) => rating > 0)) {
    const error = new Error("At least one rating is required");
    error.status = 400;
    throw error;
  }

  return ratings;
}

function buildDedupeKey({ type, targetLabel, userId, ratings, comment }) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        type,
        targetLabel: toSafeString(targetLabel).toLowerCase(),
        userId: toSafeString(userId).toLowerCase(),
        ratings,
        comment: toSafeString(comment).toLowerCase(),
      })
    )
    .digest("hex");
}

module.exports = {
  nowIso,
  toSafeString,
  ensureArray,
  parseJson,
  normalizeType,
  normalizeStatus,
  normalizePagination,
  normalizeRatings,
  buildDedupeKey,
};
