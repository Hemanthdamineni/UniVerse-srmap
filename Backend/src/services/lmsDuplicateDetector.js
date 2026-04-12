const crypto = require("crypto");
const { toSafeString } = require("./lmsUtils");

function normalizeTitle(value) {
  return toSafeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

class LmsDuplicateDetector {
  constructor({ lmsStore }) {
    this.lmsStore = lmsStore;
  }

  computeHash(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  async checkDuplicate({ fileHash, title, subjectCode, excludeId = "" }) {
    const normalizedTitle = normalizeTitle(title);
    return this.lmsStore.checkDuplicate({
      fileHash,
      title: normalizedTitle,
      subjectCode,
      excludeId,
    });
  }
}

module.exports = {
  LmsDuplicateDetector,
};
