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

const DAY_MS = 86_400_000;

/** `[{ label, startAt, endAt }]` — the teaching window of each term, sorted. */
function listTeachingTerms() {
  const raw = loadAcademicCalendar() || {};
  const groups = [
    ["Odd semester", raw.oddSemesterData],
    ["Even semester", raw.evenSemesterData],
    ["Summer term", raw.summerTermData],
  ];
  const terms = [];
  for (const [label, rows] of groups) {
    if (!Array.isArray(rows)) continue;
    const commencement = rows.find((r) => /commencement of classes/i.test(r?.details || ""));
    const lastTeaching = rows.find((r) => /last day of teaching/i.test(r?.details || ""));
    const startAt = commencement && parseAcademicDateRange(commencement.date)?.startAt;
    const endAt =
      (lastTeaching && parseAcademicDateRange(lastTeaching.date)?.endAt) ||
      // Summer term has no explicit "last day of teaching" — fall back to the
      // day before its exam window.
      (() => {
        const exam = rows.find((r) => examKind(r?.details) === "endterm");
        const s = exam && parseAcademicDateRange(exam.date)?.startAt;
        return s ? new Date(Date.parse(s) - DAY_MS).toISOString() : null;
      })();
    if (startAt && endAt) terms.push({ label, startAt, endAt });
  }
  return terms.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

/**
 * Where the student is in the current teaching term (B6 / T4.1.3).
 *
 * @param {{ now?: number|string }} [opts]
 * @returns {{
 *   inTerm: boolean, label: string|null,
 *   startAt: string|null, lastTeachingDay: string|null,
 *   elapsedFraction: number, daysRemaining: number, weeksRemaining: number
 * }}
 */
function termProgress({ now } = {}) {
  const nowMs = now == null ? Date.now() : typeof now === "number" ? now : Date.parse(now);
  const terms = listTeachingTerms();
  const empty = {
    inTerm: false,
    label: null,
    startAt: null,
    lastTeachingDay: null,
    elapsedFraction: 0,
    daysRemaining: 0,
    weeksRemaining: 0,
  };
  if (terms.length === 0) return empty;

  const current =
    terms.find((t) => nowMs >= Date.parse(t.startAt) && nowMs <= Date.parse(t.endAt)) || null;
  if (!current) {
    // Between terms — surface the next one's start so the UI can say "term
    // hasn't started" rather than projecting off nothing.
    const next = terms.find((t) => Date.parse(t.startAt) > nowMs) || null;
    return next
      ? { ...empty, label: next.label, startAt: next.startAt, lastTeachingDay: next.endAt }
      : empty;
  }

  const startMs = Date.parse(current.startAt);
  const endMs = Date.parse(current.endAt);
  const span = Math.max(1, endMs - startMs);
  const daysRemaining = Math.max(0, Math.ceil((endMs - nowMs) / DAY_MS));
  return {
    inTerm: true,
    label: current.label,
    startAt: current.startAt,
    lastTeachingDay: current.endAt,
    elapsedFraction: Math.min(1, Math.max(0, (nowMs - startMs) / span)),
    daysRemaining,
    weeksRemaining: Math.ceil(daysRemaining / 7),
  };
}

module.exports = {
  parseDdMmYyyy,
  parseAcademicDateRange,
  loadAcademicCalendar,
  listAcademicMilestones,
  listExamWindows,
  listTeachingTerms,
  termProgress,
  examKind,
  _resetCache,
};
