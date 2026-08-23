/**
 * Targeted extractor for Transport routes
 *
 * @module erpExtractors/extractTransport
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

function extractTransport(html) {
  const $ = cheerio.load(html || "");
  const title = cleanText($(".table-title, h1, h2, h3").first().text()) || "Transport Routes";

  const records = [];

  $("table.table-striped tbody tr, table.table-bordered tbody tr, table tbody tr").each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");

    // We expect a table with varying formats. Try to adapt.
    // E.g. [Route ID, Route Name, Bus No, Stops, Timings, Driver, Driver Contact]

    let routeId, routeName, stops, busNumber, timings, driverName, driverContact, vehicleNumber;

    if (cells.length >= 6) {
      routeName = cleanText($(cells[1]).text());
      busNumber = cleanText($(cells[2]).text());
      stops = cleanText($(cells[3]).text());
      timings = cleanText($(cells[4]).text());

      const driverStr = cleanText($(cells[5]).text());
      const contactMatch = driverStr.match(/(\d{10})/);

      driverName = driverStr.replace(/\d{10}/, "").trim();
      driverContact = contactMatch ? contactMatch[1] : "";
    } else if (cells.length >= 2) {
      // Fallback
      routeName = cleanText($(cells[0]).text());
      stops = cleanText($(cells[1]).text());
    }

    if (routeName) {
      records.push({
        routeId: routeName,
        routeName,
        stops,
        busNumber: busNumber || "N/A",
        timings: timings || "N/A",
        driverName: driverName || "Unassigned",
        driverContact: driverContact || "N/A",
        vehicleNumber: "N/A",
        status: "active"
      });
    }
  });

  return { type: "transport-routes", title, records };
}

module.exports = { extractTransport };
