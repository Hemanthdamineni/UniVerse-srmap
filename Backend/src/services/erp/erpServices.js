const cheerio = require("cheerio");
const { cleanText } = require("../../utils/text");
const fs = require("fs");
const path = require("path");
const { normalizePageKey } = require("../../config/erpPayloadContracts");

// --- cgpaSummary.js ---
function normalizeSemesterLabel(value) {
  const label = cleanText(value);
  if (!label) return "";
  return label;
}

function romanToNumber(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return null;

  const romanMap = {
    I: 1,
    V: 5,
    X: 10,
  };

  let total = 0;
  let prev = 0;
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const symbol = normalized[index];
    const current = romanMap[symbol];
    if (!current) return null;
    if (current < prev) {
      total -= current;
    } else {
      total += current;
      prev = current;
    }
  }

  return total || null;
}

function extractSemesterNumber(value) {
  const label = cleanText(value);
  if (!label) return null;

  const arabicMatch = label.match(/\b(\d{1,2})\b/);
  if (arabicMatch) return Number(arabicMatch[1]);

  const romanMatch = label.match(/\b([IVX]{1,6})\b/i);
  if (romanMatch) return romanToNumber(romanMatch[1]);

  return null;
}

function extractCgpaValue(value) {
  const text = cleanText(value);
  if (!text) return "";
  const match = text.match(/\b(\d{1,2}(?:\.\d{1,3})?)\b/);
  return match ? match[1] : "";
}

function extractCgpaSummaryFromHtml(html = "") {
  const rawHtml = String(html || "");
  if (!rawHtml) {
    return {
      cgpa: "",
      sourceText: "",
    };
  }

  const $ = cheerio.load(rawHtml);
  const selectorCandidates = [
    "div[style*='float: right'][style*='font-size']",
    "div:contains('CGPA')",
    "span:contains('CGPA')",
    "td:contains('CGPA')",
  ];

  for (const selector of selectorCandidates) {
    const node = $(selector).first();
    const text = cleanText(node.text());
    const cgpa = extractCgpaValue(text);
    if (cgpa) {
      return {
        cgpa,
        sourceText: text,
      };
    }
  }

  const pageText = cleanText($.root().text());
  const cgpaMatch = pageText.match(/c\.?\s*g\.?\s*p\.?\s*a\.?\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,3})?)/i);
  return {
    cgpa: cgpaMatch ? cgpaMatch[1] : "",
    sourceText: pageText,
  };
}

function extractSemesterLabelFromProfile(profileData) {
  const tableContent =
    profileData && typeof profileData === "object" && profileData.TableContent
      ? profileData.TableContent
      : null;

  if (!tableContent || typeof tableContent !== "object") return "";

  const entries = Object.entries(tableContent);
  const semesterEntry = entries.find(([key]) => /semester/i.test(String(key || "")));
  if (!semesterEntry) return "";
  return normalizeSemesterLabel(semesterEntry[1]);
}

function buildCgpaSummaryPayload({
  cgpa,
  semesterLabel,
  semesterNumber,
  sourceText = "",
} = {}) {
  const rows = [];
  if (cgpa) {
    rows.push({ Metric: "Current CGPA", Value: cgpa });
  }
  if (semesterLabel) {
    rows.push({ Metric: "Current Semester", Value: semesterLabel });
  }
  if (semesterNumber) {
    rows.push({ Metric: "Semester Number", Value: String(semesterNumber) });
  }

  return {
    Academic: {
      "CGPA Summary": {
        title: "CGPA Summary",
        text: sourceText || [cgpa ? `Current CGPA: ${cgpa}` : "", semesterLabel ? `Current Semester: ${semesterLabel}` : ""]
          .filter(Boolean)
          .join("\n"),
        TableContent: {
          ...(cgpa ? { "Current CGPA": cgpa } : {}),
          ...(semesterLabel ? { Semester: semesterLabel } : {}),
          ...(semesterNumber ? { "Semester Number": String(semesterNumber) } : {}),
        },
        tables: rows.length ? [rows] : [],
        meta: {
          ...(cgpa ? { cgpa } : {}),
          ...(semesterLabel ? { semesterLabel } : {}),
          ...(semesterNumber ? { semesterNumber } : {}),
        },
      },
    },
  };
}

// --- erpCacheStore.js ---
class InMemoryErpCacheStore {
  constructor() {
    this.store = new Map();
    // Periodic sweep to prevent unbounded heap growth from expired entries
    // that are never read again. 5-minute interval balances memory safety
    // against CPU overhead.
    this._cleanupTimer = setInterval(() => this._sweepExpired(), 5 * 60 * 1000);
    this._cleanupTimer.unref();
  }

  /** Remove all expired entries from the store. */
  _sweepExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (!entry.expiresAt || entry.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }

  async get(cacheKey) {
    const entry = this.store.get(cacheKey);
    if (!entry) return null;

    if (!entry.expiresAt || entry.expiresAt <= Date.now()) {
      this.store.delete(cacheKey);
      return null;
    }

    return entry;
  }

  async set(cacheKey, value, ttlMs) {
    const expiresAt = Date.now() + Math.max(1000, Number(ttlMs) || 1000);
    this.store.set(cacheKey, {
      ...value,
      expiresAt,
    });
  }

  async delete(cacheKey) {
    this.store.delete(cacheKey);
  }

  async clear() {
    this.store.clear();
  }

  /** Release the periodic cleanup timer. Call during graceful shutdown. */
  close() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
  }

  async size() {
    return this.store.size;
  }
}

class RedisErpCacheStore {
  constructor(client) {
    this.client = client;
  }

  async get(cacheKey) {
    const raw = await this.client.get(cacheKey);
    if (!raw) return null;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    return parsed;
  }

  async set(cacheKey, value, ttlMs) {
    const ttlSec = Math.max(1, Math.ceil((Number(ttlMs) || 1000) / 1000));
    await this.client.set(cacheKey, JSON.stringify(value), { EX: ttlSec });
  }

  async delete(cacheKey) {
    await this.client.del(cacheKey);
  }

  async size() {
    return -1;
  }
}

// --- erpDumpService.js ---
const DUMP_BASE_DIR = path.join(__dirname, "../../data/erp-dump");

function encodeKey(dropdown, subitem) {
  const d = (dropdown || "").replace(/[/\\|]/g, "_");
  const s = (subitem || "").replace(/[/\\|]/g, "_");
  return `${d}|${s}`;
}

class ErpDumpService {
  constructor(dumpDir) {
    this.dumpDir = dumpDir;
    this.rawHtml = new Map();
    this.profile = null;
    this.summary = null;
    this._load();
  }

  static resolveLatest() {
    if (!fs.existsSync(DUMP_BASE_DIR)) return null;
    const entries = fs.readdirSync(DUMP_BASE_DIR);
    const dirs = entries
      .map((name) => path.join(DUMP_BASE_DIR, name))
      .filter((p) => fs.statSync(p).isDirectory())
      .sort()
      .reverse();
    return dirs.length > 0 ? dirs[0] : null;
  }

  static getBaseDir() {
    return DUMP_BASE_DIR;
  }

  _load() {
    const summaryPath = path.join(this.dumpDir, "summary.json");
    if (fs.existsSync(summaryPath)) {
      this.summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    }

    const profilePath = path.join(this.dumpDir, "profile.json");
    if (fs.existsSync(profilePath)) {
      this.profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    }

    const rawDir = path.join(this.dumpDir, "raw");
    if (fs.existsSync(rawDir)) {
      for (const file of fs.readdirSync(rawDir)) {
        if (!file.endsWith(".html")) continue;
        const key = file.slice(0, -5);
        const content = fs.readFileSync(path.join(rawDir, file), "utf8");
        this.rawHtml.set(key, content);
        const spaceNormalized = key.replace(/-/g, " ");
        if (spaceNormalized !== key) {
          this.rawHtml.set(spaceNormalized, content);
        }
      }
    }
  }

  hasRawHtml(dropdown, subitem) {
    return this.rawHtml.has(encodeKey(dropdown, subitem));
  }

  getRawHtml(dropdown, subitem) {
    return this.rawHtml.get(encodeKey(dropdown, subitem)) || null;
  }

  getProfile() {
    return this.profile;
  }

  getSummary() {
    return this.summary;
  }

  getAllPageKeys() {
    return Array.from(this.rawHtml.keys());
  }

  getDumpDir() {
    return this.dumpDir;
  }
}

// --- erpFinanceIntegrity.js ---
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

// --- erpIntegrityService.js ---
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

// --- erpLiveService.js ---
const {
  createApiContext,
  fetchProfileViaApi,
  callEndpointViaApi,
} = require("./erpClient");
const PER_PAGE_TARGET_CONCURRENCY = 4;

function extractStudentId(profileData) {
  const table = profileData?.TableContent || {};
  const entries = Object.entries(table);

  const candidates = entries.filter(([key]) =>
    /student\s*id/i.test(key) || /\bstu\s*id\b/i.test(key)
  );

  for (const [, value] of candidates) {
    const match = String(value || "").match(/\b(\d{3,})\b/);
    if (match) return Number(match[1]);
  }

  return null;
}

function resolveLoadDetailsEndpoint(discoveryRepository, target) {
  const loadDetailsId = target?.loadDetailsId;
  if (loadDetailsId === undefined || loadDetailsId === null || loadDetailsId === "") {
    return null;
  }

  const map = discoveryRepository?.raw?.functionMappings?.funLoadDetailsById;
  if (!map || typeof map !== "object") return null;

  const endpoint = map[String(loadDetailsId)];
  return endpoint && typeof endpoint === "object" ? endpoint : null;
}

async function mapWithConcurrency(items, limit, worker) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
  const results = new Array(items.length);
  let cursor = 0;

  async function runner() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: normalizedLimit }, () => runner()));
  return results;
}

class ErpLiveService {
  constructor({ sessionStore, discoveryRepository, scrapeTargets, erpDumpService }) {
    this.sessionStore = sessionStore;
    this.discoveryRepository = discoveryRepository;
    this.scrapeTargets = scrapeTargets;
    this.erpDumpService = erpDumpService || null;
  }

  async fetchProfile(sessionId) {
    if (this.erpDumpService?.getProfile()) {
      const profileData = this.erpDumpService.getProfile();
      const session = await this.sessionStore.getOrThrow(sessionId);
      await this.sessionStore.update(sessionId, { profileData });
      return profileData;
    }

    const session = await this.sessionStore.getOrThrow(sessionId);
    const api = await createApiContext(session.storageState);

    try {
      const profileData = await fetchProfileViaApi(api);
      const nextStorageState = await api.storageState();
      await this.sessionStore.update(sessionId, {
        profileData,
        storageState: nextStorageState,
      });
      return profileData;
    } finally {
      await api.dispose();
    }
  }

  async scrapeByKey(sessionId, pageKey) {
    if (pageKey === "academic/cgpa-summary") {
      return this.fetchCgpaSummary(sessionId);
    }

    // Parameterized key routed here so aggregation caching/single-flight apply;
    // see scrapeRoutes' earlier-internal-marks semester endpoint.
    const semesterMarksMatch = /^examination\/earlier-internal-marks\/semester\/(\d+)$/.exec(
      String(pageKey || "")
    );
    if (semesterMarksMatch) {
      return this.fetchEarlierInternalMarksSemester(sessionId, Number(semesterMarksMatch[1]));
    }

    const targets = this.scrapeTargets[pageKey];
    if (!targets) {
      const error = new Error(`Unknown pageKey: ${pageKey}`);
      error.status = 404;
      error.code = "NOT_FOUND";
      throw error;
    }

    if (pageKey !== "profile" && (!Array.isArray(targets) || targets.length === 0)) {
      const error = new Error(`No scrape targets configured for "${pageKey}"`);
      error.status = 502;
      error.code = "PAGE_TARGETS_EMPTY";
      throw error;
    }

    const session = await this.sessionStore.getOrThrow(sessionId);
    const stuId = extractStudentId(session.profileData);
    const variables = stuId ? { stuId } : null;

    if (pageKey === "profile") {
      return this.fetchProfile(sessionId);
    }

    const api = await createApiContext(session.storageState);
    try {
      const groupedResult = {};
      const resolvedTargets = targets.map((target) => {
        const endpoint =
          resolveLoadDetailsEndpoint(this.discoveryRepository, target) ||
          this.discoveryRepository.resolveEndpoint(target.dropdown, target.subitem);
        if (!endpoint) {
          const error = new Error(
            `No endpoint mapping for ${target.dropdown} -> ${target.subitem || "(empty)"}`
          );
          error.status = 502;
          error.code = "MISSING_ENDPOINT_MAPPING";
          throw error;
        }

        return {
          target,
          endpoint,
          key: target.subitem && target.subitem.trim() ? target.subitem : target.dropdown,
        };
      });

      const resolvedPayloads = await mapWithConcurrency(
        resolvedTargets,
        Math.min(PER_PAGE_TARGET_CONCURRENCY, resolvedTargets.length || 1),
        async ({ target, endpoint }) => {
          if (this.erpDumpService?.hasRawHtml(target.dropdown, target.subitem)) {
            const rawHtml = this.erpDumpService.getRawHtml(target.dropdown, target.subitem);
            return callEndpointViaApi(api, endpoint, target, variables, rawHtml);
          }
          return callEndpointViaApi(api, endpoint, target, variables);
        }
      );

      resolvedTargets.forEach(({ target, key }, index) => {
        if (!groupedResult[target.dropdown]) {
          groupedResult[target.dropdown] = {};
        }
        groupedResult[target.dropdown][key] = resolvedPayloads[index];
      });

      const nextStorageState = await api.storageState();
      await this.sessionStore.update(sessionId, { storageState: nextStorageState });
      return groupedResult;
    } finally {
      await api.dispose();
    }
  }

  async fetchEarlierInternalMarksSemester(sessionId, semesterNumber) {
    const semester = Number.parseInt(String(semesterNumber || ""), 10);
    if (!Number.isInteger(semester) || semester <= 0) {
      const error = new Error("Valid semester number is required");
      error.status = 400;
      throw error;
    }

    const session = await this.sessionStore.getOrThrow(sessionId);
    const stuId = extractStudentId(session.profileData);
    const variables = {
      argId: semester,
      ...(stuId ? { stuId } : {}),
    };

    const discoveredEndpoint =
      this.discoveryRepository.resolveHelperFunction("funEarlierInternalMarks");

    const endpoint = discoveredEndpoint || {
      method: "POST",
      url: "students/report/studentreportresources.jsp",
      paramsTemplate: {
        ids: "23",
        filter: "{{argId}}",
      },
      sourceFunction: "funEarlierInternalMarks",
    };

    const api = await createApiContext(session.storageState);
    try {
      const semesterKey = `Semester ${semester}`;
      let bodyOverride = null;
      if (this.erpDumpService?.hasRawHtml("Examination", semesterKey)) {
        bodyOverride = this.erpDumpService.getRawHtml("Examination", semesterKey);
      } else if (this.erpDumpService?.hasRawHtml("Examination", "Earlier Internal Marks")) {
        bodyOverride = this.erpDumpService.getRawHtml("Examination", "Earlier Internal Marks");
      }

      const parsed = await callEndpointViaApi(
        api,
        endpoint,
        {
          dropdown: "Examination",
          subitem: semesterKey,
        },
        variables,
        bodyOverride
      );

      const nextStorageState = await api.storageState();
      await this.sessionStore.update(sessionId, { storageState: nextStorageState });
      return parsed;
    } finally {
      await api.dispose();
    }
  }

  async fetchCgpaSummary(sessionId) {
    const session = await this.sessionStore.getOrThrow(sessionId);
    const endpoint =
      this.discoveryRepository.resolveEndpoint("Examination", "Exam Mark Details") || {
        method: "POST",
        url: "students/report/studentreportresources.jsp",
        paramsTemplate: { ids: "6" },
        argId: 6,
      };

    const api = await createApiContext(session.storageState);
    try {
      let bodyOverride = null;
      if (this.erpDumpService?.hasRawHtml("Examination", "Exam Mark Details")) {
        bodyOverride = this.erpDumpService.getRawHtml("Examination", "Exam Mark Details");
      }

      const parsed = await callEndpointViaApi(
        api,
        endpoint,
        {
          dropdown: "Academic",
          subitem: "CGPA Summary",
        },
        null,
        bodyOverride
      );

      const nextStorageState = await api.storageState();
      await this.sessionStore.update(sessionId, { storageState: nextStorageState });

      const semesterLabel = extractSemesterLabelFromProfile(session.profileData);
      const cgpaSummary = extractCgpaSummaryFromHtml(parsed.rawHtml || parsed.text || "");
      const semesterNumber = extractSemesterNumber(semesterLabel);

      return buildCgpaSummaryPayload({
        cgpa: cgpaSummary.cgpa,
        semesterLabel,
        semesterNumber,
        sourceText: cgpaSummary.sourceText,
      });
    } finally {
      await api.dispose();
    }
  }
}

module.exports = {
  extractCgpaSummaryFromHtml,
  extractSemesterLabelFromProfile,
  extractSemesterNumber,
  buildCgpaSummaryPayload,
  InMemoryErpCacheStore,
  RedisErpCacheStore,
  ErpDumpService,
  encodeKey,
  FINANCE_FEE_PAID_SOURCES,
  extractFinanceFeePaidSourceStats,
  ErpIntegrityService,
  evaluateIntegrityStatic,
  ErpLiveService,
  extractStudentId,
};