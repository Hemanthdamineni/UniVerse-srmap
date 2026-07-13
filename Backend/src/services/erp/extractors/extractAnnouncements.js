/**
 * Targeted extractor for Announcements pages.
 *
 * SRM announcements HTML structure:
 *   - "Announcements" h2
 *   - Table with thead: Announcement Date | Announcement Name | Enclosure
 *   - Data rows in tbody OR a "No Announcements found" h2 when empty
 *
 * @module erpExtractors/extractAnnouncements
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

function extractAnnouncements(html) {
  const $ = cheerio.load(html || "");
  const title = cleanText($("h2").first().text()) || "Announcements";

  // Check for empty state
  const emptyMsg = $("h2").filter((_i, el) =>
    cleanText($(el).text()).includes("No Announcements")
  ).first();
  if (emptyMsg.length) {
    return { type: "announcements", title, records: [], empty: true, emptyMessage: cleanText(emptyMsg.text()) };
  }

  const records = [];

  $("tbody tr").each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");
    if (cells.length < 2) return;

    const date = cleanText($(cells[0]).text());
    const name = cleanText($(cells[1]).text());
    const enclosure = cells.length > 2 ? cleanText($(cells[2]).text()) : "";

    if (!date && !name) return;
    records.push({ date, name, enclosure });
  });

  return { type: "announcements", title, records, empty: records.length === 0 };
}

module.exports = { extractAnnouncements };
