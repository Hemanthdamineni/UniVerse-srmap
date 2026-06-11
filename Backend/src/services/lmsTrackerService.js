const coreMethods = require("./lmsTrackerService/coreMethods");
const sourceMethods = require("./lmsTrackerService/sourceMethods");
const apiMethods = require("./lmsTrackerService/apiMethods");
const { UNIFIED_INSIGHTS_CONTRACT_VERSION } = require("./lmsTrackerService/utils");
const { evaluateUnifiedInsightPayload } = require("./lmsTrackerService/unifiedInsights");

class LmsTrackerService {
  constructor({ erpAggregationService, careerStore = null, trackerStore = null, lmsStore = null, recommendationEngine = null }) {
    this.erpAggregationService = erpAggregationService;
    this.careerStore = careerStore;
    this.trackerStore = trackerStore;
    this.lmsStore = lmsStore;
    this.recommendationEngine = recommendationEngine;
  }

}

Object.assign(
  LmsTrackerService.prototype,
  coreMethods,
  sourceMethods,
  apiMethods
);

module.exports = {
  LmsTrackerService,
  evaluateUnifiedInsightPayload,
  UNIFIED_INSIGHTS_CONTRACT_VERSION,
};
