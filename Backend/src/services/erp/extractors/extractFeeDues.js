/**
 * Targeted extractor for Fee Due Details pages.
 *
 * SRM fee dues HTML structure:
 *   - `<h2>DUES</h2>`
 *   - Main dues table `<table class="table table-striped table-bordered">`:
 *     - `<thead>`: Sl.No. | Fee Category | Fee Head | Due Amount (INR) | Collected (INR) | To be Paid Amount (INR)
 *     - `<tbody>`: data rows with 6 TDs
 *     - Total row after tbody: 6 TDs with "Total Fees" spanning 3 cols
 *   - Payment category section:
 *     - `<h2>SELECT FEE CATEGORY TO PAY</h2>`
 *     - Table with `<button>` elements for each fee category
 *   - Note section: `<div class="alert alert-info">` with payment instructions
 *
 * @module erpExtractors/extractFeeDues
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

/**
 * @param {string} html - Raw HTML from the SRM fee dues page
 * @returns {import("./types").FeeDuesData}
 */
function extractFeeDues(html) {
  const $ = cheerio.load(html || "");

  const title = cleanText($("h2").first().text()) || "DUES";

  // Main dues table — first table with <thead>
  let duesTable = null;
  $("table").each((_idx, tableEl) => {
    const thead = $(tableEl).find("thead");
    if (thead.length && cleanText(thead.text()).includes("Fee Category")) {
      duesTable = $(tableEl);
      return false;
    }
  });

  const records = [];
  const totals = { dueAmount: "", collected: "", toBePaid: "" };

  if (duesTable) {
    // Data rows in tbody
    duesTable.find("tbody tr").each((_idx, rowEl) => {
      const cells = $(rowEl).find("td");
      if (cells.length < 6) return;

      const slNo = cleanText($(cells[0]).text());
      const feeCategory = cleanText($(cells[1]).text());
      const feeHead = cleanText($(cells[2]).text());
      const dueAmount = cleanText($(cells[3]).text());
      const collected = cleanText($(cells[4]).text());
      const toBePaid = cleanText($(cells[5]).text());

      if (!feeCategory && !feeHead) return;

      records.push({ slNo, feeCategory, feeHead, dueAmount, collected, toBePaid });
    });

    // Total row — outside tbody, look for "Total Fees" text
    duesTable.find("tr").each((_idx, rowEl) => {
      const rowText = cleanText($(rowEl).text());
      if (!rowText.includes("Total Fees")) return;

      const cells = $(rowEl).find("td");
      // The Total row uses colspan=3 for the label, then 3 value cells
      const valueCells = [];
      cells.each((_cellIdx, cell) => {
        const colspan = parseInt($(cell).attr("colspan") || "1", 10);
        if (colspan <= 1) {
          valueCells.push(cleanText($(cell).text()));
        }
      });

      if (valueCells.length >= 3) {
        totals.dueAmount = valueCells[0];
        totals.collected = valueCells[1];
        totals.toBePaid = valueCells[2];
      }
    });
  }

  // Payment categories — buttons in the second table
  const paymentCategories = [];
  $("button.btn").each((_idx, btnEl) => {
    const text = cleanText($(btnEl).text());
    if (text) paymentCategories.push(text);
  });

  // Note text
  const noteEl = $(".alert.alert-info");
  const note = noteEl.length ? cleanText(noteEl.text()) : undefined;

  return {
    type: "fee-dues",
    title,
    records,
    totals,
    paymentCategories,
    note,
  };
}

module.exports = { extractFeeDues };
