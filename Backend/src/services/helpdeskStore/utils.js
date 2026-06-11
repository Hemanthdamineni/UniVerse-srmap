const {
  TICKET_STATUS,
  QUEUE_STATE,
  DEFAULT_PAGE_SIZE,
} = require("./constants");

function nowIso() {
  return new Date().toISOString();
}

function toSafeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePriority(value) {
  const normalized = toSafeString(value).toLowerCase();
  if (["low", "medium", "high", "urgent"].includes(normalized)) {
    return normalized;
  }
  return "medium";
}

function normalizeStatus(value) {
  const normalized = toSafeString(value).toLowerCase();
  if (Object.values(TICKET_STATUS).includes(normalized)) {
    return normalized;
  }
  return TICKET_STATUS.OPEN;
}

function normalizeQueue(value) {
  const normalized = toSafeString(value).toLowerCase();
  if (Object.values(QUEUE_STATE).includes(normalized)) return normalized;
  return "";
}

function normalizePagination({ limit, offset } = {}) {
  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);
  return {
    limit:
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(Math.floor(parsedLimit), 100)
        : DEFAULT_PAGE_SIZE,
    offset:
      Number.isFinite(parsedOffset) && parsedOffset > 0
        ? Math.floor(parsedOffset)
        : 0,
  };
}

function addHours(isoValue, hours) {
  const start = new Date(isoValue).getTime();
  const base = Number.isFinite(start) ? start : Date.now();
  return new Date(base + Number(hours || 0) * 36e5).toISOString();
}

module.exports = {
  nowIso,
  toSafeString,
  ensureArray,
  normalizePriority,
  normalizeStatus,
  normalizeQueue,
  normalizePagination,
  addHours,
};
