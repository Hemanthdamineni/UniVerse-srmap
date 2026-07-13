/**
 * Targeted extractor for Fee Paid Details pages.
 *
 * SRM fee paid HTML structure:
 *   - "FEE PAID DETAILS" h2
 *   - `#tbl7` table (Fixed/Advances + Receipts/Payments split header)
 *     Rows: Term | Fee Type | Due Date | Amount | Receipt Date | Mode | Number | Amount | Due
 *   - "FEE REFUND DETAILS" section (often empty)
 *
 * @module erpExtractors/extractFeePaid
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

function extractFeePaid(html) {
  const $ = cheerio.load(html || "");
  const title = cleanText($("h2").first().text()) || "FEE PAID DETAILS";

  const records = [];
  const columns = [
    "term", "feeType", "dueDate", "dueAmount",
    "receiptDate", "mode", "receiptNumber", "paidAmount", "balance"
  ];

  // Main table #tbl7 — skip the 2 subheader rows, read data rows
  let headerRowCount = 0;
  $("#tbl7, table").first().find("tr").each((_idx, rowEl) => {
    const row = $(rowEl);
    if (row.hasClass("subheader")) { headerRowCount++; return; }

    const cells = row.find("td");
    if (cells.length < 8) return;

    const record = {};
    columns.forEach((col, i) => {
      record[col] = cleanText($(cells[i]).text());
    });

    if (!record.term && !record.feeType) return;
    records.push(record);
  });

  // Refund section
  const refundRecords = [];
  let inRefund = false;
  $("h2").each((_i, el) => {
    if (cleanText($(el).text()).includes("REFUND")) inRefund = true;
  });

  return { type: "fee-paid", title, records, columns, refundRecords };
}

module.exports = { extractFeePaid };
