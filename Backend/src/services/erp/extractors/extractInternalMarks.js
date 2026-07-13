/**
 * Targeted extractor for Internal Mark Details pages.
 *
 * SRM internal marks HTML structure:
 *   - Main table has `<thead>` with: Subject Code | Subject Description | Marks Obtained | Max.Marks
 *   - Subject rows: 4 TDs (code, description, marks obtained, max marks) with onclick="funShowHideDetails(N)"
 *   - Immediately after each subject row: a detail row with `<td colspan="4">` containing:
 *     - A hidden div (`#subjectN`) with a nested table of components:
 *       - Header row: Name | Mark Secured(Conducted) | Mark Secured(Converted)
 *       - Component rows: e.g. "Mid Semester Exam I | 16.00 / 25 | 9.60 / 15"
 *
 * This extractor captures both the summary marks AND the component breakdown,
 * which the generic DOM walker would lose (the nested tables inside hidden divs
 * are exactly the kind of structure that triggers silent data loss).
 *
 * @module erpExtractors/extractInternalMarks
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

/**
 * @param {string} html - Raw HTML from the SRM internal marks page
 * @returns {import("./types").InternalMarksData}
 */
function extractInternalMarks(html) {
  const $ = cheerio.load(html || "");

  const title = cleanText($("h2").first().text()) || "INTERNAL MARK DETAILS";

  const records = [];

  // Find the main table — it has <thead> with Subject Code header
  let mainTable = null;
  $("table").each((_idx, tableEl) => {
    const thead = $(tableEl).find("thead");
    if (thead.length && cleanText(thead.text()).includes("Subject Code")) {
      mainTable = $(tableEl);
      return false; // break
    }
  });

  if (!mainTable) {
    return { type: "internal-marks", title, records };
  }

  // Process subject rows — they have onclick="funShowHideDetails(N)"
  const subjectRows = mainTable.find("tr[onclick]");

  subjectRows.each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");
    if (cells.length < 4) return;

    const subjectCode = cleanText($(cells[0]).text());
    const subjectName = cleanText($(cells[1]).text());
    const marksObtained = cleanText($(cells[2]).text());
    const totalMarks = cleanText($(cells[3]).text());

    if (!subjectCode) return;

    // Extract component breakdown from the next sibling row's hidden div
    const components = {};
    const detailRow = $(rowEl).next("tr");
    if (detailRow.length) {
      const nestedTable = detailRow.find("table");
      if (nestedTable.length) {
        nestedTable.find("tr").each((_compIdx, compRowEl) => {
          const compCells = $(compRowEl).find("td");
          if (compCells.length < 3) return;

          // Skip header rows (with ui-state-active class)
          if (compCells.first().hasClass("ui-state-active")) return;

          const componentName = cleanText($(compCells[0]).text());
          const conducted = cleanText($(compCells[1]).text());
          const converted = cleanText($(compCells[2]).text());

          if (!componentName || componentName === "Name") return;

          components[componentName] = {
            conducted,
            converted,
          };
        });
      }
    }

    records.push({
      subjectCode,
      subjectName,
      marksObtained,
      totalMarks,
      components: Object.keys(components).length > 0 ? components : undefined,
    });
  });

  return {
    type: "internal-marks",
    title,
    records,
  };
}

module.exports = { extractInternalMarks };
