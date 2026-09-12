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
      // Only surface numbers the page actually reports — no invented defaults.
      const capacityRaw = parseInt(cleanText($(cells[3]).text()), 10);
      const occupantsRaw = parseInt(cleanText($(cells[4]).text()), 10);
      const capacity = Number.isFinite(capacityRaw) ? capacityRaw : null;
      const occupants = Number.isFinite(occupantsRaw) ? occupantsRaw : null;
      const rent = cleanText($(cells[5]).text());

      if (blockName) {
        hostels.push({
          id: blockName,
          blockName,
          roomType,
          floorPlan,
          capacity,
          occupants,
          rent,
          status:
            capacity !== null && occupants !== null && occupants >= capacity
              ? "occupied"
              : "available",
        });
      }
    }
  });

  return { type: "hostel-booking", title, hostels };
}

module.exports = { extractHostel };
