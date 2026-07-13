/**
 * Targeted extractor for Attendance Details pages.
 *
 * Reads the known SRM attendance HTML structure:
 *   - Period banner: `<table width="40%">` with a single TD
 *   - Data table: `#tblSubjectWiseAttendance` with 2-row multi-level headers
 *     Row 1: Subject Code | Subject Description | Classes Conducted | Attendance Entered (Slots) [colspan=2] | OD/ML Taken | Present % | OD ML % | Attendance %
 *     Row 2: Present(P) | Absent(A)
 *   - Data rows: 9 TDs each (Subject Code, Description, Conducted, Present, Absent, OD/ML, Present%, OD ML%, Attendance%)
 *
 * @module erpExtractors/extractAttendance
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

/**
 * @param {string} html - Raw HTML from the SRM attendance page
 * @returns {import("./types").AttendanceData}
 */
function extractAttendance(html) {
  const $ = cheerio.load(html || "");

  // Title
  const title = cleanText($("h2").first().text()) || "ATTENDANCE DETAILS";

  // Period banner — first table, single TD with "During the Period" text
  let period = "";
  const bannerText = cleanText($("table").first().find("td").first().text());
  const periodMatch = bannerText.match(/During the Period\s*:\s*(.+)/i);
  if (periodMatch) {
    period = periodMatch[1].trim();
  }

  // Main attendance table — #tblSubjectWiseAttendance or the second table
  const attendanceTable = $("#tblSubjectWiseAttendance").length
    ? $("#tblSubjectWiseAttendance")
    : $("table").eq(1);

  const records = [];

  // Data rows — skip header rows (those with background-color style or in thead)
  attendanceTable.find("tr").each((_idx, rowEl) => {
    const row = $(rowEl);

    // Skip header rows (have background-color in style)
    if ((row.attr("style") || "").includes("background-color")) return;

    // Skip rows that span the full table (footnote rows with colspan)
    const firstTd = row.find("td").first();
    const colspan = parseInt(firstTd.attr("colspan") || "1", 10);
    if (colspan > 3) return;

    const cells = row.find("td");
    if (cells.length < 8) return;

    const subjectCode = cleanText($(cells[0]).text());
    const subjectDescription = cleanText($(cells[1]).text());

    // Skip if this looks like a sub-header echo (Present(P), Absent(A) row)
    if (subjectCode === "Present(P)" || subjectDescription === "Present(P)") return;

    const classesConducted = cleanText($(cells[2]).text());
    const present = cleanText($(cells[3]).text());
    const absent = cleanText($(cells[4]).text());
    const odMlTaken = cleanText($(cells[5]).text());
    const presentPercentage = cleanText($(cells[6]).text());
    const odMlPercentage = cleanText($(cells[7]).text());
    const attendancePercentage = cells.length >= 9 ? cleanText($(cells[8]).text()) : "";

    // Validate: subjectCode should look like a course code (letters + digits)
    if (!subjectCode || !/[A-Z]/i.test(subjectCode)) return;

    records.push({
      subjectCode,
      subjectDescription,
      classesConducted,
      present,
      absent,
      odMlTaken,
      presentPercentage,
      odMlPercentage,
      attendancePercentage,
    });
  });

  // Footnote — the "For any discrepancy..." text
  let footnote = "";
  attendanceTable.find("td[colspan]").each((_idx, el) => {
    const text = cleanText($(el).text());
    if (text.includes("discrepancy") || text.includes("Attendance Percentage Calculation")) {
      if (!footnote) footnote = text;
    }
  });

  return {
    type: "attendance",
    title,
    period,
    records,
    footnote: footnote || undefined,
  };
}

module.exports = { extractAttendance };
