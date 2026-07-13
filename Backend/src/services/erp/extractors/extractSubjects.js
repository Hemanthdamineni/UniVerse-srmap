/**
 * Targeted extractor for Student Wise Subjects pages.
 *
 * SRM subjects HTML structure:
 *   - `<h2>STUDENT WISE SUBJECTS</h2>`
 *   - Table with `<thead>`: Semester | Code | Description | Credit | Group
 *   - `<tbody>`: data rows with 5 TDs each
 *   - Optional "View earlier semester subjects" button
 *
 * @module erpExtractors/extractSubjects
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

/**
 * @param {string} html - Raw HTML from the SRM subjects page
 * @returns {import("./types").SubjectsData}
 */
function extractSubjects(html) {
  const $ = cheerio.load(html || "");

  const title = cleanText($("h2").first().text()) || "STUDENT WISE SUBJECTS";

  const records = [];

  $("tbody tr").each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");
    if (cells.length < 4) return;

    const semester = cleanText($(cells[0]).text());
    const code = cleanText($(cells[1]).text());
    const name = cleanText($(cells[2]).text());
    const credit = cleanText($(cells[3]).text());

    if (!code || !/[A-Z]/i.test(code)) return;

    records.push({ semester, code, name, credit, ltpc: "" });
  });

  return {
    type: "subjects",
    title,
    records,
  };
}

module.exports = { extractSubjects };
