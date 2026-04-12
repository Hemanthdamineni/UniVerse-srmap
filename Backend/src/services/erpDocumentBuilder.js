const { cleanText, toSafeHeaderKey, slugify } = require("../utils/text");

const VALID_NODE_TYPES = new Set(["container", "text", "table", "form", "field", "button"]);

// Removed safeStringify — objects must never reach frontend as strings

function normalizeValue(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") {
    return cleanText(value.replace(/\u00a0/g, " "));
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return "";
  }

  if (typeof value === "object") {
    if ("text" in value) return normalizeValue(value.text);
    if ("label" in value) return normalizeValue(value.label);
    if ("value" in value) return normalizeValue(value.value);
    if ("props" in value && value.props && typeof value.props === "object") {
      if ("text" in value.props) return normalizeValue(value.props.text);
      if ("label" in value.props) return normalizeValue(value.props.label);
      if ("value" in value.props) return normalizeValue(value.props.value);
    }
    // DO NOT stringify — return empty string to prevent [object Object]
    return "";
  }

  return "";
}

/**
 * Normalizes ALL values in a props object so that no nested object
 * can leak through to the frontend. Structural keys (action, options,
 * columns, rows) are preserved as-is because they are not rendered
 * directly as text.
 */
const STRUCTURAL_PROP_KEYS = new Set(["action", "options", "columns", "rows"]);

function normalizeProps(props) {
  if (!props || typeof props !== "object" || Array.isArray(props)) return {};

  const result = {};
  for (const [key, val] of Object.entries(props)) {
    if (STRUCTURAL_PROP_KEYS.has(key)) {
      // Preserve structural data as-is (action objects, option arrays, etc.)
      result[key] = val;
      continue;
    }
    result[key] = normalizeValue(val);
  }
  return result;
}

function buildTextNode(id, props = {}) {
  const safe = normalizeProps(props);
  return {
    id,
    type: "text",
    props: {
      ...safe,
      text: normalizeValue(props.text),
    },
    children: [],
  };
}

function buildTableNode(id, props = {}) {
  return {
    id,
    type: "table",
    props: normalizeProps(props),
    children: [],
  };
}

function buildFormNode(id, props = {}, children = []) {
  return {
    id,
    type: "form",
    props: normalizeProps(props),
    children,
  };
}

function buildFieldNode(id, props = {}) {
  const safe = normalizeProps(props);
  return {
    id,
    type: "field",
    props: {
      ...safe,
      value: normalizeValue(props.value),
    },
    children: [],
  };
}

function buildButtonNode(id, props = {}) {
  return {
    id,
    type: "button",
    props: normalizeProps(props),
    children: [],
  };
}

function buildContainerNode(id, props = {}, children = []) {
  return {
    id,
    type: "container",
    props: normalizeProps(props),
    children,
  };
}

function normalizeTextValue(value) {
  const normalized = normalizeValue(value);
  return typeof normalized === "string" ? normalized : cleanText(String(normalized || ""));
}

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

function createIdGenerator(prefix = "node") {
  let counter = 0;
  return () => `${prefix}-${++counter}`;
}

function createRowKey(columns, rowValues, index) {
  const signature = columns
    .map((column) => normalizeTextValue(rowValues[column.key]))
    .filter(Boolean)
    .join("|");

  return slugify(signature) || `row-${index + 1}`;
}

function shouldIgnoreTag(tagName) {
  return ["script", "style", "noscript"].includes(String(tagName || "").toLowerCase());
}

function isFieldTag(tagName, $node) {
  const tag = String(tagName || "").toLowerCase();
  if (tag === "select" || tag === "textarea") return true;
  if (tag !== "input") return false;

  const inputType = String($node.attr("type") || "text").toLowerCase();
  return !["submit", "button", "reset", "image", "hidden"].includes(inputType);
}

function isButtonTag(tagName, $node) {
  const tag = String(tagName || "").toLowerCase();
  if (!["input", "button", "a"].includes(tag) && ($node.is("[onclick]") || $node.is('[role="button"]'))) {
    return true;
  }
  if (tag === "button") return true;
  if (tag === "a") return Boolean(cleanText($node.attr("href")) || cleanText($node.attr("onclick")));
  if (tag !== "input") return false;

  const inputType = String($node.attr("type") || "text").toLowerCase();
  return ["submit", "button", "reset", "image"].includes(inputType);
}

function defaultButtonInputType(tagName, $node) {
  if (String(tagName || "").toLowerCase() === "button") {
    return String($node.attr("type") || "submit").toLowerCase();
  }

  if (String(tagName || "").toLowerCase() === "a") {
    return "navigate";
  }

  return String($node.attr("type") || "button").toLowerCase();
}

function inferFieldLabel($node, $) {
  const explicitLabel = cleanText($node.attr("aria-label") || $node.attr("placeholder"));
  if (explicitLabel) return explicitLabel;

  const id = cleanText($node.attr("id"));
  if (id) {
    const externalLabel = cleanText($(`label[for="${id}"]`).first().text());
    if (externalLabel) return externalLabel;
  }

  const parent = $node.parent();
  if (parent.length && parent[0]?.tagName?.toLowerCase() === "label") {
    const cloned = parent.clone();
    cloned.find("input, select, textarea, button").remove();
    const parentLabel = cleanText(cloned.text());
    if (parentLabel) return parentLabel;
  }

  return cleanText($node.attr("name") || $node.attr("id"));
}

function buildFieldProps($node, $) {
  const tagName = String($node[0]?.tagName || "").toLowerCase();
  const inputType =
    tagName === "input" ? String($node.attr("type") || "text").toLowerCase() : tagName || "text";

  const props = {
    name: cleanText($node.attr("name") || $node.attr("id")),
    label: inferFieldLabel($node, $),
    inputType,
    value: normalizeValue($node.val()),
    required: $node.is("[required]"),
    disabled: $node.is("[disabled]"),
    readOnly: $node.is("[readonly]"),
    placeholder: cleanText($node.attr("placeholder")),
  };

  if (tagName === "select") {
    props.options = $node
      .find("option")
      .map((_idx, optionEl) => {
        const option = $(optionEl);
        return {
          label: normalizeTextValue(option.text()),
          value: normalizeTextValue(option.attr("value") || option.text()),
          selected: option.is("[selected]"),
        };
      })
      .get()
      .filter((option) => option.label || option.value);
  }

  return props;
}

function buildButtonProps($node) {
  const tagName = String($node[0]?.tagName || "").toLowerCase();
  const inputType = defaultButtonInputType(tagName, $node);
  const label =
    normalizeTextValue($node.text()) ||
    normalizeTextValue($node.attr("value")) ||
    normalizeTextValue($node.attr("aria-label")) ||
    "Button";
  const href = cleanText($node.attr("href"));
  const dataUrl = cleanText(
    $node.attr("data-url") || $node.attr("data-endpoint") || $node.attr("formaction")
  );
  const onclick = cleanText($node.attr("onclick"));
  const onclickPathMatch = onclick.match(/['"]((?:\/)?(?:[a-z0-9_-]+\/)+[a-z0-9_.-]+(?:\?[^'"]*)?)['"]/i);
  const onclickPath = cleanText(onclickPathMatch?.[1]);
  const normalizedActionPath = cleanText(dataUrl || href || onclickPath);

  let action = null;
  if (href) {
    action = {
      type: "navigate",
      target: href,
      targetRoute: href,
      onSuccess: "no_update",
      method: "GET",
    };
  } else if (inputType === "submit") {
    action = {
      type: "submit_form",
      target: normalizedActionPath,
      onSuccess: "reload_page",
    };
  } else if (normalizedActionPath) {
    action = {
      type: "api_call",
      target: normalizedActionPath,
      method: cleanText($node.attr("data-method") || (onclickPath ? "GET" : "POST")).toUpperCase() || "POST",
      onSuccess: "reload_page",
    };
  }

  return {
    label,
    inputType,
    disabled: $node.is("[disabled]"),
    action,
  };
}

function buildControlDescriptors($root, $) {
  const descriptors = [];

  $root.find('input, select, textarea, button, a[href], [onclick], [role="button"]').each((_idx, controlEl) => {
    const $control = $(controlEl);
    const tagName = String(controlEl.tagName || "").toLowerCase();

    if (isFieldTag(tagName, $control)) {
      descriptors.push({
        kind: "field",
        props: buildFieldProps($control, $),
      });
      return;
    }

    if (isButtonTag(tagName, $control)) {
      descriptors.push({
        kind: "button",
        props: buildButtonProps($control),
      });
    }
  });

  return descriptors;
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
    const buttonDescriptor = controls.find((item) => item.kind === "button");
    if (buttonDescriptor) return buttonDescriptor;
    return controls[0];
  }

  return normalizeTextValue($cell.text());
}

function rowsLookLikeForm(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return false;

  let labeledControlRows = 0;
  for (const row of rows) {
    const cells = Array.isArray(row.cells) ? row.cells : [];
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

  return labeledControlRows >= 2;
}

function buildFormFromTable(table, $, rows, nextId) {
  if (!rowsLookLikeForm(rows)) return null;

  const children = [];

  for (const row of rows) {
    const cells = Array.isArray(row.cells) ? row.cells : [];
    if (cells.length === 0) continue;

    const label = normalizeTextValue(cells[0]?.text);
    const valueCell = cells[cells.length - 1] || cells[0];
    const value = valueCell?.value;

    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (cleanText(value.kind) === "field") {
        children.push(
          buildFieldNode(nextId(), {
            ...value.props,
            label: label || cleanText(value.props?.label),
          })
        );
        continue;
      }

      if (cleanText(value.kind) === "button") {
        const buttonLabel = cleanText(value.props?.label) || label || "Button";
        if (label && cleanText(label).toLowerCase() !== cleanText(buttonLabel).toLowerCase()) {
          children.push(buildTextNode(nextId(), { text: label }));
        }
        children.push(
          buildButtonNode(nextId(), {
            ...value.props,
            label: buttonLabel,
          })
        );
        continue;
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

    cells.each((cellIndex, cell) => {
      const column = columns[cellIndex] || { key: `col${cellIndex + 1}` };
      const $cell = $(cell);
      const cellValue = buildCellValue($cell, $);
      values[column.key] = normalizeValue(cellValue);
      rawCells.push({
        key: column.key,
        text: normalizeTextValue($cell.text()),
        value: cellValue,
      });
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

function flattenTextNode(node, $) {
  const text = normalizeTextValue($(node).text());
  if (!text) return null;
  return text;
}

function isTextNode(node) {
  return Boolean(node) && node.type === "text";
}

function isContainerNode(node) {
  return Boolean(node) && node.type === "container";
}

function hasMeaningfulContainerProps(props) {
  if (!props || typeof props !== "object") return false;
  return Boolean(cleanText(props.title) || cleanText(props.variant) === "section");
}

function sanitizeTableRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row, index) => {
      const valuesSource =
        row.values && typeof row.values === "object" && !Array.isArray(row.values) ? row.values : {};
      const values = {};

      Object.entries(valuesSource).forEach(([key, value]) => {
        values[key] = normalizeValue(value);
      });

      return {
        key: normalizeTextValue(row.key) || `row-${index + 1}`,
        values,
      };
    });
}

function sanitizeNode(node) {
  if (!node || typeof node !== "object") return null;

  const id = normalizeTextValue(node.id) || "erp-safe";
  if (!VALID_NODE_TYPES.has(node.type)) {
    return buildTextNode(id, { text: "Unsupported content." });
  }

  const rawProps = node.props && typeof node.props === "object" && !Array.isArray(node.props) ? node.props : {};
  const props = normalizeProps(rawProps);
  const children = Array.isArray(node.children) ? normalizeChildren(node.children) : [];

  let result;

  if (node.type === "text") {
    const text = normalizeTextValue(props.text);
    result = text ? buildTextNode(id, { ...props, text }) : null;
  } else if (node.type === "field") {
    result = buildFieldNode(id, { ...props, value: normalizeValue(rawProps.value) });
  } else if (node.type === "table") {
    result = buildTableNode(id, {
      ...props,
      title: normalizeTextValue(rawProps.title),
      columns: rawProps.columns,
      rows: sanitizeTableRows(rawProps.rows),
    });
  } else if (node.type === "container") {
    result = buildContainerNode(id, props, children);
  } else if (node.type === "form") {
    result = buildFormNode(id, props, children);
  } else if (node.type === "button") {
    result = buildButtonNode(id, props);
  } else {
    result = buildTextNode(id, { text: "Unsupported content." });
  }

  // DEBUG: Verify no objects leak into final node props
  if (result && result.props) {
    for (const [key, val] of Object.entries(result.props)) {
      if (STRUCTURAL_PROP_KEYS.has(key)) continue;
      if (val !== null && typeof val === "object") {
        console.warn(`[normalizeProps] OBJECT LEAK in prop "${key}" of node ${result.id}:`, val);
        result.props[key] = "";
      }
    }
  }

  console.log("FINAL NODE:", JSON.stringify(result, null, 2));
  return result;
}

function normalizeChildren(children) {
  const normalized = [];

  for (const child of Array.isArray(children) ? children : []) {
    const sanitizedChild = sanitizeNode(child);
    if (!sanitizedChild) continue;

    if (isContainerNode(sanitizedChild) && !hasMeaningfulContainerProps(sanitizedChild.props)) {
      const innerChildren = Array.isArray(sanitizedChild.children) ? sanitizedChild.children : [];
      if (innerChildren.length === 0) {
        continue;
      }
      if (innerChildren.length === 1) {
        normalized.push(innerChildren[0]);
        continue;
      }
      normalized.push(...innerChildren);
      continue;
    }

    if (isTextNode(sanitizedChild)) {
      const text = normalizeTextValue(sanitizedChild.props?.text);
      if (!text) continue;

      const previous = normalized[normalized.length - 1];
      if (isTextNode(previous)) {
        previous.props.text = normalizeTextValue(`${previous.props.text} ${text}`);
      } else {
        normalized.push({
          ...sanitizedChild,
          props: {
            ...sanitizedChild.props,
            text,
          },
        });
      }
      continue;
    }

    normalized.push(sanitizedChild);
  }

  return normalized;
}

function inferContainerVariant(tagName, children) {
  const normalizedTag = String(tagName || "").toLowerCase();
  if (["section", "article", "main"].includes(normalizedTag)) return "section";

  const childTypes = (Array.isArray(children) ? children : []).map((child) => child.type);
  if (childTypes.includes("table") || childTypes.includes("form")) return "section";
  return "group";
}

function walkDomNode(node, $, nextId) {
  if (!node) return null;

  if (node.type === "text") {
    const text = normalizeTextValue(node.data || "");
    return text ? buildTextNode(nextId(), { text }) : null;
  }

  if (node.type !== "tag") {
    return null;
  }

  const $node = $(node);
  const tagName = String(node.tagName || "").toLowerCase();

  if (shouldIgnoreTag(tagName)) {
    return null;
  }

  if (tagName === "table") {
    const tableNode = extractTableData($node, $, nextId(), nextId);
    if (!tableNode) {
      return null;
    }
    if (tableNode.type === "table" && (!Array.isArray(tableNode.props.rows) || tableNode.props.rows.length === 0)) {
      return null;
    }
    return tableNode;
  }

  if (tagName === "form") {
    const children = [];
    $node.contents().each((_idx, child) => {
      const childNode = walkDomNode(child, $, nextId);
      if (childNode) children.push(childNode);
    });

    const normalizedChildren = normalizeChildren(children).map((child) => {
      if (child.type !== "button") return child;
      const inputType = cleanText(child.props?.inputType).toLowerCase();
      if (inputType !== "submit") return child;

      const currentAction =
        child.props?.action && typeof child.props.action === "object" ? child.props.action : {};

      return {
        ...child,
        props: {
          ...child.props,
          action: {
            type: "submit_form",
            target:
              cleanText(currentAction.target) || cleanText($node.attr("action")),
            method: cleanText($node.attr("method")).toUpperCase() || "GET",
            onSuccess: cleanText(currentAction.onSuccess) || "reload_page",
          },
        },
      };
    });

    return buildFormNode(
      nextId(),
      {
        title: normalizeTextValue($node.attr("name") || $node.attr("id")),
        method: cleanText($node.attr("method")).toUpperCase() || "GET",
        action: cleanText($node.attr("action")),
      },
      normalizedChildren
    );
  }

  if (isFieldTag(tagName, $node)) {
    return buildFieldNode(nextId(), buildFieldProps($node, $));
  }

  if (isButtonTag(tagName, $node)) {
    return buildButtonNode(nextId(), buildButtonProps($node));
  }

  const children = [];
  $node.contents().each((_idx, child) => {
    const childNode = walkDomNode(child, $, nextId);
    if (childNode) children.push(childNode);
  });

  const normalizedChildren = normalizeChildren(children);

  if (normalizedChildren.length === 0) {
    const text = flattenTextNode(node, $);
    return text ? buildTextNode(nextId(), { text }) : null;
  }

  if (normalizedChildren.length === 1 && normalizedChildren[0].type === "text") {
    const inlineTags = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "li", "strong"];
    if (inlineTags.includes(tagName)) {
      return buildTextNode(nextId(), {
        text: normalizeTextValue(normalizedChildren[0].props?.text || ""),
      });
    }
  }

  return buildContainerNode(
    nextId(),
    { variant: inferContainerVariant(tagName, normalizedChildren) },
    normalizedChildren
  );
}

function buildDocument(contentRoot, $, title = "") {
  const nextId = createIdGenerator("erp");
  const children = [];

  contentRoot.contents().each((_idx, node) => {
    const child = walkDomNode(node, $, nextId);
    if (child) children.push(child);
  });

  const normalizedChildren = normalizeChildren(children);

  return {
    title: normalizeTextValue(title),
    root: buildContainerNode(
      "root",
      { variant: "section" },
      normalizedChildren.length > 0
        ? normalizedChildren
        : [buildTextNode(nextId(), { text: "No content available." })]
    ),
  };
}

module.exports = {
  buildTextNode,
  buildTableNode,
  buildFormNode,
  buildFieldNode,
  buildButtonNode,
  buildContainerNode,
  buildDocument,
};
