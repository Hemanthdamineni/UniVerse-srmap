/**
 * Targeted extractor for OD/ML Details pages.
 *
 * SRM OD/ML HTML structure:
 *   - "OD / ML DETAILS" h2
 *   - `#tblodmldetails` table: From Date | To Date | Activity Type | No. of Days | Description
 *
 * @module erpExtractors/extractOdMlDetails
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

function extractOdMlDetails(html) {
  const $ = cheerio.load(html || "");
  const title = cleanText($("h2").first().text()) || "OD / ML DETAILS";

  const records = [];

  const table = $("#tblodmldetails").length ? $("#tblodmldetails") : $("table").first();

  table.find("tr").each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");
    if (cells.length < 5) return;

    const fromDate = cleanText($(cells[0]).text());
    const toDate = cleanText($(cells[1]).text());
    const activityType = cleanText($(cells[2]).text());
    const days = cleanText($(cells[3]).text());
    const description = cleanText($(cells[4]).text());

    // Skip header-like rows
    if (fromDate === "From Date" || !fromDate) return;

    records.push({ fromDate, toDate, activityType, days, description });
  });

  return { type: "od-ml-details", title, records };
}

module.exports = { extractOdMlDetails };
