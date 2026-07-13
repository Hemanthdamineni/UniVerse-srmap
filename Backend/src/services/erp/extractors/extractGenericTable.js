/**
 * Generic table extractor for standard ERP pages that share a common
 * simple table structure: h2 title + thead/tbody table.
 *
 * Used for: Exam Registration Details, Hostel Room Details, Transport,
 * SAP Details, SAP Process, SAP Attachments, SAP Feedback, SAP Withdraw,
 * Events, Verification, Feedback, Online Payment Verification, Course Registration.
 *
 * This is a smarter replacement for the generic DOM walker: it reads all
 * tables from the page, extracts their headers and data rows cleanly,
 * and returns a consistent typed structure without silent data loss.
 *
 * @module erpExtractors/extractGenericTable
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

/**
 * @param {string} html
 * @param {string} [expectedTitle]
 * @returns {{ type: "generic-table", title: string, tables: Array<{columns: string[], rows: Object[]}>, text: string, notice: string|undefined }}
 */
function extractGenericTable(html, expectedTitle) {
  const $ = cheerio.load(html || "");

  const title = cleanText($("h2").first().text()) || expectedTitle || "";

  // Collect all non-trivial text notices / status messages
  const notices = [];
  $(".alert, .alert-danger, .alert-info, .alert-success, .alert-warning").each((_i, el) => {
    const text = cleanText($(el).text());
    if (text && text.length > 3) notices.push(text);
  });

  // Empty state messages (e.g. "No Events found", "Not Registered")
  $("h2").each((_i, el) => {
    const text = cleanText($(el).text());
    if (text && text !== title && text.length > 3) notices.push(text);
  });

  // Extract all tables
  const tables = [];
  $("table").each((_tIdx, tableEl) => {
    const table = $(tableEl);
    const columns = [];
    const rows = [];

    // Extract headers from thead or first tr with th elements
    const headerRow = table.find("thead tr, tr:first-child").first();
    headerRow.find("th, td").each((_i, cell) => {
      const text = cleanText($(cell).text());
      if (text) columns.push(text);
    });

    // Skip tables with no meaningful headers or just form inputs
    const hasInputs = table.find("input, select, button").length > 0;
    if (columns.length === 0 && !hasInputs) return;
    if (columns.length === 0 && hasInputs) {
      // Form table — extract as field list
      const fields = {};
      table.find("tr").each((_i, rowEl) => {
        const cells = $(rowEl).find("td");
        if (cells.length < 2) return;
        const label = cleanText($(cells[0]).text()).replace(/\*/g, "").trim();
        if (!label) return;
        const inputEl = $(cells[1]).find("input");
        const selectEl = $(cells[1]).find("select");
        const value = inputEl.length
          ? (inputEl.attr("value") || "")
          : selectEl.length
          ? cleanText(selectEl.find("option:selected").text())
          : cleanText($(cells[1]).text());
        if (label) fields[label] = value;
      });
      if (Object.keys(fields).length > 0) {
        tables.push({ columns: Object.keys(fields), rows: [fields], isForm: true });
      }
      return;
    }

    // Data rows — skip header row
    table.find("tbody tr, tr").each((_rIdx, rowEl) => {
      // Skip header rows
      if ($(rowEl).find("th").length > 0) return;
      if ($(rowEl).hasClass("subheader") || $(rowEl).hasClass("timetablehead")) return;

      const cells = $(rowEl).find("td");
      if (cells.length === 0) return;

      // Skip colspan-only rows (section dividers)
      const allColspan = Array.from(cells).every(
        (cell) => parseInt($(cell).attr("colspan") || "1", 10) > 3
      );
      if (allColspan && cells.length <= 2) return;

      const row = {};
      cells.each((cellIdx, cell) => {
        const key = columns[cellIdx] || `col${cellIdx}`;
        row[key] = cleanText($(cell).text());
      });

      const hasContent = Object.values(row).some((v) => v && v.length > 0);
      if (hasContent) rows.push(row);
    });

    if (rows.length > 0 || columns.length > 0) {
      tables.push({ columns, rows });
    }
  });

  // Full text extraction as fallback
  const bodyText = cleanText($("body").text() || $("*").text());

  return {
    type: "generic-table",
    title,
    tables,
    text: bodyText,
    notice: notices.length > 0 ? notices.join(" | ") : undefined,
  };
}

module.exports = { extractGenericTable };
