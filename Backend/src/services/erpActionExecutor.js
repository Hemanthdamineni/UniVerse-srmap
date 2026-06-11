const { normalizeExpectedUrl } = require("./erpActionExecutor/utils");
const { payloadBuilderMethods } = require("./erpActionExecutor/payloadBuilders");
const { actionResolutionMethods } = require("./erpActionExecutor/actionResolution");
const { transportResultMethods } = require("./erpActionExecutor/transportResults");
const { executionMethods } = require("./erpActionExecutor/execution");

class ErpActionExecutor {
  constructor({ uiMapStore, sessionStore, apiContextFactory, discoveryRepository = null }) {
    this.uiMapStore = uiMapStore;
    this.sessionStore = sessionStore;
    this.apiContextFactory = apiContextFactory;
    this.discoveryRepository = discoveryRepository;
  }
}

Object.assign(
  ErpActionExecutor.prototype,
  payloadBuilderMethods,
  actionResolutionMethods,
  transportResultMethods,
  executionMethods
);

module.exports = {
  ErpActionExecutor,
  normalizeExpectedUrl,
};
