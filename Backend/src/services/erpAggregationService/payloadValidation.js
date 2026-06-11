const { getPayloadContract } = require("../../config/erpPayloadContracts");

const SUSPICIOUS_TEXT_PATTERNS = [
  /\blogin with your application number\b/i,
  /\bddmmyyyy\b/i,
  /\bwelcome to srm university\b/i,
  /\bstudentloginpage\b/i,
  /\btxt(username|authkey)\b/i,
  /\bcaptcha\b/i,
  /\$\s*\(/i,
  /\.fail\s*\(/i,
  /e\.preventdefault\s*\(/i,
  /ajaxparameter\.push\s*\(/i,
  /\btextstatus\b/i,
  /\berrorthrown\b/i,
];

const PROFILE_EXPECTED_KEYWORDS = [
  "student name",
  "register no",
  "semester",
  "program",
  "specialization",
  "student contact number",
  "father name",
];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCompare(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function looksSuspiciousText(text) {
  const value = String(text || "").trim();
  if (!value) return false;
  return SUSPICIOUS_TEXT_PATTERNS.some((pattern) => pattern.test(value));
}

function findProfileTableContent(payload) {
  const queue = [payload];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!isRecord(current) || visited.has(current)) continue;
    visited.add(current);

    if (isRecord(current.TableContent)) {
      return current.TableContent;
    }

    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        for (const entry of value) queue.push(entry);
      } else if (isRecord(value)) {
        queue.push(value);
      }
    }
  }

  return null;
}

function isValidProfilePayload(payload) {
  const tableContent = findProfileTableContent(payload);
  if (!tableContent) return false;

  const keys = Object.keys(tableContent).map(normalizeCompare).filter(Boolean);
  if (keys.length < 4) return false;

  const keyHits = PROFILE_EXPECTED_KEYWORDS.filter((keyword) =>
    keys.some((key) => key.includes(keyword))
  ).length;

  return keyHits >= 2;
}

function collectPayloadSignals(payload) {
  const queue = [payload];
  const visited = new Set();
  const textSamples = [];
  let tableCount = 0;
  let externalLinkCount = 0;
  let meaningfulTextCount = 0;
  let structuredNodeCount = 0;
  let documentNodeCount = 0;

  const enqueueDocumentNodes = (document) => {
    const root = isRecord(document) && isRecord(document.root) ? document.root : document;
    const nodeQueue = [root];
    const nodeSeen = new Set();

    while (nodeQueue.length > 0) {
      const node = nodeQueue.shift();
      if (!isRecord(node) || nodeSeen.has(node)) continue;
      nodeSeen.add(node);

      const type = String(node.type || "").trim().toLowerCase();
      if (node !== root) {
        documentNodeCount += 1;
      }
      if (type === "table" || type === "form" || type === "field" || type === "button") {
        structuredNodeCount += 1;
      }

      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          nodeQueue.push(child);
        }
      }
    }
  };

  while (queue.length > 0) {
    const current = queue.shift();
    if (!isRecord(current) || visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current.tables)) {
      for (const table of current.tables) {
        if (Array.isArray(table)) {
          tableCount += 1;
        }
      }
    }

    if (typeof current.text === "string" && current.text.trim()) {
      const textValue = current.text.trim();
      textSamples.push(textValue.slice(0, 500));

      const titleValue =
        typeof current.title === "string" && current.title.trim() ? current.title.trim() : "";
      if (
        !looksSuspiciousText(textValue) &&
        normalizeCompare(textValue) !== normalizeCompare(titleValue)
      ) {
        meaningfulTextCount += 1;
      }
    }

    if (typeof current.title === "string" && current.title.trim()) {
      textSamples.push(current.title.trim());
    }

    if (isRecord(current.document)) {
      enqueueDocumentNodes(current.document);
    }

    if (typeof current.externalUrl === "string" && current.externalUrl.trim()) {
      externalLinkCount += 1;
    }

    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        for (const entry of value) queue.push(entry);
      } else if (isRecord(value)) {
        queue.push(value);
      }
    }
  }

  return {
    tableCount,
    externalLinkCount,
    meaningfulTextCount,
    structuredNodeCount,
    documentNodeCount,
    textSamples: textSamples.slice(0, 8),
  };
}

function resolveTargetSection(payload, target) {
  if (!isRecord(payload)) return null;
  const dropdown = String(target?.dropdown || "").trim();
  const subitem = String(target?.subitem || "").trim();
  const sectionKey = subitem || dropdown;
  if (!dropdown || !sectionKey) return null;

  const dropdownPayload = payload[dropdown];
  if (!isRecord(dropdownPayload)) return null;
  return dropdownPayload[sectionKey];
}

function collectSectionHeaders(section) {
  const headers = new Set();
  if (!section || typeof section !== "object") return headers;

  for (const table of Array.isArray(section.tables) ? section.tables : []) {
    for (const row of Array.isArray(table) ? table : []) {
      if (!row || typeof row !== "object") continue;
      for (const key of Object.keys(row)) {
        const normalized = normalizeCompare(key);
        if (normalized) headers.add(normalized);
      }
    }
  }

  return headers;
}

function validateSectionRules(pageKey, payload, rules) {
  const sectionRules = Array.isArray(rules) ? rules : [];
  if (!sectionRules.length) return { valid: true };

  for (const rule of sectionRules) {
    const section = resolveTargetSection(payload, rule);
    if (!isRecord(section)) {
      return {
        valid: false,
        code: "PAYLOAD_CONTRACT_MISMATCH",
        reason: `Payload contract mismatch for "${pageKey}": missing section ${rule.dropdown} -> ${
          rule.subitem || "(empty)"
        }`,
      };
    }

    const tableCount = Array.isArray(section.tables) ? section.tables.length : 0;
    if (Number(rule.minTableCount || 0) > 0 && tableCount < Number(rule.minTableCount)) {
      return {
        valid: false,
        code: "INVALID_UPSTREAM_PAYLOAD",
        reason: `Expected at least ${rule.minTableCount} table segment(s) for ${rule.dropdown} -> ${
          rule.subitem || "(empty)"
        }`,
      };
    }

    if (Array.isArray(rule.requiredHeadersAny) && rule.requiredHeadersAny.length) {
      const headers = collectSectionHeaders(section);
      const hasAny = rule.requiredHeadersAny.some((header) =>
        headers.has(normalizeCompare(header))
      );
      if (!hasAny) {
        return {
          valid: false,
          code: "INVALID_UPSTREAM_PAYLOAD",
          reason: `Expected canonical headers for ${rule.dropdown} -> ${rule.subitem || "(empty)"}`,
        };
      }
    }
  }

  return { valid: true };
}

function validateMappedTargetSections(pageKey, payload, targets) {
  const targetList = Array.isArray(targets) ? targets : [];
  if (!targetList.length) return { valid: true };
  if (!isRecord(payload)) {
    return {
      valid: false,
      code: "PAYLOAD_CONTRACT_MISMATCH",
      reason: `Payload contract mismatch for "${pageKey}": expected grouped ERP response object`,
    };
  }

  for (const target of targetList) {
    const section = resolveTargetSection(payload, target);
    if (!isRecord(section)) {
      return {
        valid: false,
        code: "PAYLOAD_CONTRACT_MISMATCH",
        reason: `Payload contract mismatch for "${pageKey}": missing section ${target.dropdown} -> ${
          target.subitem || "(empty)"
        }`,
      };
    }

    if (typeof section.error === "string" && section.error.trim()) {
      return {
        valid: false,
        code: "MISSING_ENDPOINT_MAPPING",
        reason: section.error.trim(),
      };
    }
  }

  return { valid: true };
}

function validateLivePayload(pageKey, payload, options = {}) {
  const contract = getPayloadContract(pageKey);
  const targets = options.targets || [];

  if (contract.kind === "profile") {
    if (isValidProfilePayload(payload)) {
      return { valid: true };
    }
    return {
      valid: false,
      code: "INVALID_UPSTREAM_PAYLOAD",
      reason: "Profile payload missing expected TableContent fields",
    };
  }

  if (contract.requireTargetSections) {
    const coverage = validateMappedTargetSections(pageKey, payload, targets);
    if (!coverage.valid) return coverage;
  }

  if (contract.sectionRules) {
    const sectionValidation = validateSectionRules(pageKey, payload, contract.sectionRules);
    if (!sectionValidation.valid) return sectionValidation;
  }

  const signals = collectPayloadSignals(payload);
  const hasSuspiciousText = signals.textSamples.some((sample) => looksSuspiciousText(sample));
  const allowsMeaningfulTextFallback =
    contract.allowMeaningfulTextFallback === true && signals.meaningfulTextCount > 0;
  const hasStructuredContent = signals.structuredNodeCount > 0 || signals.documentNodeCount > 0;

  if (
    Number(contract.minTableCount || 0) > 0 &&
    signals.tableCount < Number(contract.minTableCount) &&
    !allowsMeaningfulTextFallback &&
    !hasStructuredContent
  ) {
    return {
      valid: false,
      code: "INVALID_UPSTREAM_PAYLOAD",
      reason: `Expected at least ${contract.minTableCount} tabular payload segment(s) for "${pageKey}"`,
    };
  }

  if (
    contract.rejectSuspiciousText &&
    hasSuspiciousText &&
    signals.tableCount === 0 &&
    signals.externalLinkCount === 0 &&
    !hasStructuredContent
  ) {
    return {
      valid: false,
      code: "INVALID_UPSTREAM_PAYLOAD",
      reason: `Detected suspicious upstream HTML/script noise for "${pageKey}"`,
    };
  }

  return { valid: true };
}

module.exports = {
  validateLivePayload,
};
