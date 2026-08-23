/**
 * Targeted extractor for Earlier Internal Marks semester detail pages (Semester 1-8).
 *
 * SRM earlier internal marks semester page HTML structure:
 *   - Single table with 6 columns: Semester | Code | Description | Subject Type | Mark Obtained | Max Mark
 *   - No onclick handlers or nested detail rows (unlike the main Internal Mark Details page)
 *   - Multiple rows per subject (e.g., Theory and Practical as separate rows)
 *
 * This extractor handles the 6-column flat table structure and produces records
 * compatible with the existing "internal-marks" type for frontend consumption.
 *
 * @module erpExtractors/extractEarlierInternalMarksSemester
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

/**
 * @param {string} html - Raw HTML from the SRM earlier internal marks semester page
 * @returns {import("./types").InternalMarksData}
 */
function extractEarlierInternalMarksSemester(html) {
  const $ = cheerio.load(html || "");

  const title = cleanText($("h2").first().text()) || "EARLIER INTERNAL MARK DETAILS";

  const records = [];

  // Find the main table — it has <thead> with 6 columns including "Subject Type"
  let mainTable = null;
  $("table").each((_idx, tableEl) => {
    const thead = $(tableEl).find("thead");
    if (thead.length && cleanText(thead.text()).includes("Subject Type")) {
      mainTable = $(tableEl);
      return false; // break
    }
  });

  // Fallback: any table with 6 header cells matching our expected columns
  if (!mainTable) {
    $("table").each((_idx, tableEl) => {
      const headers = $(tableEl).find("thead th, th");
      if (headers.length === 6) {
        const headerTexts = headers.map((_i, el) => cleanText($(el).text())).get();
        if (headerTexts.some((h) => h.includes("Subject Type")) && headerTexts.some((h) => h.includes("Mark Obtained"))) {
          mainTable = $(tableEl);
          return false;
        }
      }
    });
  }

  if (!mainTable) {
    return { type: "internal-marks", title, records };
  }

  // Process all data rows in tbody
  const rows = mainTable.find("tbody tr");

  rows.each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");
    if (cells.length < 6) return;

    const semester = cleanText($(cells[0]).text());
    const subjectCode = cleanText($(cells[1]).text());
    const subjectName = cleanText($(cells[2]).text());
    const subjectType = cleanText($(cells[3]).text());
    const marksObtained = cleanText($(cells[4]).text());
    const totalMarks = cleanText($(cells[5]).text());

    // Skip if no valid subject code
    if (!subjectCode || !/[A-Z]/i.test(subjectCode)) return;

    records.push({
      subjectCode,
      subjectName,
      marksObtained,
      totalMarks,
      semester,
      // Store subjectType in extras for potential future use
      extras: {
        subjectType,
      },
    });
  });

  return {
    type: "internal-marks",
    title,
    records,
  };
}

module.exports = { extractEarlierInternalMarksSemester };