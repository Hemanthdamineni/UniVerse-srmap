const fs = require("fs");
const {
  cleanText,
  normalizePageKey,
  normalizeSectionToken,
  normalizeSectionKey,
  cloneJson,
  normalizeMutationUrl,
} = require("./erpUiMapStore/utils");
const {
  isAllowedMutationUrl,
  mutationBlockReason,
} = require("./erpUiMapStore/actions");
const { sectionBuilderMethods } = require("./erpUiMapStore/sectionBuilder");
const {
  ERP_UI_SCHEMA_VERSION,
  schemaQueryMethods,
} = require("./erpUiMapStore/schemaQueries");

class ErpUiMapStore {
  constructor({ uiMapFile, scrapeTargets }) {
    this.uiMapFile = uiMapFile;
    this.scrapeTargets = scrapeTargets || {};

    this.raw = null;
    this.loaded = false;
    this.bySectionKey = new Map();
    this.pageKeyToSections = new Map();

    this.reload();
  }

  reload() {
    this.bySectionKey.clear();
    this.pageKeyToSections.clear();
    this.raw = null;
    this.loaded = false;

    if (!this.uiMapFile || !fs.existsSync(this.uiMapFile)) {
      return;
    }

    this.raw = JSON.parse(fs.readFileSync(this.uiMapFile, "utf8"));
    const pages = Array.isArray(this.raw?.pages) ? this.raw.pages : [];

    for (const page of pages) {
      const dropdown = cleanText(page?.dropdown);
      const subitem = cleanText(page?.subitem);
      if (!dropdown || !subitem) continue;

      const sectionKey = normalizeSectionKey(dropdown, subitem);
      this.bySectionKey.set(sectionKey, this.buildSectionHint(page));
    }

    for (const [pageKeyRaw, targets] of Object.entries(this.scrapeTargets)) {
      const pageKey = normalizePageKey(pageKeyRaw);
      const sectionHints = [];

      for (const target of Array.isArray(targets) ? targets : []) {
        const sectionKey = normalizeSectionKey(target?.dropdown, target?.subitem);
        const hint = this.bySectionKey.get(sectionKey);
        if (!hint) continue;
        sectionHints.push(cloneJson(hint));
      }

      const deduped = [];
      const seen = new Set();
      for (const section of sectionHints) {
        const fingerprint = `${normalizeSectionToken(section.dropdown)}::${normalizeSectionToken(section.subitem)}`;
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        deduped.push(section);
      }

      this.pageKeyToSections.set(pageKey, deduped);
    }

    this.loaded = true;
  }
}

Object.assign(
  ErpUiMapStore.prototype,
  sectionBuilderMethods,
  schemaQueryMethods
);

module.exports = {
  ErpUiMapStore,
  ERP_UI_SCHEMA_VERSION,
  normalizePageKey,
  normalizeSectionKey,
  normalizeMutationUrl,
  isAllowedMutationUrl,
  mutationBlockReason,
};
