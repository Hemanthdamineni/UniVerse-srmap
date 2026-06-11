const DEFAULT_MAX_RESUBMISSIONS = 5;

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isAllowedSubmissionMime(mimeType = "") {
  const allowed = new Set([
    "application/pdf",
    "application/zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/markdown",
  ]);
  return allowed.has(String(mimeType || "").toLowerCase());
}

function toFiniteNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeRound(roundLike) {
  if (!roundLike || typeof roundLike !== "object") return null;
  const round = { ...roundLike };
  round.roundId = String(round.roundId || "").trim();
  if (!round.roundId) return null;
  round.maxResubmissions = Math.max(
    1,
    toFiniteNumber(round.maxResubmissions, DEFAULT_MAX_RESUBMISSIONS)
  );
  round.maxFileSizeMb = Math.max(1, toFiniteNumber(round.maxFileSizeMb, 25));
  round.resultsPublished = Boolean(round.resultsPublished);
  round.submissionTypes = Array.isArray(round.submissionTypes)
    ? round.submissionTypes.map((item) => String(item))
    : ["file", "link"];
  round.evaluationCriteria = Array.isArray(round.evaluationCriteria)
    ? round.evaluationCriteria.map((criterion) => ({
        label: String(criterion?.label || "").trim(),
        maxScore: Math.max(0, toFiniteNumber(criterion?.maxScore, 0)),
      }))
    : [];
  return round;
}

function isRoundOpen(round) {
  const start = new Date(round?.startTime || "").getTime();
  if (!Number.isFinite(start)) return true;
  return Date.now() >= start;
}

function hasColumn(db, tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

module.exports = {
  DEFAULT_MAX_RESUBMISSIONS,
  nowIso,
  safeJsonParse,
  isAllowedSubmissionMime,
  toFiniteNumber,
  normalizeRound,
  isRoundOpen,
  hasColumn,
};
