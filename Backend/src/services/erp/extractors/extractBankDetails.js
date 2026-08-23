/**
 * Targeted extractor for Bank Account Details pages.
 *
 * SRM bank details HTML structure:
 *   - "Bank Details" h2 in .panel-heading
 *   - Form table with 2-column rows: Label | Input field
 *   - Fields: Beneficiary Name, Account Number, Bank Name, Branch, IFSC,
 *             Account owner relationship (select), Contact number, Cancelled Cheque attachment
 *
 * Since this is a form for data entry, we extract the field labels + current values
 * (input values are empty if not yet filled, so we capture the form structure).
 *
 * @module erpExtractors/extractBankDetails
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

function extractBankDetails(html) {
  const $ = cheerio.load(html || "");
  const title = cleanText($(".panel-heading h2, h2").first().text()) || "Bank Details";

  const fields = [];

  $("table.table tr").each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");
    if (cells.length < 2) return;

    const label = cleanText($(cells[0]).text()).replace(/\*/g, "").trim();
    if (!label) return;

    // Get value from input, select, or text
    const inputEl = $(cells[1]).find("input");
    const selectEl = $(cells[1]).find("select");

    let value = "";
    let fieldType = "text";
    let fieldName = "";
    let options = [];

    if (inputEl.length) {
      value = inputEl.attr("value") || inputEl.val() || "";
      fieldType = inputEl.attr("type") || "text";
      fieldName = inputEl.attr("name") || inputEl.attr("id") || "";
    } else if (selectEl.length) {
      fieldType = "select";
      fieldName = selectEl.attr("name") || selectEl.attr("id") || "";
      selectEl.find("option").each((_i, opt) => {
        options.push({ value: $(opt).attr("value"), label: cleanText($(opt).text()) });
      });
      value = selectEl.val() || "";
    } else {
      // Check for file input
      const fileEl = $(cells[1]).find("input[type=file]");
      if (fileEl.length) {
        fieldType = "file";
        fieldName = fileEl.attr("name") || fileEl.attr("id") || "";
      }
    }

    if (label && label !== "Save") {
      fields.push({ label, value, fieldType, name: fieldName || undefined, options: options.length ? options : undefined });
    }
  });

  return { type: "bank-details", title, fields };
}

module.exports = { extractBankDetails };
