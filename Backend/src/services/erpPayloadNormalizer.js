const { normalizeRuntimePayload } = require("./erpPayloadNormalizer/runtime");
const {
  normalizeArtifactItem,
  collectNormalizationMeta,
} = require("./erpPayloadNormalizer/artifacts");
const { stableHeaderFingerprint } = require("./erpPayloadNormalizer/tableUtils");

module.exports = {
  normalizeRuntimePayload,
  normalizeArtifactItem,
  collectNormalizationMeta,
  stableHeaderFingerprint,
};
