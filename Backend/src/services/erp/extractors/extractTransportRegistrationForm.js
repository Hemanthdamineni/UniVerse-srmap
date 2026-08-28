/**
 * Targeted extractor for Transport Registration form page
 *
 * Extracts the registration form table and notice text,
 * while removing the "Transport & FAQs" link section.
 *
 * Header-less tables are intentionally not emitted as tables: the ERP page
 * wraps its "booking will be open soon" notice in a borderless <table>, and
 * emitting it as header-less array rows used to leak array indices ("0") into
 * the frontend as column headers. Notice text flows through `text` instead,
 * and genuine form controls are reduced to label/value fields.
 *
 * @module erpExtractors/extractTransportRegistrationForm
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

function extractTransportRegistrationForm(html) {
  const $ = cheerio.load(html || "");

  // Remove non-content elements before reading any text so JS/CSS blobs
  // never reach downstream consumers.
  $("script, style, noscript").remove();

  const title = cleanText($(".table-title, h1, h2, h3").first().text()) || "TRANSPORT REGISTRATION";

  // Extract form table if present (registration fields like Route, Pickup Point, etc.)
  const tables = [];
  const formTable = $("table").first();
  if (formTable.length) {
    const headers = [];
    formTable.find("thead th, tr:first-child th").each((_, el) => {
      headers.push(cleanText($(el).text()));
    });

    if (headers.length > 0) {
      const rows = [];
      formTable.find("tbody tr, tr:has(td)").each((_, el) => {
        const cells = [];
        $(el).find("td, th").each((_, cell) => {
          cells.push(cleanText($(cell).text()));
        });
        if (cells.length > 0) rows.push(cells);
      });
      if (rows.length > 0) {
        tables.push({ headers, rows });
      }
    } else if (formTable.find("input, select, button").length > 0) {
      // Header-less form table — reduce controls to label/value fields so the
      // student's current selections still surface (mirrors extractGenericTable).
      const fields = {};
      formTable.find("tr").each((_, rowEl) => {
        const cells = $(rowEl).find("td");
        if (cells.length < 2) return;
        const label = cleanText($(cells[0]).text()).replace(/\*/g, "").trim();
        if (!label) return;
        const inputEl = $(cells[1]).find("input");
        const selectEl = $(cells[1]).find("select");
        const value = inputEl.length
          ? (inputEl.attr("value") || "")
          : selectEl.length
          ? cleanText(selectEl.find("option:selected").text())
          : cleanText($(cells[1]).text());
        fields[label] = value;
      });
      const labels = Object.keys(fields);
      if (labels.length > 0) {
        tables.push({ headers: labels, rows: [labels.map((label) => fields[label])] });
      }
    }
    // Header-less tables without form controls (notice boxes) are skipped:
    // their text is already captured in the body text below.
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
