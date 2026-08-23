/**
 * Targeted extractor for Hostel Room/Booking Details
 *
 * @module erpExtractors/extractHostel
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

function extractHostel(html) {
  const $ = cheerio.load(html || "");
  const title = cleanText($(".table-title, h1, h2, h3").first().text()) || "Hostel Info";

  const hostels = [];

  $("table tbody tr").each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");

    if (cells.length >= 5) {
      const blockName = cleanText($(cells[0]).text());
      const roomType = cleanText($(cells[1]).text());
      const floorPlan = cleanText($(cells[2]).text());
      const capacity = parseInt(cleanText($(cells[3]).text()), 10) || 3;
      const occupants = parseInt(cleanText($(cells[4]).text()), 10) || 1;
      const rent = cleanText($(cells[5]).text()) || "N/A";

      if (blockName) {
        hostels.push({
          id: blockName,
          blockName,
          roomType,
          floorPlan,
          capacity,
          occupants,
          rent,
          facilities: ["AC", "WiFi", "Bed", "Study Table"],
          status: occupants >= capacity ? "occupied" : "available",
        });
      }
    }
  });

  return { type: "hostel-booking", title, hostels };
}

module.exports = { extractHostel };
