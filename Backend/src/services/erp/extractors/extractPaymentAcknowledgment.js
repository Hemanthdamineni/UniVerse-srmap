/**
 * Targeted extractor for Payment Acknowledgment (receipts) pages.
 *
 * SRM payment receipts HTML structure:
 *   - "PAYMENT RECEIPTS" h2
 *   - Table with thead: Sl.No. | Receipt Date | Receipt No. | Particulars | Amount | (Print button)
 *   - tbody data rows with 6 TDs
 *
 * @module erpExtractors/extractPaymentAcknowledgment
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

function extractPaymentAcknowledgment(html) {
  const $ = cheerio.load(html || "");
  const title = cleanText($("h2").first().text()) || "PAYMENT RECEIPTS";

  const records = [];

  $("tbody tr").each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");
    if (cells.length < 5) return;

    const slNo = cleanText($(cells[0]).text());
    const receiptDate = cleanText($(cells[1]).text());
    const receiptNo = cleanText($(cells[2]).text());
    const particulars = cleanText($(cells[3]).text());
    const amount = cleanText($(cells[4]).text());

    if (!receiptNo && !particulars) return;

    records.push({ slNo, receiptDate, receiptNo, particulars, amount });
  });

  return { type: "payment-acknowledgment", title, records };
}

module.exports = { extractPaymentAcknowledgment };
