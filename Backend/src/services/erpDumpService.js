const fs = require("fs");
const path = require("path");

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

module.exports = { ErpDumpService, encodeKey };
