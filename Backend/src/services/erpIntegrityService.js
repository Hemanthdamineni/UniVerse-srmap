const fs = require("fs");
const path = require("path");
const { normalizePageKey } = require("../config/erpPayloadContracts");

function readFileIfExists(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf8");
}

function readJsonIfExists(filePath) {
  const body = readFileIfExists(filePath);
  if (!body) return null;
  return JSON.parse(body);
}

function parseIsoMs(value) {
  const ms = Date.parse(String(value || ""));
  if (!Number.isFinite(ms)) return null;
  return ms;
}

function computeArtifactHealth({ filePath, generatedAt, maxAgeMs }) {
  const exists = Boolean(filePath && fs.existsSync(filePath));
  const generatedAtMs = parseIsoMs(generatedAt);
  let fallbackMtimeMs = null;

  if (!generatedAtMs && exists) {
    try {
      fallbackMtimeMs = Number(fs.statSync(filePath).mtimeMs || 0) || null;
    } catch {
      fallbackMtimeMs = null;
    }
  }

  const resolvedMs = generatedAtMs || fallbackMtimeMs;
  const ageMs = resolvedMs ? Date.now() - resolvedMs : null;
  const stale = ageMs == null || ageMs > maxAgeMs;

  return {
    exists,
    filePath: filePath || null,
    generatedAt: generatedAt || (fallbackMtimeMs ? new Date(fallbackMtimeMs).toISOString() : null),
    ageDays: ageMs == null ? null : Number((ageMs / (24 * 60 * 60 * 1000)).toFixed(2)),
    stale,
    maxAgeDays: Number((maxAgeMs / (24 * 60 * 60 * 1000)).toFixed(2)),
  };
}

function parseBlueprintFetchCoverage(filePath) {
  const source = readFileIfExists(filePath);
  if (!source) {
    return {
      loaded: false,
      filePath,
      erpKeys: new Set(),
      externalKeys: new Set(),
    };
  }

  const erpKeys = new Set();
  const externalKeys = new Set();

  const routeObjectRegex = /"\/[^"]+"\s*:\s*\{([\s\S]*?)\n\s*\},?/g;
  let routeMatch = routeObjectRegex.exec(source);

  while (routeMatch) {
    const block = routeMatch[1];
    const modeMatch = block.match(/sourceMode:\s*"([^"]+)"/);
    const fetchKeysMatch = block.match(/fetchKeys:\s*\[([\s\S]*?)\]/);

    const sourceMode = String(modeMatch?.[1] || "").trim().toLowerCase();
    const listBody = String(fetchKeysMatch?.[1] || "");
    const keys = Array.from(listBody.matchAll(/"([^"]+)"/g)).map((match) =>
      normalizePageKey(match[1])
    );

    if (sourceMode === "erp") {
      keys.forEach((key) => {
        if (key) erpKeys.add(key);
      });
    } else if (sourceMode === "external") {
      keys.forEach((key) => {
        if (key) externalKeys.add(key);
      });
    }

    routeMatch = routeObjectRegex.exec(source);
  }

  return {
    loaded: true,
    filePath,
    erpKeys,
    externalKeys,
  };
}

function makeTargetCoverage(scrapeTargets, discoveryRepository) {
  let totalTargets = 0;
  const missingMappings = [];

  for (const [pageKeyRaw, targets] of Object.entries(scrapeTargets || {})) {
    const pageKey = normalizePageKey(pageKeyRaw);
    const targetList = Array.isArray(targets) ? targets : [];

    for (const target of targetList) {
      totalTargets += 1;
      const endpoint = discoveryRepository?.resolveEndpoint?.(target?.dropdown, target?.subitem);
      if (endpoint) continue;

      missingMappings.push({
        pageKey,
        dropdown: String(target?.dropdown || ""),
        subitem: String(target?.subitem || ""),
      });
    }
  }

  return {
    totalTargets,
    mappedTargets: totalTargets - missingMappings.length,
    missingMappings,
  };
}

function setDifference(sourceSet, compareSet) {
  const missing = [];
  for (const value of sourceSet) {
    if (!compareSet.has(value)) missing.push(value);
  }
  return missing.sort();
}

class ErpIntegrityService {
  constructor({
    discoveryRepository,
    uiMapStore,
    scrapeTargets,
    externalSeedData,
    frontendBlueprintFile,
    maxArtifactAgeDays = 14,
  }) {
    this.discoveryRepository = discoveryRepository;
    this.uiMapStore = uiMapStore;
    this.scrapeTargets = scrapeTargets || {};
    this.externalSeedData = externalSeedData || {};
    this.frontendBlueprintFile = frontendBlueprintFile || "";
    this.maxArtifactAgeDays = Number(maxArtifactAgeDays || 14);
  }

  evaluate() {
    const maxAgeMs = Math.max(1, this.maxArtifactAgeDays) * 24 * 60 * 60 * 1000;
    const discoveryHealth = this.discoveryRepository?.getHealth?.() || {};
    const uiMapHealth = this.uiMapStore?.getHealth?.() || {};

    const frontendCoverage = parseBlueprintFetchCoverage(this.frontendBlueprintFile);

    const artifactHealth = {
      discovery: computeArtifactHealth({
        filePath: discoveryHealth.filePath,
        generatedAt: this.discoveryRepository?.raw?.generatedAt || null,
        maxAgeMs,
      }),
      uiMap: computeArtifactHealth({
        filePath: uiMapHealth.uiMapFile || null,
        generatedAt: this.uiMapStore?.raw?.generatedAt || null,
        maxAgeMs,
      }),
    };

    const scrapeTargetCoverage = makeTargetCoverage(this.scrapeTargets, this.discoveryRepository);

    const scrapeTargetKeySet = new Set(Object.keys(this.scrapeTargets || {}).map(normalizePageKey));
    const externalSeedKeySet = new Set(
      Object.keys(this.externalSeedData || {}).map((key) => normalizePageKey(key))
    );

    const activeErpKeys = frontendCoverage.loaded
      ? frontendCoverage.erpKeys
      : new Set(
          Object.entries(this.scrapeTargets || {})
            .filter(([, targets]) => Array.isArray(targets) && targets.length > 0)
            .map(([pageKey]) => normalizePageKey(pageKey))
        );

    const frontendErpCoverage = {
      totalKeys: frontendCoverage.erpKeys.size,
      missingInScrapeTargets: setDifference(frontendCoverage.erpKeys, scrapeTargetKeySet),
    };

    const frontendExternalCoverage = {
      totalKeys: frontendCoverage.externalKeys.size,
      missingInExternalSeed: setDifference(frontendCoverage.externalKeys, externalSeedKeySet),
    };

    const failures = [];
    if (!frontendCoverage.loaded) failures.push("frontend_blueprints_unavailable");
    if (scrapeTargetCoverage.missingMappings.length) failures.push("scrape_targets_missing_discovery_mapping");
    if (frontendErpCoverage.missingInScrapeTargets.length) failures.push("frontend_erp_keys_missing_scrape_target");
    if (frontendExternalCoverage.missingInExternalSeed.length) failures.push("frontend_external_keys_missing_seed_data");

    for (const [artifactKey, artifact] of Object.entries(artifactHealth)) {
      if (artifactKey === "uiMap") continue;
      if (!artifact.exists) failures.push(`${artifactKey}_artifact_missing`);
      else if (artifact.stale) failures.push(`${artifactKey}_artifact_stale`);
    }

    return {
      ok: failures.length === 0,
      checkedAt: new Date().toISOString(),
      maxArtifactAgeDays: this.maxArtifactAgeDays,
      frontend: {
        loaded: frontendCoverage.loaded,
        filePath: frontendCoverage.filePath || null,
      },
      artifacts: artifactHealth,
      coverage: {
        frontendErp: frontendErpCoverage,
        frontendExternal: frontendExternalCoverage,
        scrapeTargets: scrapeTargetCoverage,
      },
      failures,
    };
  }
}

function evaluateIntegrityStatic({
  scrapeTargets,
  externalSeedData,
  discoveryFile,
  uiMapFile,
  frontendBlueprintFile,
  maxArtifactAgeDays = 14,
}) {
  const discoveryRaw = readJsonIfExists(discoveryFile) || {};
  const discoveryLookup = new Map();
  for (const item of Array.isArray(discoveryRaw.resolvedItems) ? discoveryRaw.resolvedItems : []) {
    const key = `${normalizePageKey(item.dropdown)}::${normalizePageKey(item.subitem)}`;
    discoveryLookup.set(key, item.endpoint || null);
  }

  const discoveryRepository = {
    raw: discoveryRaw,
    resolveEndpoint(dropdown, subitem) {
      const key = `${normalizePageKey(dropdown)}::${normalizePageKey(subitem)}`;
      return discoveryLookup.get(key) || null;
    },
    getHealth() {
      return {
        filePath: discoveryFile,
      };
    },
  };

  const uiMapRaw = readJsonIfExists(uiMapFile) || {};
  const uiMapStore = {
    raw: uiMapRaw,
    getHealth() {
      return {
        uiMapFile,
      };
    },
  };

  const service = new ErpIntegrityService({
    discoveryRepository,
    uiMapStore,
    scrapeTargets,
    externalSeedData,
    frontendBlueprintFile,
    maxArtifactAgeDays,
  });

  return service.evaluate();
}

module.exports = {
  ErpIntegrityService,
  evaluateIntegrityStatic,
};
