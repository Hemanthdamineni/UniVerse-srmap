/**
 * htmlParser.js — Generic HTML→structured-data parser.
 *
 * Used primarily by CLI dump/audit scripts to extract content from raw
 * ERP HTML pages without going through the full extractor pipeline.
 *
 * Returns { title, text, tables, meta } from an HTML string.
 */
"use strict";

const cheerio = require("cheerio");

/**
 * Parse raw HTML into a structured representation.
 * @param {string} html — Raw HTML string.
 * @param {object} [options] — Optional parsing options.
 * @param {string[]} [options.tableSelectors] — CSS selectors for tables to extract.
 * @returns {{ title: string, text: string, tables: object[], meta: object|null }}
 */
function parseHtmlContent(html, options = {}) {
  const $ = cheerio.load(html);
  const tableSelectors = options.tableSelectors || ["table"];

  // Page title
  const title =
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    $("h2").first().text().trim() ||
    "";

  // Visible text (strip scripts, styles, nav cruft)
  $("script, style, nav, header, footer, .sidebar, #sidebar-menu").remove();
  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim();

  // Tables as arrays of row objects
  const tables = [];
  $(tableSelectors.join(", ")).each((ti, tableEl) => {
    const rows = [];
    const $table = $(tableEl);

    // Extract headers from <thead> or first <tr>
    const headers = [];
    $table.find("thead th, thead td").each((_, h) => {
      headers.push($(h).text().trim());
    });
    if (!headers.length) {
      $table.find("tr").first().find("th, td").each((_, h) => {
        headers.push($(h).text().trim());
      });
    }

    // Extract data rows
    const bodyRows = $table.find("tbody tr").length
      ? $table.find("tbody tr")
      : $table.find("tr").slice(headers.length ? 1 : 0);

    bodyRows.each((ri, rowEl) => {
      const row = {};
      const cells = $(rowEl).find("td, th");
      cells.each((ci, cellEl) => {
        const key = headers[ci] ? headers[ci] : `col${ci}`;
        row[key] = $(cellEl).text().trim();
      });
      if (Object.keys(row).length) rows.push(row);
    });

    if (rows.length) {
      tables.push({ headers, rows });
    }
  });

  // Extract <meta> tags as key-value pairs
  const meta = {};
  $("meta").each((_, el) => {
    const name = $(el).attr("name") || $(el).attr("property") || "";
    const content = $(el).attr("content") || "";
    if (name && content) meta[name] = content;
  });

  return {
    title,
    text: text.substring(0, 100000), // cap at 100KB for safety
    tables,
    meta: Object.keys(meta).length ? meta : null,
  };
}

module.exports = { parseHtmlContent };
