/**
 * Targeted extractor for Exam Mark Details pages (all semesters).
 *
 * SRM exam marks HTML structure:
 *   - "EXAM MARK DETAILS" h2
 *   - Results grouped in `.subTable` divs (`#divResultRow_N_M`)
 *   - Each subTable contains a table with rows:
 *     Semester# | Month Year | Subject Code | Subject Description | Credit | Grade | Grade Points | Result | Attempt
 *   - CGPA/SGPA rows: colspan=8 cells with "SGPA" or "CGPA" text
 *
 * @module erpExtractors/extractExamMarkDetails
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

function extractExamMarkDetails(html) {
  const $ = cheerio.load(html || "");
  const title = cleanText($("h2").first().text()) || "EXAM MARK DETAILS";

  const records = [];
  const semesterSummaries = [];

  // Each .subTable div contains semester results
  $(".subTable").each((_idx, divEl) => {
    $(divEl).find("tr").each((_rowIdx, rowEl) => {
      const cells = $(rowEl).find("td");
      if (cells.length < 6) return;

      // Check for SGPA/CGPA summary rows
      const firstText = cleanText($(cells[0]).text());
      const firstColspan = parseInt($(cells[0]).attr("colspan") || "1", 10);
      if (firstColspan >= 4 && /[SC]GPA/i.test(firstText)) {
        semesterSummaries.push({
          label: firstText,
          value: cleanText($(cells[1]).text()),
        });
        return;
      }

      // Data rows: semester | month/year | code | description | credit | grade | gradePoints | result | attempt
      const semesterNo = cleanText($(cells[0]).text());
      const monthYear = cleanText($(cells[1]).text());
      const subjectCode = cleanText($(cells[2]).text());
      const subjectName = cleanText($(cells[3]).text());
      const credit = cleanText($(cells[4]).text());
      const grade = cleanText($(cells[5]).text());
      const gradePoints = cells.length > 6 ? cleanText($(cells[6]).text()) : "";
      const result = cells.length > 7 ? cleanText($(cells[7]).text()) : "";
      const attempt = cells.length > 8 ? cleanText($(cells[8]).text()) : "";

      if (!subjectCode || !/[A-Z]/i.test(subjectCode)) return;

      records.push({ semesterNo, monthYear, subjectCode, subjectName, credit, grade, gradePoints, result, attempt });
    });
  });

  return { type: "exam-mark-details", title, records, semesterSummaries };
}

module.exports = { extractExamMarkDetails };
