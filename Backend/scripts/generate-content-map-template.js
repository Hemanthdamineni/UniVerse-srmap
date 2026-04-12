const fs = require("fs");
const path = require("path");

const scrapeTargets = require("../src/config/scrapeTargets");

const DISCOVERY_FILE =
  process.argv[2] || path.join(__dirname, "../data/endpoint-discovery.json");
const OUT_FILE =
  process.argv[3] || path.join(__dirname, "../data/erp-content-map.template.json");

function ts() {
  return new Date().toISOString();
}

function safeKey(value) {
  return String(value || "").trim();
}

function loadDiscovery() {
  if (!fs.existsSync(DISCOVERY_FILE)) {
    return { resolvedItems: [], discoveryFile: DISCOVERY_FILE, loaded: false };
  }
  const parsed = JSON.parse(fs.readFileSync(DISCOVERY_FILE, "utf8"));
  return {
    resolvedItems: Array.isArray(parsed.resolvedItems) ? parsed.resolvedItems : [],
    discoveryFile: DISCOVERY_FILE,
    loaded: true,
  };
}

function main() {
  const discovery = loadDiscovery();

  const pageKeys = Object.keys(scrapeTargets).sort();
  const byPageKey = {};

  for (const pageKey of pageKeys) {
    const targets = scrapeTargets[pageKey] || [];
    byPageKey[safeKey(pageKey)] = {
      targets: targets.map((t) => ({
        dropdown: t.dropdown,
        subitem: t.subitem,
      })),
      mapToMyErp: {
        resource: null,
        notes: "",
      },
    };
  }

  const byMenuItem = discovery.resolvedItems
    .map((item) => ({
      dropdown: item.dropdown,
      subitem: item.subitem,
      endpoint: item.endpoint || null,
      mapToMyErp: {
        resource: null,
        notes: "",
      },
    }))
    .sort((a, b) => {
      const ak = `${a.dropdown}::${a.subitem}`;
      const bk = `${b.dropdown}::${b.subitem}`;
      return ak.localeCompare(bk);
    });

  const template = {
    generatedAt: ts(),
    discovery: {
      loaded: discovery.loaded,
      discoveryFile: discovery.discoveryFile,
      resolvedItemCount: discovery.resolvedItems.length,
    },
    pages: byPageKey,
    menuItems: byMenuItem,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(template, null, 2));
  console.log(`Wrote ${OUT_FILE}`);
}

main();

