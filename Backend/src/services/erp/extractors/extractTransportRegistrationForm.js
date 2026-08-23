/**
 * Targeted extractor for Transport Registration form page
 *
 * Extracts the registration form table and notice text,
 * while removing the "Transport & FAQs" link section.
 *
 * @module erpExtractors/extractTransportRegistrationForm
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

function extractTransportRegistrationForm(html) {
  const $ = cheerio.load(html || "");

  const title = cleanText($(".table-title, h1, h2, h3").first().text()) || "TRANSPORT REGISTRATION";

  // Extract form table if present (registration fields like Route, Pickup Point, etc.)
  const tables = [];
  const formTable = $("table").first();
  if (formTable.length) {
    const headers = [];
    formTable.find("thead th, tr:first-child th").each((_, el) => {
      headers.push(cleanText($(el).text()));
    });
    const rows = [];
    formTable.find("tbody tr, tr:has(td)").each((_, el) => {
      const cells = [];
      $(el).find("td, th").each((_, cell) => {
        cells.push(cleanText($(cell).text()));
      });
      if (cells.length > 0) rows.push(cells);
    });
    if (headers.length > 0 || rows.length > 0) {
      tables.push({ headers, rows });
    }
  }

  // Get the full body text for notice/message
  let bodyText = cleanText($("body").text() || $("*").text());

  // Remove the "Transport & FAQs External resource. Open URL in browser." section
  bodyText = bodyText
    .replace(/Transport & FAQs\s*External resource\.?\s*Open URL in browser\.?/gi, "")
    .replace(/Transport & FAQs/gi, "")
    .replace(/External resource\.?\s*Open URL in browser\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    type: "generic-table",
    title,
    tables,
    text: bodyText,
  };
}

module.exports = { extractTransportRegistrationForm };