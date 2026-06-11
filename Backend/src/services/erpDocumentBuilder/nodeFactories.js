const { cleanText } = require("../../utils/text");

const VALID_NODE_TYPES = new Set(["container", "text", "table", "form", "field", "button"]);
const STRUCTURAL_PROP_KEYS = new Set(["action", "options", "columns", "rows"]);

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
    return "";
  }

  return "";
}

function normalizeProps(props) {
  if (!props || typeof props !== "object" || Array.isArray(props)) return {};

  const result = {};
  for (const [key, val] of Object.entries(props)) {
    if (STRUCTURAL_PROP_KEYS.has(key)) {
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

  if (result && result.props) {
    for (const [key, val] of Object.entries(result.props)) {
      if (STRUCTURAL_PROP_KEYS.has(key)) continue;
      if (val !== null && typeof val === "object") {
        result.props[key] = "";
      }
    }
  }

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

module.exports = {
  normalizeValue,
  normalizeProps,
  buildTextNode,
  buildTableNode,
  buildFormNode,
  buildFieldNode,
  buildButtonNode,
  buildContainerNode,
  normalizeTextValue,
  normalizeChildren,
};
