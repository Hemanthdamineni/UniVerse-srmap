const cheerio = require("cheerio");
const { cleanText, toSafeHeaderKey } = require("../utils/text");
const { buildDocument } = require("./erpDocumentBuilder");

function uniqueHeaders(headers) {
  const seen = Object.create(null);
  return headers.map((header) => {
    if (!seen[header]) {
      seen[header] = 1;
      return header;
    }
    seen[header] += 1;
    return `${header}_${seen[header]}`;
  });
}

function extractProfileTableContent(contentRoot, $) {
  const profileContent = {};
  const firstTableRows = contentRoot.find("table").first().find("tr");

  firstTableRows.each((_idx, rowEl) => {
    const tds = $(rowEl).find("td");
    if (tds.length >= 3) {
      const key = cleanText($(tds[0]).text());
      const separator = cleanText($(tds[1]).text());
      const value = cleanText($(tds[2]).text());
      if (key && separator === ":" && value) {
        profileContent[key] = value;
      }
    }
  });

  return profileContent;
}

function parseHtmlContent(html = "") {
  const $ = cheerio.load(html);
  const contentRoot = $("#divContent").length ? $("#divContent").first() : $.root();

  const title = cleanText(contentRoot.find("h1, h2, h3").first().text());
  const tables = [];

  contentRoot.find("table").each((_tableIndex, tableEl) => {
    const table = $(tableEl);

    let headers = [];
    const headerCells = table.find("thead tr").last().find("th, td");

    if (headerCells.length > 0) {
      headerCells.each((idx, cell) => {
        headers.push(toSafeHeaderKey($(cell).text(), idx));
      });
    } else {
      const firstRow = table.find("tr").first();
      firstRow.find("th, td").each((idx, cell) => {
        headers.push(toSafeHeaderKey($(cell).text(), idx));
      });
    }

    if (!headers.length) return;

    headers = uniqueHeaders(headers);

    const bodyRows = table.find("tbody tr");
    const dataRows = bodyRows.length ? bodyRows : table.find("tr").slice(1);

    const rows = [];
    dataRows.each((_idx, rowEl) => {
      const row = {};
      const cells = $(rowEl).find("td");
      if (!cells.length) return;

      let colOffset = 0;
      cells.each((_cellIndex, cell) => {
        const colspan = Math.max(1, parseInt($(cell).attr("colspan") || "1", 10) || 1);
        const headerKey = headers[colOffset] || `col${colOffset + 1}`;
        row[headerKey] = cleanText($(cell).text());
        colOffset += colspan;
      });

      if (Object.values(row).some((value) => cleanText(value) !== "")) {
        rows.push(row);
      }
    });

    if (rows.length) {
      tables.push(rows);
    }
  });

  const profileContent = extractProfileTableContent(contentRoot, $);

  const text = cleanText(
    contentRoot
      .text()
      .replace(/Loading\.\.\.\.*?/gi, " ")
  );

  const parsed = {
    title,
    text,
    tables,
    document: buildDocument(contentRoot, $, title),
  };

  if (
    !parsed.document ||
    !parsed.document.root ||
    !Array.isArray(parsed.document.root.children) ||
    parsed.document.root.children.length === 0
  ) {
    console.warn("[ERP parser] Empty ERP document generated", {
      title,
      htmlLength: String(html || "").length,
    });
  }

  if (Object.keys(profileContent).length > 0) {
    parsed.TableContent = profileContent;
  }

  return parsed;
}

module.exports = {
  parseHtmlContent,
};
