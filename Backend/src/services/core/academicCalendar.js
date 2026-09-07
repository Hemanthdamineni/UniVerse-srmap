/**
 * academicCalendar.js — the single reader for `data/academicCalendar.json`.
 *
 * The file is a static SRM AP calendar: `oddSemesterData` / `evenSemesterData`
 * / `summerTermData` arrays of `{ id, details, date, day }` rows where `date`
 * is `"DD.MM.YYYY"` or `"DD.MM.YYYY - DD.MM.YYYY"`.
 *
 *   - `listAcademicMilestones()` — every dated row as `{ id, title, dueAt }`
 *     (used by the unified deadline timeline).
 *   - `listExamWindows({ now })` — just the assessment rows (mid-term, end-term,
 *     practicals, CLA mark-entry deadlines) as `{ title, kind, startAt, endAt }`,
 *     so the revision scheduler can pull revision forward to land before a real
 *     exam (B7 / T4.5.1).
 *
 * @module core/academicCalendar
 */

const fs = require("fs");
const path = require("path");

const ACADEMIC_CALENDAR_FILE = path.join(__dirname, "..", "..", "data", "academicCalendar.json");

/** `"DD.MM.YYYY"` → ISO at 23:59 UTC, or null. */
function parseDdMmYyyy(value) {
  const m = String(value || "").trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 23, 59));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * `"DD.MM.YYYY"` or `"DD.MM.YYYY - DD.MM.YYYY"` → `{ startAt, endAt }` (ISO).
 * A single date yields `startAt === endAt`. Returns null when nothing parses.
 */
function parseAcademicDateRange(value) {
  const parts = String(value || "")
    .split(/\s*[-–—]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const start = parseDdMmYyyy(parts[0]);
  const end = parts.length > 1 ? parseDdMmYyyy(parts[parts.length - 1]) : start;
  if (!start && !end) return null;
  return { startAt: start || end, endAt: end || start };
}

let cachedRaw;
function loadAcademicCalendar() {
  if (cachedRaw !== undefined) return cachedRaw;
  try {
    cachedRaw = JSON.parse(fs.readFileSync(ACADEMIC_CALENDAR_FILE, "utf8"));
  } catch {
    cachedRaw = null;
  }
  return cachedRaw;
}

/** For tests — drop the memoised file read. */
function _resetCache() {
  cachedRaw = undefined;
}

function semesterRows() {
  const raw = loadAcademicCalendar() || {};
  return [
    ...(Array.isArray(raw.oddSemesterData) ? raw.oddSemesterData : []),
    ...(Array.isArray(raw.evenSemesterData) ? raw.evenSemesterData : []),
    ...(Array.isArray(raw.summerTermData) ? raw.summerTermData : []),
  ];
}

/** Every dated milestone, `dueAt` = end of the (range's) last day. */
function listAcademicMilestones() {
  return semesterRows()
    .map((r) => {
      const range = parseAcademicDateRange(r.date);
      return {
        id: `cal:${r.id ?? r.details}`,
        title: String(r.details || "Academic milestone"),
        dueAt: range ? range.endAt : null,
        link: null,
        source: "academic-calendar",
      };
    })
    .filter((r) => r.dueAt);
}

/** Classify an assessment row from its `details` text, or null if it isn't one. */
function examKind(details) {
  const text = String(details || "").toLowerCase();
  if (/\benter\s+cla-\d+\s+marks\b/.test(text)) return "cla";
  if (/practical\s+examination/.test(text)) return "practical";
  if (/mid[-\s]?term\s+exam/.test(text) || /midterm\s+exam/.test(text)) return "midterm";
  if (/end[-\s]?term\s+examination/.test(text) || /summer\s+term\s+examination/.test(text)) return "endterm";
  return null;
}

/**
 * Assessment windows only, sorted by start. Pass `now` (epoch ms or ISO) to
 * drop windows that have already ended.
 *
 * @param {{ now?: number|string }} [opts]
 * @returns {Array<{ title: string, kind: string, startAt: string, endAt: string }>}
 */
function listExamWindows({ now } = {}) {
  const cutoff = now == null ? null : typeof now === "number" ? now : Date.parse(now);
  return semesterRows()
    .map((r) => {
      const kind = examKind(r.details);
      if (!kind) return null;
      const range = parseAcademicDateRange(r.date);
      if (!range) return null;
      return { title: String(r.details).trim(), kind, startAt: range.startAt, endAt: range.endAt };
    })
    .filter(Boolean)
    .filter((w) => cutoff == null || Date.parse(w.endAt) >= cutoff)
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

module.exports = {
  parseDdMmYyyy,
  parseAcademicDateRange,
  loadAcademicCalendar,
  listAcademicMilestones,
  listExamWindows,
  examKind,
  _resetCache,
};
