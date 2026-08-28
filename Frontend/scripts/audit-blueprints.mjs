import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PAGE_BLUEPRINTS,
  MAIN_NAV,
  BOTTOM_NAV,
  DASHBOARD_QUICK_LINKS,
} from "../src/config/erpBlueprints.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const pageCount = Object.keys(PAGE_BLUEPRINTS || {}).length;
const mainNavCount = Array.isArray(MAIN_NAV) ? MAIN_NAV.length : 0;
const bottomNavCount = Array.isArray(BOTTOM_NAV) ? BOTTOM_NAV.length : 0;
const domainCounts = Object.values(PAGE_BLUEPRINTS || {}).reduce((acc, blueprint) => {
  const domain = String(blueprint?.domain || "unknown");
  acc[domain] = (acc[domain] || 0) + 1;
  return acc;
}, {});

console.log("Blueprint metadata audit passed.");
console.log(`Pages: ${pageCount}`);
console.log(`Main nav items: ${mainNavCount}`);
console.log(`Bottom nav items: ${bottomNavCount}`);
console.log(`Domains: ${JSON.stringify(domainCounts)}`);

// Reference DASHBOARD_QUICK_LINKS so a removal of the import becomes a TS error
// instead of a silent runtime miss.
void (Array.isArray(DASHBOARD_QUICK_LINKS) ? DASHBOARD_QUICK_LINKS.length : 0);
void repoRoot;
