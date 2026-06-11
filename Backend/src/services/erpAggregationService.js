const {
  ERP_UPSTREAM_MAX_CONCURRENCY,
  FEATURE_ERP_DISTRIBUTED_LOCK,
} = require("../config/env");
const { Semaphore } = require("../utils/asyncUtils");
const { serviceBasicsMethods } = require("./erpAggregationService/serviceBasics");
const { circuitAndCacheMethods } = require("./erpAggregationService/circuitAndCache");
const { fetcherMethods } = require("./erpAggregationService/fetchers");
const { pageAccessMethods } = require("./erpAggregationService/pageAccess");

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
