const { cleanText } = require("../../utils/text");
const {
  buildTextNode,
  buildFormNode,
  buildFieldNode,
  buildButtonNode,
  buildContainerNode,
  normalizeTextValue,
  normalizeChildren,
} = require("./nodeFactories");
const {
  shouldIgnoreTag,
  isFieldTag,
  isButtonTag,
  buildFieldProps,
  buildButtonProps,
} = require("./controlExtraction");
const { extractTableData } = require("./tableExtraction");

function createIdGenerator(prefix = "node") {
  let counter = 0;
  return () => `${prefix}-${++counter}`;
}

function flattenTextNode(node, $) {
  const text = normalizeTextValue($(node).text());
  if (!text) return null;
  return text;
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
  contentRoot.find("script, style, noscript").remove();
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
  buildDocument,
};
