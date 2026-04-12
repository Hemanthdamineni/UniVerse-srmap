import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const configPath = path.join(repoRoot, "src", "config", "erpBlueprints.ts");

const source = fs.readFileSync(configPath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: configPath,
}).outputText;

const module = { exports: {} };
const sandbox = {
  module,
  exports: module.exports,
  console,
  process,
};

vm.runInNewContext(transpiled, sandbox, { filename: configPath });

const { PAGE_BLUEPRINTS, MAIN_NAV, BOTTOM_NAV } = module.exports;

const pageCount = Object.keys(PAGE_BLUEPRINTS || {}).length;
const mainNavCount = Array.isArray(MAIN_NAV) ? MAIN_NAV.length : 0;
const bottomNavCount = Array.isArray(BOTTOM_NAV) ? BOTTOM_NAV.length : 0;

const domainCounts = Object.values(PAGE_BLUEPRINTS || {}).reduce((accumulator, blueprint) => {
  const domain = String(blueprint?.domain || "unknown");
  accumulator[domain] = (accumulator[domain] || 0) + 1;
  return accumulator;
}, {});

console.log("Blueprint metadata audit passed.");
console.log(`Pages: ${pageCount}`);
console.log(`Main nav items: ${mainNavCount}`);
console.log(`Bottom nav items: ${bottomNavCount}`);
console.log(`Domains: ${JSON.stringify(domainCounts)}`);
