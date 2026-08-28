/**
 * Targeted extractor for Timetable pages.
 *
 * SRM timetable HTML structure:
 *   - `#tblClassTimetable`: period grid
 *     - Row 0 (timetablehead): period numbers (1,2,3...8)
 *     - Row 1 (subheader): time slots ("09:00 To 09:50", ...)
 *     - Rows 2+: day rows — first TD is day name (subheader class), rest are period slots
 *       Each slot TD has `title="SUBJECT NAME"` and text `CODE(ROOM)`
 *
 *   - `#tblSubjectList`: subject details
 *     - Row 0 (subheader): "Subjects Description | L-T-P-C | Faculty Name | Class Room Name"
 *     - Data rows: 5 TDs — code | description | ltpc | faculty | classroom
 *
 * @module erpExtractors/extractTimetable
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

/** ERP data-entry casing is inconsistent ("Cse 457"); codes render uppercase. */
function normalizeCourseCode(code) {
  return String(code || "").replace(/\s+/g, " ").trim().toUpperCase();
}

/** ERP appends pure-digit employee IDs: "Dr Ravi Kant Kumar (19073)" → "Dr Ravi Kant Kumar". */
function normalizeFacultyLabel(faculty) {
  return String(faculty || "")
    .replace(/\(\s*\d+\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ERP packs multiple rooms into adjacent parens: "(C 302)(c 507)" → "C 302, C 507".
 * Single-letter room prefixes are uppercased; non-paren values pass through untouched.
 */
function normalizeClassroomList(classroom) {
  const raw = String(classroom || "").trim();
  if (!raw) return "";
  const rooms = [];
  const parenPattern = /\(([^)]+)\)/g;
  let match;
  while ((match = parenPattern.exec(raw)) !== null) {
    rooms.push(match[1].trim());
  }
  if (rooms.length === 0) return raw;
  return rooms
    .map((room) =>
      room.replace(/^([a-z])\s*(\d+)$/i, (_m, letter, digits) => `${letter.toUpperCase()} ${digits}`)
    )
    .join(", ");
}

/**
 * @param {string} html - Raw HTML from the SRM timetable page
 * @returns {import("./types").TimetableData}
 */
function extractTimetable(html) {
  const $ = cheerio.load(html || "");

  const title = cleanText($("h2").first().text()) || "TIME TABLE";

  // --- Time headers from the subheader row ---
  const timeSlots = [];
  const timetableGrid = $("#tblClassTimetable").length
    ? $("#tblClassTimetable")
    : $("table").first();

  const subheaderRow = timetableGrid.find("tr.subheader").first();
  subheaderRow.find("td").each((_idx, cell) => {
    const text = cleanText($(cell).text());
    // Skip the empty day-name column
    if (text && /\d/.test(text) && text.includes("To")) {
      timeSlots.push(text);
    }
  });

  // --- Schedule grid ---
  const schedule = [];
  timetableGrid.find("tr").each((_idx, rowEl) => {
    const row = $(rowEl);
    // Skip header/subheader rows
    if (row.hasClass("timetablehead") || row.hasClass("subheader")) return;

    const cells = row.find("td");
    if (cells.length < 2) return;

    // First cell with subheader class is the day name
    const dayCell = cells.first();
    if (!dayCell.hasClass("subheader")) return;

    const day = cleanText(dayCell.text());
    if (!day) return;

    const periods = [];
    cells.each((cellIdx, cell) => {
      if (cellIdx === 0) return; // skip day name cell
      const text = cleanText($(cell).text());
      const fullTitle = $(cell).attr("title") || "";
      const displayText = text || "";
      // Combine code(room) with title for full info
      if (fullTitle && cleanText(fullTitle) && cleanText(fullTitle) !== displayText) {
        periods.push(`${displayText} — ${cleanText(fullTitle)}`);
      } else {
        periods.push(displayText);
      }
    });

    schedule.push({ day, periods });
  });

  // --- Subject details table ---
  const subjects = [];
  const subjectTable = $("#tblSubjectList").length
    ? $("#tblSubjectList")
    : $("table").eq(1);

  subjectTable.find("tr").each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");

    // Skip header row (has subheader class on TDs)
    if (cells.first().hasClass("subheader")) return;

    // Subject rows have 5 columns: code | description | ltpc | faculty | classroom
    if (cells.length < 5) return;

    const code = cleanText($(cells[0]).text());
    const description = cleanText($(cells[1]).text());
    const ltpc = cleanText($(cells[2]).text());
    const faculty = cleanText($(cells[3]).text());
    const classroom = cleanText($(cells[4]).text());

    if (!code || !/[A-Z]/i.test(code)) return;

    subjects.push({
      code: normalizeCourseCode(code),
      description,
      ltpc,
      faculty: normalizeFacultyLabel(faculty),
      classroom: normalizeClassroomList(classroom),
    });
  });

  return {
    type: "timetable",
    title,
    schedule,
    subjects,
    timeSlots,
  };
}

module.exports = { extractTimetable };
