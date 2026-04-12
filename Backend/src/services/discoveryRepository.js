const fs = require("fs");
const { normalizeText, normalizeSubitem } = require("../utils/text");

class DiscoveryRepository {
  constructor(fileCandidates = []) {
    this.fileCandidates = fileCandidates;
    this.filePath = null;
    this.raw = null;
    this.byKey = new Map();
    this.byDropdown = new Map();
    this.reload();
  }

  findFile() {
    return this.fileCandidates.find((filePath) => fs.existsSync(filePath)) || null;
  }

  reload() {
    this.filePath = this.findFile();
    this.raw = null;
    this.byKey = new Map();
    this.byDropdown = new Map();

    if (!this.filePath) return;

    this.raw = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    const resolvedItems = Array.isArray(this.raw.resolvedItems)
      ? this.raw.resolvedItems
      : [];

    for (const item of resolvedItems) {
      const dropdownKey = normalizeText(item.dropdown);
      const subitemKey = normalizeSubitem(item.subitem);
      const mapKey = `${dropdownKey}::${subitemKey}`;

      this.byKey.set(mapKey, item);
      if (!this.byDropdown.has(dropdownKey)) {
        this.byDropdown.set(dropdownKey, []);
      }
      this.byDropdown.get(dropdownKey).push(item);
    }
  }

  resolveEndpoint(dropdown, subitem) {
    const dropdownKey = normalizeText(dropdown);
    const subitemKey = normalizeSubitem(subitem);

    const direct = this.byKey.get(`${dropdownKey}::${subitemKey}`);
    if (direct) return direct.endpoint;

    const candidates = this.byDropdown.get(dropdownKey) || [];
    if (!candidates.length) return null;

    if (!subitemKey) {
      const announcementsLike = candidates.find((item) =>
        normalizeSubitem(item.subitem).includes("announcement")
      );
      return (announcementsLike || candidates[0]).endpoint;
    }

    const exact = candidates.find(
      (item) => normalizeSubitem(item.subitem) === subitemKey
    );
    if (exact) return exact.endpoint;

    const fuzzy = candidates.find((item) => {
      const candidateSubitem = normalizeSubitem(item.subitem);
      return candidateSubitem.includes(subitemKey) || subitemKey.includes(candidateSubitem);
    });

    return fuzzy ? fuzzy.endpoint : null;
  }

  resolveHelperFunction(name) {
    const helperFunctions = this.raw?.functionMappings?.helperFunctions;
    if (!helperFunctions || typeof helperFunctions !== "object") return null;
    const key = String(name || "").trim();
    if (!key) return null;
    return helperFunctions[key] || null;
  }

  getHealth() {
    return {
      loaded: Boolean(this.raw),
      filePath: this.filePath,
      generatedAt: this.raw?.generatedAt || null,
      totalResolvedItems: Array.isArray(this.raw?.resolvedItems)
        ? this.raw.resolvedItems.length
        : 0,
    };
  }
}

module.exports = {
  DiscoveryRepository,
};
