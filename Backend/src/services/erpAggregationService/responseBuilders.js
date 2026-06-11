const { extractFinanceFeePaidSourceStats } = require("../erpFinanceIntegrity");
const { log } = require("../../utils/logger");
const {
  setFinancePaidSourceRows,
} = require("../metricsService");
const { nowIso } = require("./helpers");

function makeResponse({ pageKey, source, policyMode, data, fetchedAt, staleAt, warnings, meta }) {
  return {
    success: true,
    pageKey,
    source,
    fetchedAt: fetchedAt || nowIso(),
    staleAt: staleAt || null,
    policyMode,
    data,
    meta: meta && typeof meta === "object" ? meta : undefined,
    warnings: Array.isArray(warnings) ? warnings : [],
  };
}

function makeMeta({ pageKey, data, targets, normalizationMeta, responseSource, policyMode }) {
  const meta = {
    normalizationRules: normalizationMeta.appliedRules,
    issues: normalizationMeta.issues,
    targets,
  };
  const financePaidIntegrity = extractFinanceFeePaidSourceStats({
    pageKey,
    data,
    targets,
  });

  if (!financePaidIntegrity) return meta;

  for (const source of financePaidIntegrity.sources) {
    setFinancePaidSourceRows({
      pageKey: financePaidIntegrity.pageKey,
      source: source.label,
      rowCount: source.rowCount,
    });
  }

  log({
    level: "info",
    msg: "ERP fee-paid source row counts",
    pageKey: financePaidIntegrity.pageKey,
    responseSource,
    policyMode,
    rawRowCount: financePaidIntegrity.rawRowCount,
    sources: financePaidIntegrity.sources.map((source) => ({
      pageKey: source.pageKey,
      label: source.label,
      status: source.status,
      tableCount: source.tableCount,
      rowCount: source.rowCount,
      warnings: source.warnings,
    })),
  });

  return {
    ...meta,
    financePaidIntegrity,
  };
}

module.exports = {
  makeResponse,
  makeMeta,
};
