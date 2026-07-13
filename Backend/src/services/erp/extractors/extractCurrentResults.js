/**
 * Targeted extractor for Current Semester Results pages.
 *
 * SRM results HTML structure:
 *   - Single table with `<thead>`:
 *     - Row 0: "UNIVERSITY EXAMINATION RESULTS - DECEMBER 2025" (colspan=6)
 *     - Row 1: Semester | Subject Code | Subject Description | Credit | Grade | Result
 *   - `<tbody>`: data rows with 6 TDs each
 *   - SGPA row: "S.G.P.A" text with colspan=5, followed by the SGPA value
 *   - Disclaimer row: colspan=6 with legal text
 *
 * @module erpExtractors/extractCurrentResults
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

/**
 * @param {string} html - Raw HTML from the SRM current results page
 * @returns {import("./types").CurrentResultsData}
 */
function extractCurrentResults(html) {
  const $ = cheerio.load(html || "");

  // Title from the first thead row (colspan header)
  let title = "";
  const theadRows = $("thead tr");
  if (theadRows.length > 0) {
    title = cleanText($(theadRows[0]).text());
  }
  if (!title) title = "CURRENT SEMESTER RESULTS";

  const records = [];
  let sgpa = "";

  $("tbody tr").each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");
    if (cells.length < 2) return;

    // Check for SGPA row
    const firstCellText = cleanText($(cells[0]).text());
    const firstColspan = parseInt($(cells[0]).attr("colspan") || "1", 10);

    if (firstColspan >= 4 && /S\.?G\.?P\.?A/i.test(firstCellText)) {
      sgpa = cleanText($(cells[1]).text());
      return;
    }

    // Skip disclaimer row
    if (firstColspan >= 5) return;

    // Data rows: Semester | Subject Code | Subject Description | Credit | Grade | Result
    if (cells.length < 6) return;

    const semester = cleanText($(cells[0]).text());
    const subjectCode = cleanText($(cells[1]).text());
    const subjectName = cleanText($(cells[2]).text());
    const credit = cleanText($(cells[3]).text());
    const grade = cleanText($(cells[4]).text());
    const result = cleanText($(cells[5]).text());

    if (!subjectCode) return;

    records.push({
      subjectCode,
      subjectName,
      grade,
      result,
      extras: { semester, credit },
    });
  });

  return {
    type: "current-results",
    title,
    records,
    sgpa,
  };
}

module.exports = { extractCurrentResults };
