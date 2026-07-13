const { ERP_UPSTREAM_ACQUIRE_TIMEOUT_MS, ERP_CACHED_TIMEOUT_MS, ERP_LIVE_TIMEOUT_MS, FEATURE_ERP_CACHED_FIRST, ERP_CACHE_FRESH_TTL_MS, ERP_CACHE_STALE_TTL_MS, ERP_DISTRIBUTED_LOCK_TTL_MS, ERP_CIRCUIT_REDIS_TTL_MS, ERP_CIRCUIT_FAILURE_THRESHOLD, ERP_CIRCUIT_COOLDOWN_MS, ERP_UPSTREAM_MAX_CONCURRENCY, FEATURE_ERP_DISTRIBUTED_LOCK } = require("../../config/env");
const { Semaphore, withTimeout } = require("../../utils/asyncUtils");
const { randomUUID } = require("crypto");
const { setCircuitState, setUpstreamLoad, setFinancePaidSourceRows, erpCacheResultTotal, erpFetchSourceTotal, erpUpstreamFailuresTotal, observeErpSourceLatency, updateCacheHitRatio } = require("../campus/feedbackServices");
const { extractFinanceFeePaidSourceStats } = require("./erpServices");
const { log } = require("../../utils/logger");
const { getPayloadContract } = require("../../config/erpPayloadContracts");

// --- responseBuilders.js (utility) ---

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

function makeMeta({ pageKey, data, targets, responseSource, policyMode }) {
  const meta = {
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

// --- payloadValidation.js (utility) ---

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

function validateExtractedTargetSections(pageKey, payload, targets) {
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

    if (section.externalUrl) {
      continue;
    }

    if (!isRecord(section._extracted)) {
      return {
        valid: false,
        code: "MISSING_EXTRACTED_PAYLOAD",
        reason: `Payload contract mismatch for "${pageKey}": missing _extracted for ${target.dropdown} -> ${
          target.subitem || "(empty)"
        }`,
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

  if (contract.requireExtractedPayload) {
    const extractedCoverage = validateExtractedTargetSections(pageKey, payload, targets);
    if (!extractedCoverage.valid) return extractedCoverage;
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

// --- helpers.js (utility) ---
function nowIso() {
  return new Date().toISOString();
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// --- serviceBasics.js ---

const serviceBasicsMethods = {
  getTargetsForPage(pageKey) {
    return Array.isArray(this.scrapeTargets?.[pageKey]) ? this.scrapeTargets[pageKey] : [];
  },

  cacheKeyFor(userKey, pageKey) {
    return `erp:${userKey}:${normalizeKey(pageKey)}`;
  },

  lockKeyFor(cacheKey) {
    return `${cacheKey}:live:lock`;
  },

  circuitKeyFor(pageKey) {
    return `erp:circuit:${normalizeKey(pageKey)}`;
  },

  updateSemaphoreMetrics(policyMode) {
    const stats = this.semaphore.stats();
    setUpstreamLoad({
      className: policyMode,
      inFlight: stats.inFlight,
      queued: stats.queued,
    });
  },

  async resolveUserKey(sessionId) {
    if (!sessionId) return "anonymous";
    try {
      const session = await this.sessionStore.getOrThrow(sessionId);
      const profile = session?.profileData?.TableContent || {};
      const userId =
        String(profile["Register No."] || profile["Student ID"] || profile["StuId"] || "").trim();
      if (userId) return userId.toLowerCase();
      return String(sessionId).trim().toLowerCase();
    } catch {
      return String(sessionId || "anonymous").trim().toLowerCase() || "anonymous";
    }
  },

  isFresh(entry) {
    return Boolean(entry && Number(entry.staleAt) > Date.now());
  },

  isStale(entry) {
    return Boolean(entry && Number(entry.expiresAt) > Date.now());
  },

  getEffectivePolicyMode(pageKey, overrideMode) {
    const resolved = this.pagePolicyStore.resolveMode(pageKey, overrideMode);
    if (!FEATURE_ERP_CACHED_FIRST) {
      return "live-first";
    }

    return resolved;
  },

  getTimeoutMs(policyMode) {
    return policyMode === "live-first" ? ERP_LIVE_TIMEOUT_MS : ERP_CACHED_TIMEOUT_MS;
  },
};

// --- circuitAndCache.js ---

const circuitAndCacheMethods = {
  async getCircuitState(pageKey) {
    const key = normalizeKey(pageKey);

    if (this.redisClient) {
      try {
        const raw = await this.redisClient.get(this.circuitKeyFor(key));
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            failures: Number(parsed.failures || 0),
            openUntilMs: Number(parsed.openUntilMs || 0),
          };
        }
      } catch {
        // Degrade to in-memory state.
      }
    }

    return this.circuitByPage.get(key) || { failures: 0, openUntilMs: 0 };
  },

  async saveCircuitState(pageKey, state) {
    const key = normalizeKey(pageKey);
    this.circuitByPage.set(key, state);
    setCircuitState({ pageKey: key, isOpen: Number(state.openUntilMs || 0) > Date.now() });

    if (this.redisClient) {
      try {
        const ttlSec = Math.max(1, Math.ceil(ERP_CIRCUIT_REDIS_TTL_MS / 1000));
        await this.redisClient.set(this.circuitKeyFor(key), JSON.stringify(state), {
          EX: ttlSec,
        });
      } catch {
        // Degrade to in-memory state.
      }
    }
  },

  async clearCircuitState(pageKey) {
    const key = normalizeKey(pageKey);
    this.circuitByPage.delete(key);
    setCircuitState({ pageKey: key, isOpen: false });
    if (this.redisClient) {
      try {
        await this.redisClient.del(this.circuitKeyFor(key));
      } catch {
        // No-op
      }
    }
  },

  async markCircuitSuccess(pageKey) {
    await this.clearCircuitState(pageKey);
  },

  async markCircuitFailure(pageKey) {
    const key = normalizeKey(pageKey);
    const prev = await this.getCircuitState(key);
    const failures = Number(prev.failures || 0) + 1;

    const next = {
      failures,
      openUntilMs:
        failures >= ERP_CIRCUIT_FAILURE_THRESHOLD
          ? Date.now() + ERP_CIRCUIT_COOLDOWN_MS
          : Number(prev.openUntilMs || 0),
    };

    await this.saveCircuitState(key, next);
  },

  async canCallLive(pageKey) {
    const circuit = await this.getCircuitState(pageKey);
    if (!circuit.openUntilMs) return true;
    return Date.now() >= circuit.openUntilMs;
  },

  async acquireDistributedLock(lockKey) {
    if (!this.lockEnabled) return null;

    const token = randomUUID();
    const start = Date.now();
    const maxWaitMs = Math.max(500, Math.min(2500, Math.floor(ERP_DISTRIBUTED_LOCK_TTL_MS / 2)));

    while (Date.now() - start < maxWaitMs) {
      try {
        const result = await this.redisClient.set(lockKey, token, {
          NX: true,
          PX: Math.max(1000, ERP_DISTRIBUTED_LOCK_TTL_MS),
        });
        if (result === "OK") {
          return token;
        }
      } catch {
        return null;
      }

      await sleep(60);
    }

    const error = new Error("Upstream request coalescing lock timeout");
    error.status = 503;
    error.code = "LOCK_TIMEOUT";
    throw error;
  },

  async releaseDistributedLock(lockKey, token) {
    if (!this.lockEnabled || !token) return;
    try {
      const current = await this.redisClient.get(lockKey);
      if (current === token) {
        await this.redisClient.del(lockKey);
      }
    } catch {
      // Best effort only.
    }
  },

  async readCacheEntry(cacheKey) {
    return this.cacheStore.get(cacheKey);
  },

  async getOrRunInflight(inflightKey, loader) {
    if (this.inflightByKey.has(inflightKey)) {
      return this.inflightByKey.get(inflightKey);
    }

    const promise = (async () => {
      try {
        return await loader();
      } finally {
        this.inflightByKey.delete(inflightKey);
      }
    })();

    this.inflightByKey.set(inflightKey, promise);
    return promise;
  },

  async writeCache(cacheKey, pageKey, data) {
    const fetchedAtMs = Date.now();
    const staleAtMs = fetchedAtMs + ERP_CACHE_FRESH_TTL_MS;
    const expiresAtMs = fetchedAtMs + ERP_CACHE_STALE_TTL_MS;

    const entry = {
      pageKey,
      data,
      fetchedAt: new Date(fetchedAtMs).toISOString(),
      staleAt: staleAtMs,
      expiresAt: expiresAtMs,
    };

    await this.cacheStore.set(cacheKey, entry, ERP_CACHE_STALE_TTL_MS);
    return entry;
  },
};

// --- fetchers.js ---

const fetcherMethods = {
  async fetchLive({ pageKey, sessionId, policyMode, cacheKey }) {
    if (!sessionId) {
      const error = new Error("sessionId is required for live ERP fetch");
      error.status = 401;
      error.code = "UNAUTHORIZED";
      throw error;
    }

    if (!(await this.canCallLive(pageKey))) {
      const error = new Error("Live ERP temporarily unavailable due to upstream instability");
      error.status = 503;
      error.code = "CIRCUIT_OPEN";
      throw error;
    }

    const inflightKey = `${cacheKey}:live`;

    return this.getOrRunInflight(inflightKey, async () => {
      let distributedLockToken = null;
      const lockKey = this.lockKeyFor(cacheKey);

      try {
        distributedLockToken = await this.acquireDistributedLock(lockKey);
      } catch (lockError) {
        const waitUntil = Date.now() + 1200;
        while (Date.now() < waitUntil) {
          const cached = await this.fromCache({
            pageKey,
            policyMode,
            cacheKey,
            recordMetrics: false,
          });
          if (cached && cached.source !== "cache-stale") {
            return {
              ...cached,
              warnings: [
                ...(cached.warnings || []),
                "Returned coalesced result while another node refreshed source data",
              ],
            };
          }
          await sleep(80);
        }
        throw lockError;
      }

      const startedAt = Date.now();
      this.updateSemaphoreMetrics(policyMode);
      const release = await this.semaphore.acquire(ERP_UPSTREAM_ACQUIRE_TIMEOUT_MS);
      this.updateSemaphoreMetrics(policyMode);

      try {
        const timeoutMs = this.getTimeoutMs(policyMode);
        const data = await withTimeout(
          this.liveService.scrapeByKey(sessionId, pageKey),
          timeoutMs,
          `Live ERP timeout for ${pageKey}`
        );

        const payloadValidation = validateLivePayload(pageKey, data, {
          targets: this.getTargetsForPage(pageKey),
        });
        if (!payloadValidation.valid) {
          const error = new Error(payloadValidation.reason);
          error.status = 502;
          error.code = payloadValidation.code || "INVALID_UPSTREAM_PAYLOAD";
          throw error;
        }

        const cached = await this.writeCache(cacheKey, pageKey, data);
        await this.markCircuitSuccess(pageKey);

        erpFetchSourceTotal.inc({ source: "live", policy: policyMode });
        observeErpSourceLatency({
          source: "live",
          policy: policyMode,
          pageKey,
          durationMs: Date.now() - startedAt,
        });

        return makeResponse({
          pageKey,
          source: "live",
          policyMode,
          data,
          meta: makeMeta({
            pageKey,
            data,
            targets: this.getTargetsForPage(pageKey),
            responseSource: "live",
            policyMode,
          }),
          fetchedAt: cached.fetchedAt,
          staleAt: new Date(cached.staleAt).toISOString(),
          warnings: [],
        });
      } catch (error) {
        if (!error.code && error.status === 503) {
          error.code = "UPSTREAM_SATURATED";
        }
        await this.markCircuitFailure(pageKey);
        erpUpstreamFailuresTotal.inc({ reason: error.code || "live_error" });
        throw error;
      } finally {
        release();
        this.updateSemaphoreMetrics(policyMode);
        await this.releaseDistributedLock(lockKey, distributedLockToken);
      }
    });
  },

  async triggerBackgroundRefresh({ pageKey, sessionId, policyMode, cacheKey }) {
    if (!sessionId) return;

    this.fetchLive({ pageKey, sessionId, policyMode, cacheKey }).catch(() => {
      // Best-effort background refresh; foreground request already served.
    });
  },

  async fromCache({ pageKey, policyMode, cacheKey, recordMetrics = true }) {
    const startedAt = Date.now();
    const entry = await this.readCacheEntry(cacheKey);

    if (!entry) {
      if (recordMetrics) {
        erpCacheResultTotal.inc({ result: "miss" });
        updateCacheHitRatio({ policy: policyMode, result: "miss" });
      }
      return null;
    }

    const payloadValidation = validateLivePayload(pageKey, entry.data, {
      targets: this.getTargetsForPage(pageKey),
    });
    if (!payloadValidation.valid) {
      await this.cacheStore.delete(cacheKey);

      if (recordMetrics) {
        erpCacheResultTotal.inc({ result: "miss" });
        updateCacheHitRatio({ policy: policyMode, result: "miss" });
      }
      return null;
    }

    if (this.isFresh(entry)) {
      if (recordMetrics) {
        erpCacheResultTotal.inc({ result: "fresh" });
        erpFetchSourceTotal.inc({ source: "cache-fresh", policy: policyMode });
        updateCacheHitRatio({ policy: policyMode, result: "fresh" });
        observeErpSourceLatency({
          source: "cache-fresh",
          policy: policyMode,
          pageKey,
          durationMs: Date.now() - startedAt,
        });
      }

      return makeResponse({
        pageKey,
        source: "cache-fresh",
        policyMode,
        data: entry.data,
        meta: makeMeta({
          pageKey,
          data: entry.data,
          targets: this.getTargetsForPage(pageKey),
          responseSource: "cache-fresh",
          policyMode,
        }),
        fetchedAt: entry.fetchedAt,
        staleAt: new Date(entry.staleAt).toISOString(),
        warnings: [],
      });
    }

    if (this.isStale(entry)) {
      if (recordMetrics) {
        erpCacheResultTotal.inc({ result: "stale" });
        erpFetchSourceTotal.inc({ source: "cache-stale", policy: policyMode });
        updateCacheHitRatio({ policy: policyMode, result: "stale" });
        observeErpSourceLatency({
          source: "cache-stale",
          policy: policyMode,
          pageKey,
          durationMs: Date.now() - startedAt,
        });
      }

      return makeResponse({
        pageKey,
        source: "cache-stale",
        policyMode,
        data: entry.data,
        meta: makeMeta({
          pageKey,
          data: entry.data,
          targets: this.getTargetsForPage(pageKey),
          responseSource: "cache-stale",
          policyMode,
        }),
        fetchedAt: entry.fetchedAt,
        staleAt: new Date(entry.staleAt).toISOString(),
        warnings: ["Stale cache served while background refresh runs"],
      });
    }

    if (recordMetrics) {
      erpCacheResultTotal.inc({ result: "expired" });
      updateCacheHitRatio({ policy: policyMode, result: "miss" });
    }
    return null;
  },
};

// --- pageAccess.js ---
const pageAccessMethods = {
  async getPage({ pageKey, sessionId, modeOverride = "" }) {
    const normalizedPageKey = normalizeKey(pageKey);
    if (!normalizedPageKey) {
      const error = new Error("pageKey is required");
      error.status = 400;
      error.code = "BAD_REQUEST";
      throw error;
    }

    const policyMode = this.getEffectivePolicyMode(normalizedPageKey, modeOverride);

    const userKey = await this.resolveUserKey(sessionId);
    const cacheKey = this.cacheKeyFor(userKey, normalizedPageKey);

    const cached = await this.fromCache({
      pageKey: normalizedPageKey,
      policyMode,
      cacheKey,
    });

    if (policyMode === "cached-first") {
      if (cached?.source === "cache-fresh") {
        return cached;
      }

      if (cached?.source === "cache-stale") {
        this.triggerBackgroundRefresh({
          pageKey: normalizedPageKey,
          sessionId,
          policyMode,
          cacheKey,
        });
        return cached;
      }

      try {
        return await this.fetchLive({
          pageKey: normalizedPageKey,
          sessionId,
          policyMode,
          cacheKey,
        });
      } catch (liveError) {
        throw liveError;
      }
    }

    try {
      return await this.fetchLive({
        pageKey: normalizedPageKey,
        sessionId,
        policyMode,
        cacheKey,
      });
    } catch (liveError) {
      if (liveError.status === 401) throw liveError;

      if (cached) {
        return {
          ...cached,
          warnings: [
            ...(cached.warnings || []),
            `Live ERP failed: ${liveError.message || "Unknown live source error"}`,
          ],
        };
      }

      throw liveError;
    }
  },

  async getBatch({ pageKeys, sessionId, modeOverride = "" }) {
    const list = Array.isArray(pageKeys) ? pageKeys.map(normalizeKey).filter(Boolean) : [];

    if (!list.length) {
      const error = new Error("pageKeys[] is required");
      error.status = 400;
      error.code = "BAD_REQUEST";
      throw error;
    }

    const entries = await Promise.all(
      list.map(async (pageKey) => {
        try {
          const payload = await this.getPage({
            pageKey,
            sessionId,
            modeOverride,
          });
          return [pageKey, payload];
        } catch (error) {
          return [
            pageKey,
            {
              success: false,
              pageKey,
              error: error.message || "Unknown error",
              status: error.status || 500,
              code: error.code || "INTERNAL_ERROR",
            },
          ];
        }
      })
    );

    return Object.fromEntries(entries);
  },
};

// --- class ---

class ErpAggregationService {
  constructor({
    liveService,
    cacheStore,
    pagePolicyStore,
    sessionStore,
    redisClient = null,
  }) {
    this.liveService = liveService;
    this.cacheStore = cacheStore;
    this.pagePolicyStore = pagePolicyStore;
    this.sessionStore = sessionStore;
    this.redisClient = redisClient;
    this.scrapeTargets = liveService?.scrapeTargets || {};

    this.inflightByKey = new Map();
    this.circuitByPage = new Map();
    this.semaphore = new Semaphore(ERP_UPSTREAM_MAX_CONCURRENCY);

    this.lockEnabled = FEATURE_ERP_DISTRIBUTED_LOCK && Boolean(redisClient);
  }
}

Object.assign(
  ErpAggregationService.prototype,
  serviceBasicsMethods,
  circuitAndCacheMethods,
  fetcherMethods,
  pageAccessMethods
);

module.exports = {
  ErpAggregationService,
};
