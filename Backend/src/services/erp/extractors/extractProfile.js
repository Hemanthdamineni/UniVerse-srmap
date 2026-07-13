/**
 * Targeted extractor for Profile pages.
 *
 * SRM profile HTML structure:
 *   - `<h2>PROFILE</h2>`
 *   - `<table class="table table-striped">` with rows:
 *     `<tr><td>Label</td><td>:</td><td>Value</td></tr>`
 *
 * @module erpExtractors/extractProfile
 */

const cheerio = require("cheerio");
const { cleanText } = require("../../../utils/text");

/**
 * @param {string} html - Raw HTML from the SRM profile page
 * @returns {import("./types").ProfileData}
 */
function extractProfile(html) {
  const $ = cheerio.load(html || "");

  const title = cleanText($("h2").first().text()) || "PROFILE";

  const fields = {};
  const fieldList = [];

  // Profile table uses 3-column rows: Label | : | Value
  $("table.table tr").each((_idx, rowEl) => {
    const cells = $(rowEl).find("td");
    if (cells.length < 3) return;

    const label = cleanText($(cells[0]).text());
    const separator = cleanText($(cells[1]).text());
    const value = cleanText($(cells[2]).text());

    if (!label || separator !== ":") return;

    fields[label] = value;
    fieldList.push({ label, value });
  });

  return {
    type: "profile",
    title,
    fields,
    fieldList,
  };
}

module.exports = { extractProfile };
