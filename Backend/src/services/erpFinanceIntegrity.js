const FINANCE_FEE_PAID_SOURCES = Object.freeze([
  {
    pageKey: "finance/fee-paid-details",
    dropdown: "Finance",
    subitem: "Fee Paid Details",
    label: "Fee Paid Details",
  },
  {
    pageKey: "finance/payment-acknowledgment",
    dropdown: "Finance",
    subitem: "Payment Acknowledgment",
    label: "Payment Acknowledgment",
  },
  {
    pageKey: "finance/online-payment-verification",
    dropdown: "Finance",
    subitem: "Online Payment Verification",
    label: "Online Payment Verification",
  },
]);

const FINANCE_FEE_PAID_PAGE_KEYS = new Set([
  "finance/fee-paid",
  ...FINANCE_FEE_PAID_SOURCES.map((source) => source.pageKey),
]);

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase().replace(/^\/+/, "").replace(/\/+$/, "");
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function tablesFromSection(section) {
  return Array.isArray(section?.tables) ? section.tables : [];
}

function countObjectRows(tables) {
  return tables.reduce((sum, table) => {
    if (!Array.isArray(table)) return sum;
    return sum + table.filter((row) => isRecord(row)).length;
  }, 0);
}

function findFinanceSection(payload, source) {
  if (!isRecord(payload)) return null;

  const directFinanceSection = payload?.[source.dropdown]?.[source.subitem];
  if (isRecord(directFinanceSection)) return directFinanceSection;

  if (Array.isArray(payload.tables)) return payload;

  const wantedSubitem = cleanText(source.subitem).toLowerCase();
  const wantedLabel = cleanText(source.label).toLowerCase();
  const stack = [payload];
  const visited = new Set();

  while (stack.length) {
    const current = stack.pop();
    if (!isRecord(current) || visited.has(current)) continue;
    visited.add(current);

    const title = cleanText(current.title).toLowerCase();
    if (Array.isArray(current.tables) && (title === wantedSubitem || title === wantedLabel)) {
      return current;
    }

    for (const [key, value] of Object.entries(current)) {
      if (key === "rawHtml" || key === "document") continue;
      if (cleanText(key).toLowerCase() === wantedSubitem && isRecord(value)) {
        return value;
      }
      if (isRecord(value)) stack.push(value);
    }
  }

  return null;
}

function getSourcesForPage(pageKey, targets = []) {
  const normalized = normalizeKey(pageKey);
  const targetPairs = new Set(
    (Array.isArray(targets) ? targets : [])
      .map((target) => `${cleanText(target?.dropdown)}::${cleanText(target?.subitem)}`.toLowerCase())
      .filter((key) => key !== "::")
  );

  if (normalized === "finance/fee-paid") return FINANCE_FEE_PAID_SOURCES;

  const exact = FINANCE_FEE_PAID_SOURCES.find((source) => source.pageKey === normalized);
  if (exact) return [exact];

  if (targetPairs.size > 0) {
    return FINANCE_FEE_PAID_SOURCES.filter((source) =>
      targetPairs.has(`${source.dropdown}::${source.subitem}`.toLowerCase())
    );
  }

  return [];
}

function extractFinanceFeePaidSourceStats({ pageKey, data, targets = [] }) {
  const normalized = normalizeKey(pageKey);
  if (!FINANCE_FEE_PAID_PAGE_KEYS.has(normalized)) return null;

  const sources = getSourcesForPage(normalized, targets).map((source) => {
    const section = findFinanceSection(data, source);
    const tables = tablesFromSection(section);
    const tableCount = tables.length;
    const rowCount = countObjectRows(tables);
    const warnings = [];

    if (!section) {
      warnings.push(`${source.label} section was not present in the ERP payload.`);
    } else if (rowCount === 0) {
      warnings.push(`${source.label} returned zero tabular rows.`);
    }

    return {
      pageKey: source.pageKey,
      label: source.label,
      dropdown: source.dropdown,
      subitem: source.subitem,
      status: !section ? "missing" : rowCount === 0 ? "empty" : "loaded",
      tableCount,
      rowCount,
      warnings,
    };
  });

  return {
    pageKey: normalized,
    sourceCount: sources.length,
    rawRowCount: sources.reduce((sum, source) => sum + source.rowCount, 0),
    sources,
  };
}

module.exports = {
  FINANCE_FEE_PAID_SOURCES,
  extractFinanceFeePaidSourceStats,
};
