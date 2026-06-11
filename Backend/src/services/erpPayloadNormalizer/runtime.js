const {
  cloneJson,
  normalizeSectionKey,
  runtimeTableToSummary,
  summaryToRuntimeTable,
  stableHeaderFingerprint,
} = require("./tableUtils");
const {
  applyTableRules,
  removeInternalMarksNestedHeaderRows,
} = require("./rules");

function applyLeafRules(nextPayload, context, diagnostics) {
  if (!Array.isArray(nextPayload?.tables)) return nextPayload;

  const normalizedTables = nextPayload.tables.map((rows, index) => {
    const summary = runtimeTableToSummary(rows, index);
    const normalized = applyTableRules(summary, context);
    diagnostics.appliedRules.push(...normalized.appliedRules);
    diagnostics.issues.push(
      ...normalized.issues.map((issue) => ({
        sectionKey: context.sectionKey,
        tableIndex: index,
        message: issue,
      }))
    );

    let table = normalized.table;
    if (context.sectionKey === "Examination::Internal Mark Details" && index === 0) {
      const cleaned = removeInternalMarksNestedHeaderRows(table);
      if (cleaned) {
        table = cleaned;
        diagnostics.appliedRules.push("remove_internal_marks_nested_header");
        diagnostics.issues.push({
          sectionKey: context.sectionKey,
          tableIndex: index,
          message: "Removed nested internal-mark header row.",
        });
      }
    }

    diagnostics.tableFingerprints.push({
      sectionKey: context.sectionKey,
      tableIndex: index,
      fingerprint: stableHeaderFingerprint(table.headers),
      headers: table.headers,
    });

    return summaryToRuntimeTable(table);
  });

  const nextMeta = {
    ...(nextPayload.meta && typeof nextPayload.meta === "object" ? nextPayload.meta : {}),
    normalization: {
      appliedRules: Array.from(new Set(diagnostics.appliedRules)),
      issues: diagnostics.issues,
      tableFingerprints: diagnostics.tableFingerprints,
      sectionKey: context.sectionKey,
    },
  };

  return {
    ...nextPayload,
    tables: normalizedTables,
    meta: nextMeta,
  };
}

function normalizeRuntimePayload(payload, context = {}) {
  if (!payload || typeof payload !== "object") {
    return {
      payload,
      meta: {
        appliedRules: [],
        issues: [],
        tableFingerprints: [],
        sectionKey: normalizeSectionKey(context.dropdown, context.subitem),
      },
    };
  }

  const diagnostics = {
    appliedRules: [],
    issues: [],
    tableFingerprints: [],
  };
  const nextPayload = cloneJson(payload);
  const sectionKey = normalizeSectionKey(context.dropdown, context.subitem);
  const normalizedPayload = applyLeafRules(nextPayload, { ...context, sectionKey }, diagnostics);

  return {
    payload: normalizedPayload,
    meta: normalizedPayload?.meta?.normalization || {
      appliedRules: [],
      issues: [],
      tableFingerprints: [],
      sectionKey,
    },
  };
}

module.exports = {
  normalizeRuntimePayload,
};
