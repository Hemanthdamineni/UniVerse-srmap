const {
  cleanText,
  normalizeMutationUrl,
} = require("./utils");

function isAllowedMutationUrl(url) {
  const normalized = normalizeMutationUrl(url);
  if (!normalized) return false;

  const allowlist = new Set([
    "students/transaction/mobilenumberverificationotp.jsp",
    "students/transaction/studentattendanceresources.jsp",
    "students/transaction/studentsonlinepaymentresponse.jsp",
  ]);

  return allowlist.has(normalized);
}

function mutationBlockReason(url) {
  const normalized = normalizeMutationUrl(url);
  if (!normalized) return "Blocked in wave 1: unsupported mutation endpoint.";

  if (
    normalized.includes("students/onlinepayments/") ||
    normalized.includes("students/transaction/feedues.jsp")
  ) {
    return "Blocked in wave 1: payment and dues actions are disabled.";
  }

  if (normalized.includes("students/registrations/sap")) {
    return "Blocked in wave 1: SAP mutations are disabled.";
  }

  if (normalized.includes("qrcodescanner.jsp")) {
    return "Blocked in wave 1: QR scanner mutation is disabled.";
  }

  if (normalized.includes("studentbankdetailsresource.jsp")) {
    return "Blocked in wave 1: bank save requires attachment upload integration.";
  }

  return "Blocked in wave 1: endpoint not allowlisted.";
}

function sanitizeField(field) {
  return {
    id: cleanText(field?.id) || undefined,
    name: cleanText(field?.name) || undefined,
    label: cleanText(field?.label) || undefined,
    tag: cleanText(field?.tag) || undefined,
    type: cleanText(field?.type) || "text",
    placeholder: cleanText(field?.placeholder) || undefined,
    helperText: cleanText(field?.helperText || field?.helpText || field?.description) || undefined,
    required: Boolean(field?.required),
    disabled: Boolean(field?.disabled),
    readOnly: Boolean(field?.readOnly),
    maxLength:
      typeof field?.maxLength === "number" && Number.isFinite(field.maxLength)
        ? field.maxLength
        : undefined,
    value: cleanText(field?.value) || undefined,
    options: Array.isArray(field?.options)
      ? field.options.slice(0, 40).map((option) => ({
          value: cleanText(option?.value),
          label: cleanText(option?.label),
          selected: Boolean(option?.selected),
        }))
      : undefined,
  };
}

function sanitizeForm(form) {
  return {
    id: cleanText(form?.id) || undefined,
    name: cleanText(form?.name) || undefined,
    method: cleanText(form?.method).toUpperCase() || "GET",
    action: cleanText(form?.action) || undefined,
    target: cleanText(form?.target) || undefined,
    autoComplete: cleanText(form?.autoComplete) || undefined,
    fields: Array.isArray(form?.fields) ? form.fields.map(sanitizeField) : [],
  };
}

function inferredFunctionName(control) {
  return cleanText(control?.inferredAction?.functionName || "");
}

function inferredActionKind(control) {
  return cleanText(control?.inferredAction?.kind || "");
}

function inferredArgs(control) {
  return Array.isArray(control?.inferredAction?.args) ? control.inferredAction.args : [];
}

function findMutationForControl(control, mutations) {
  const fnName = inferredFunctionName(control).toLowerCase();
  const label = cleanText(control?.label).toLowerCase();

  if (!mutations.length) return null;

  const direct = mutations.find((mutation) => cleanText(mutation?.fromFunction).toLowerCase() === fnName);
  if (direct) return direct;

  if (fnName === "funsendotp" || label.includes("send otp")) {
    const otpMutation = mutations.find(
      (mutation) => normalizeMutationUrl(mutation?.url) === "students/transaction/mobilenumberverificationotp.jsp"
    );
    if (otpMutation) return otpMutation;
  }

  if (fnName === "funprint") {
    const printMutation = mutations.find((mutation) =>
      normalizeMutationUrl(mutation?.url).includes("students/transaction/studentsonlinepaymentresponse.jsp")
    );
    if (printMutation) return printMutation;
  }

  if (label === "save") {
    const saveMutation = mutations.find((mutation) => /funsave/i.test(cleanText(mutation?.fromFunction)));
    if (saveMutation) return saveMutation;
  }

  return null;
}

module.exports = {
  isAllowedMutationUrl,
  mutationBlockReason,
  sanitizeForm,
  inferredFunctionName,
  inferredActionKind,
  inferredArgs,
  findMutationForControl,
};
