const { cleanText } = require("../../utils/text");
const {
  normalizeValue,
  normalizeTextValue,
} = require("./nodeFactories");

function shouldIgnoreTag(tagName) {
  return ["script", "style", "noscript"].includes(String(tagName || "").toLowerCase());
}

function isFieldTag(tagName, $node) {
  const tag = String(tagName || "").toLowerCase();
  if (tag === "select" || tag === "textarea") return true;
  if (tag !== "input") return false;

  const inputType = String($node.attr("type") || "text").toLowerCase();
  return !["submit", "button", "reset", "image"].includes(inputType);
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
    id: cleanText($node.attr("id")),
    name: cleanText($node.attr("name") || $node.attr("id")),
    label: inferFieldLabel($node, $),
    inputType,
    value: normalizeValue($node.val()),
    checked: $node.is("[checked]") || $node.is(":checked"),
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
  let onclickPath = cleanText(onclickPathMatch?.[1]);
  const onclickFunctionName = cleanText(onclick.match(/\b([a-z][a-z0-9_]*)\s*\(/i)?.[1]).toLowerCase();

  if (!onclickPath) {
    const printMatch = onclick.match(/funPrint\(\s*['"]?(\d+)['"]?\s*\)/i);
    if (printMatch) {
      onclickPath = `/srmapstudentcorner/students/report/receiptgenerationprint.jsp?receiptid=${printMatch[1]}`;
    }
  }

  const normalizedActionPath = cleanText(dataUrl || href || onclickPath);

  let action = null;
  if (onclickFunctionName === "funprintapplication") {
    action = {
      type: "print_exam_application",
      target: "/srmapstudentcorner/students/report/PrintStudentExamApplication.jsp",
      method: "GET",
      onSuccess: "no_update",
    };
  } else if (href) {
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

module.exports = {
  shouldIgnoreTag,
  isFieldTag,
  isButtonTag,
  buildFieldProps,
  buildButtonProps,
  buildControlDescriptors,
};
