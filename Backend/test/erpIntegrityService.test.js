const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const {
  ErpIntegrityService,
  evaluateIntegrityStatic,
} = require("../src/services/erpIntegrityService");

const baseFixtureDir = path.join(__dirname, "fixtures", "integrity");

const scrapeTargets = {
  "academic/time-table": [{ dropdown: "Academic", subitem: "Time Table" }],
};

test("integrity checker passes on complete fresh fixture set", () => {
  const fixtureDir = path.join(baseFixtureDir, "pass");
  const report = evaluateIntegrityStatic({
    scrapeTargets,
    externalSeedData: {
      "external/demo": { summary: "ok", items: [] },
    },
    discoveryFile: path.join(fixtureDir, "endpoint-discovery.json"),
    uiMapFile: path.join(fixtureDir, "erp-ui-map.json"),
    frontendBlueprintFile: path.join(fixtureDir, "erpBlueprints.fixture"),
    maxArtifactAgeDays: 30,
  });

  assert.equal(report.ok, true);
  assert.equal(report.failures.length, 0);
  assert.equal(report.coverage.frontendErp.missingInScrapeTargets.length, 0);
});

test("integrity checker fails on stale/incomplete fixture set", () => {
  const fixtureDir = path.join(baseFixtureDir, "fail");
  const report = evaluateIntegrityStatic({
    scrapeTargets,
    externalSeedData: {},
    discoveryFile: path.join(fixtureDir, "endpoint-discovery.json"),
    uiMapFile: path.join(fixtureDir, "erp-ui-map.json"),
    frontendBlueprintFile: path.join(fixtureDir, "erpBlueprints.fixture"),
    maxArtifactAgeDays: 14,
  });

  assert.equal(report.ok, false);
  assert.ok(report.failures.includes("scrape_targets_missing_discovery_mapping"));
  assert.ok(report.failures.includes("frontend_external_keys_missing_seed_data"));
  assert.ok(report.failures.includes("discovery_artifact_stale"));
});

test("integrity service exposes freshness + coverage diagnostics", () => {
  const fixtureDir = path.join(baseFixtureDir, "pass");
  const discoveryRepository = {
    raw: { generatedAt: new Date().toISOString() },
    resolveEndpoint: () => ({ method: "POST", url: "x" }),
    getHealth: () => ({ loaded: true, filePath: path.join(fixtureDir, "endpoint-discovery.json") }),
  };

  const uiMapStore = {
    raw: { generatedAt: new Date().toISOString() },
    getHealth: () => ({ loaded: true, uiMapFile: path.join(fixtureDir, "erp-ui-map.json") }),
  };

  const service = new ErpIntegrityService({
    discoveryRepository,
    uiMapStore,
    scrapeTargets,
    externalSeedData: { "external/demo": { summary: "ok" } },
    frontendBlueprintFile: path.join(fixtureDir, "erpBlueprints.fixture"),
    maxArtifactAgeDays: 14,
  });

  const report = service.evaluate();

  assert.equal(typeof report.artifacts.discovery.ageDays, "number");
  assert.equal(typeof report.coverage.scrapeTargets.totalTargets, "number");
  assert.equal(Array.isArray(report.coverage.frontendExternal.missingInExternalSeed), true);
});
