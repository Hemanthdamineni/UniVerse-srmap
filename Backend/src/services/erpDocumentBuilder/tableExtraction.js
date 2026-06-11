const { cleanText, toSafeHeaderKey, slugify } = require("../../utils/text");
const {
  normalizeValue,
  normalizeTextValue,
  buildTextNode,
  buildTableNode,
  buildFormNode,
  buildFieldNode,
  buildButtonNode,
} = require("./nodeFactories");
const { buildControlDescriptors } = require("./controlExtraction");

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

function createRowKey(columns, rowValues, index) {
  const signature = columns
    .map((column) => normalizeTextValue(rowValues[column.key]))
    .filter(Boolean)
    .join("|");

  return slugify(signature) || `row-${index + 1}`;
}

function buildCellValue($cell, $) {
  const controls = buildControlDescriptors($cell, $);
  if (controls.length === 1) {
    return controls[0];
  }

  const clone = $cell.clone();
  clone.find("input, select, textarea, button, a[href]").remove();
  const visibleText = normalizeTextValue(clone.text());
  if (visibleText) return visibleText;

  if (controls.length > 1) {
    return controls;
  }

  return normalizeTextValue($cell.text());
}

function rowsLookLikeForm(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return false;

  let labeledControlRows = 0;
  let actionRows = 0;
  for (const row of rows) {
    const cells = Array.isArray(row.cells) ? row.cells : [];
    const hasAction = cells.some((cell) => {
      const value = cell?.value;
      return (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        cleanText(value.kind) === "button"
      );
    });

    if (hasAction) {
      actionRows += 1;
    }

    if (cells.length < 2) continue;

    const label = cleanText(cells[0]?.text);
    const value = cells[cells.length - 1]?.value;
    const isInteractive = Boolean(
      value && typeof value === "object" && !Array.isArray(value) && ["field", "button"].includes(cleanText(value.kind))
    );

    if (label && isInteractive) {
      labeledControlRows += 1;
    }
  }

  return labeledControlRows >= 2 || (labeledControlRows >= 1 && actionRows >= 1);
}

function buildFormFromTable(table, $, rows, nextId) {
  if (!rowsLookLikeForm(rows)) return null;

  const children = [];

  for (const row of rows) {
    const cells = Array.isArray(row.cells) ? row.cells : [];
    if (cells.length === 0) continue;

    const label = normalizeTextValue(cells[0]?.text);
    const valueCells = cells.length > 1 ? cells.slice(1) : cells;

    let hasExtractedControl = false;
    for (const cell of valueCells) {
      const value = cell?.value;
      if (!value) continue;

      const valuesToProcess = Array.isArray(value) ? value : [value];
      for (const v of valuesToProcess) {
        if (typeof v === "object" && !Array.isArray(v)) {
          if (cleanText(v.kind) === "field") {
            const fieldLabel = label || cleanText(v.props?.label);
            children.push(
              buildFieldNode(nextId(), {
                ...v.props,
                label: fieldLabel,
              })
            );
            hasExtractedControl = true;
          } else if (cleanText(v.kind) === "button") {
            const buttonLabel = cleanText(v.props?.label) || label || "Button";
            if (label && cleanText(label).toLowerCase() !== cleanText(buttonLabel).toLowerCase() && !hasExtractedControl) {
              children.push(buildTextNode(nextId(), { text: label }));
            }
            children.push(
              buildButtonNode(nextId(), {
                ...v.props,
                label: buttonLabel,
              })
            );
            hasExtractedControl = true;
          }
        }
      }
    }
  }

  if (!children.length) return null;

  return buildFormNode(
    nextId(),
    {
      title: normalizeTextValue(table.find("caption").first().text()),
      method: cleanText(table.closest("form").attr("method")).toUpperCase() || "GET",
      action: cleanText(table.closest("form").attr("action")),
    },
    children
  );
}

function extractTableData(table, $, fallbackId, nextId) {
  let headerLabels = [];
  const headerCells = table.find("thead tr").last().find("th, td");

  if (headerCells.length > 0) {
    headerCells.each((idx, cell) => {
      headerLabels.push(toSafeHeaderKey($(cell).text(), idx));
    });
  } else {
    const firstRow = table.find("tr").first();
    firstRow.find("th, td").each((idx, cell) => {
      headerLabels.push(toSafeHeaderKey($(cell).text(), idx));
    });
  }

  headerLabels = uniqueHeaders(headerLabels);
  const columns = headerLabels.map((label, index) => ({
    key: slugify(label) || `col${index + 1}`,
    label,
  }));
  const bodyRows = table.find("tbody tr");
  const dataRows = bodyRows.length ? bodyRows : table.find("tr").slice(1);
  const rows = [];
  const rawRows = [];

  dataRows.each((rowIndex, rowEl) => {
    const values = {};
    const cells = $(rowEl).find("th, td");
    const tdCells = $(rowEl).find("td");
    if (!cells.length) return;
    if (!tdCells.length) return;
    const rawCells = [];

    let colOffset = 0;
    cells.each((_cellIndex, cell) => {
      const $cell = $(cell);
      const colspan = Math.max(1, parseInt($cell.attr("colspan") || "1", 10) || 1);
      const column = columns[colOffset] || { key: `col${colOffset + 1}` };
      const cellValue = buildCellValue($cell, $);
      values[column.key] = normalizeValue(cellValue);
      rawCells.push({
        key: column.key,
        text: normalizeTextValue($cell.text()),
        value: cellValue,
      });
      colOffset += colspan;
    });

    rawRows.push({
      index: rowIndex,
      cells: rawCells,
    });

    if (
      Object.values(values).some((value) => normalizeTextValue(value) !== "")
    ) {
      rows.push({
        key: createRowKey(columns, values, rowIndex),
        values,
      });
    }
  });

  const formNode = buildFormFromTable(table, $, rawRows, nextId);
  if (formNode) {
    return formNode;
  }

  return buildTableNode(fallbackId, {
    title: normalizeTextValue(table.find("caption").first().text()),
    columns,
    rows,
  });
}

module.exports = {
  extractTableData,
};
