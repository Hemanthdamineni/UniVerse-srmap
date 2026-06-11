const {
  isRecord,
  cleanText,
  cloneJson,
  runtimeTableToSummary,
  summaryToRuntimeTable,
  stableHeaderFingerprint,
} = require("./tableUtils");
const {
  applyTableRules,
  removeInternalMarksNestedHeaderRows,
} = require("./rules");

function normalizeArtifactItem(item) {
  if (!item || typeof item !== "object" || !item.data || !Array.isArray(item.data.tables)) {
    return item;
  }

  const diagnostics = {
    appliedRules: [],
    issues: [],
    tableFingerprints: [],
  };

  const nextTables = item.data.tables.map((table, index) => {
    let summary;
    if (Array.isArray(table)) {
      summary = runtimeTableToSummary(table, index);
    } else if (isRecord(table) && "sampleRows" in table && Array.isArray(table.sampleRows)) {
      summary = cloneJson(table);
    } else {
      return table;
    }

    const normalized = applyTableRules(summary, {
      sectionKey: String(item.key || ""),
      dropdown: item.dropdown,
      subitem: item.subitem,
    });

    diagnostics.appliedRules.push(...normalized.appliedRules);
    diagnostics.issues.push(
      ...normalized.issues.map((issue) => ({
        sectionKey: item.key,
        tableIndex: normalized.table.index,
        message: issue,
      }))
    );

    let nextTable = normalized.table;
    if (String(item.key || "") === "Examination::Internal Mark Details" && nextTable.index === 0) {
      const cleaned = removeInternalMarksNestedHeaderRows(nextTable);
      if (cleaned) {
        nextTable = cleaned;
        diagnostics.appliedRules.push("remove_internal_marks_nested_header");
        diagnostics.issues.push({
          sectionKey: item.key,
          tableIndex: nextTable.index,
          message: "Removed nested internal-mark header row.",
        });
      }
    }

    diagnostics.tableFingerprints.push({
      sectionKey: item.key,
      tableIndex: nextTable.index,
      fingerprint: stableHeaderFingerprint(nextTable.headers),
      headers: nextTable.headers,
    });

    return summaryToRuntimeTable(nextTable);
  });

  return {
    ...item,
    data: {
      ...item.data,
      tables: nextTables,
      normalization: {
        appliedRules: Array.from(new Set(diagnostics.appliedRules)),
        issues: diagnostics.issues,
        tableFingerprints: diagnostics.tableFingerprints,
      },
    },
  };
}

function collectLeafNormalization(value, output) {
  if (!value || typeof value !== "object") return;

  const normalization = value?.meta?.normalization;
  if (normalization && typeof normalization === "object") {
    for (const rule of normalization.appliedRules || []) {
      output.appliedRules.add(String(rule));
    }
    for (const issue of normalization.issues || []) {
      output.issues.push(issue);
    }
    for (const tableFingerprint of normalization.tableFingerprints || []) {
      output.tableFingerprints.push(tableFingerprint);
    }
  }
}

function collectNormalizationMeta(payload, targets = []) {
  const output = {
    appliedRules: new Set(),
    issues: [],
    tableFingerprints: [],
  };

  if (targets.length) {
    for (const target of targets) {
      const dropdown = cleanText(target?.dropdown);
      const subitem = cleanText(target?.subitem) || dropdown;
      const leaf = payload?.[dropdown]?.[subitem];
      collectLeafNormalization(leaf, output);
    }
  } else {
    collectLeafNormalization(payload, output);
  }

  return {
    appliedRules: Array.from(output.appliedRules),
    issues: output.issues,
    tableFingerprints: output.tableFingerprints,
  };
}

module.exports = {
  normalizeArtifactItem,
  collectNormalizationMeta,
};
