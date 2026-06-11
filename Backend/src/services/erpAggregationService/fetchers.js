const { ERP_UPSTREAM_ACQUIRE_TIMEOUT_MS } = require("../../config/env");
const { withTimeout } = require("../../utils/asyncUtils");
const {
  erpCacheResultTotal,
  erpFetchSourceTotal,
  erpUpstreamFailuresTotal,
  observeErpSourceLatency,
  updateCacheHitRatio,
} = require("../metricsService");
const { collectNormalizationMeta } = require("../erpPayloadNormalizer");
const { sleep } = require("./helpers");
const { validateLivePayload } = require("./payloadValidation");
const { makeResponse, makeMeta } = require("./responseBuilders");

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
        const normalizationMeta = collectNormalizationMeta(data, this.getTargetsForPage(pageKey));

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
            normalizationMeta,
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
      const normalizationMeta = collectNormalizationMeta(entry.data, this.getTargetsForPage(pageKey));
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
          normalizationMeta,
          responseSource: "cache-fresh",
          policyMode,
        }),
        fetchedAt: entry.fetchedAt,
        staleAt: new Date(entry.staleAt).toISOString(),
        warnings: [],
      });
    }

    if (this.isStale(entry)) {
      const normalizationMeta = collectNormalizationMeta(entry.data, this.getTargetsForPage(pageKey));
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
          normalizationMeta,
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

module.exports = { fetcherMethods };
