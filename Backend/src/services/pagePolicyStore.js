const fs = require("fs");
const path = require("path");

const MODES = new Set(["cached-first", "live-first"]);

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function normalizeMode(value, fallback = "cached-first") {
  const mode = normalizeKey(value);
  if (MODES.has(mode)) return mode;
  return fallback;
}

class PagePolicyStore {
  constructor(policyPath) {
    this.policyPath = path.resolve(policyPath);
    this.lastLoadedMtimeMs = 0;
    this.lastCheckedAt = 0;
    this.raw = {
      defaultMode: "cached-first",
      liveFirstPrefixes: [],
      cachedFirstPrefixes: [],
      overrides: {},
    };
    this.reload(true);
  }

  safeReadJson() {
    if (!fs.existsSync(this.policyPath)) return null;

    const stat = fs.statSync(this.policyPath);
    const mtimeMs = Number(stat.mtimeMs || 0);

    const body = fs.readFileSync(this.policyPath, "utf8");
    const parsed = JSON.parse(body);

    return {
      parsed,
      mtimeMs,
    };
  }

  reload(force = false) {
    const now = Date.now();
    if (!force && now - this.lastCheckedAt < 1000) return;
    this.lastCheckedAt = now;

    const result = this.safeReadJson();
    if (!result) return;

    if (!force && result.mtimeMs === this.lastLoadedMtimeMs) return;

    const parsed = result.parsed || {};

    const defaultMode = normalizeMode(parsed.defaultMode, "cached-first");

    const liveFirstPrefixes = Array.isArray(parsed.liveFirstPrefixes)
      ? parsed.liveFirstPrefixes.map(normalizeKey).filter(Boolean)
      : [];

    const cachedFirstPrefixes = Array.isArray(parsed.cachedFirstPrefixes)
      ? parsed.cachedFirstPrefixes.map(normalizeKey).filter(Boolean)
      : [];

    const overrides = {};
    if (parsed.overrides && typeof parsed.overrides === "object") {
      for (const [key, mode] of Object.entries(parsed.overrides)) {
        const normalizedKey = normalizeKey(key);
        if (!normalizedKey) continue;
        overrides[normalizedKey] = normalizeMode(mode, defaultMode);
      }
    }

    this.raw = {
      defaultMode,
      liveFirstPrefixes,
      cachedFirstPrefixes,
      overrides,
    };
    this.lastLoadedMtimeMs = result.mtimeMs;
  }

  resolveMode(pageKey, overrideMode = "") {
    this.reload(false);
    const key = normalizeKey(pageKey);

    if (overrideMode) {
      const normalizedOverride = normalizeMode(overrideMode, "");
      if (normalizedOverride) return normalizedOverride;
    }

    if (!key) return this.raw.defaultMode;

    if (this.raw.overrides[key]) return this.raw.overrides[key];

    if (this.raw.liveFirstPrefixes.some((prefix) => key.startsWith(prefix))) {
      return "live-first";
    }

    if (this.raw.cachedFirstPrefixes.some((prefix) => key.startsWith(prefix))) {
      return "cached-first";
    }

    return this.raw.defaultMode;
  }

  getHealth() {
    this.reload(false);
    return {
      policyPath: this.policyPath,
      lastLoadedMtimeMs: this.lastLoadedMtimeMs,
      defaultMode: this.raw.defaultMode,
      overrideCount: Object.keys(this.raw.overrides).length,
      liveFirstPrefixes: this.raw.liveFirstPrefixes.length,
      cachedFirstPrefixes: this.raw.cachedFirstPrefixes.length,
    };
  }
}

module.exports = {
  PagePolicyStore,
};
