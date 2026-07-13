/**
 * Targeted extractor for Earlier Internal Marks pages.
 *
 * SRM earlier internal marks HTML structure:
 *   - "EARLIER INTERNAL MARK DETAILS" h2
 *   - Semester selection buttons: "Semester 1" through "Semester 5"
 *   - No pre-loaded table data (content is loaded dynamically via AJAX)
 *   - The raw HTML just contains the navigation controls
 *
 * For dumps, the actual data is in separate "Examination|Semester N.html" files.
 *
 * @module erpExtractors/extractEarlierInternalMarks
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

function extractEarlierInternalMarks(html) {
  const $ = cheerio.load(html || "");
  const title = cleanText($("h2").first().text()) || "EARLIER INTERNAL MARK DETAILS";

  // Extract available semester buttons
  const availableSemesters = [];
  $("button[onclick*='funEarlierInternalMarks']").each((_i, btn) => {
    const text = cleanText($(btn).text());
    const match = $(btn).attr("onclick")?.match(/funEarlierInternalMarks\((\d+)\)/);
    if (match) {
      availableSemesters.push({ label: text, semesterNo: parseInt(match[1], 10) });
    }
  });

  // Extract any preloaded table data (from dump)
  const records = [];
  $("table.table tbody tr").each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");
    if (cells.length < 4) return;

    const subjectCode = cleanText($(cells[0]).text());
    const subjectName = cleanText($(cells[1]).text());
    const marksObtained = cleanText($(cells[2]).text());
    const totalMarks = cleanText($(cells[3]).text());

    if (!subjectCode || !/[A-Z]/i.test(subjectCode)) return;
    records.push({ subjectCode, subjectName, marksObtained, totalMarks });
  });

  return { type: "earlier-internal-marks", title, availableSemesters, records };
}

module.exports = { extractEarlierInternalMarks };
