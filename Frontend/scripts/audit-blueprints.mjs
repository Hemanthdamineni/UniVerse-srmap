import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const moduleCache = new Map();

function resolveLocalModule(specifier, parentFile) {
  if (!specifier.startsWith(".")) {
    throw new Error(`Unsupported non-local import "${specifier}" in ${path.relative(repoRoot, parentFile)}`);
  }

  const basePath = path.resolve(path.dirname(parentFile), specifier);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ];

  const resolved = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!resolved) {
    throw new Error(`Unable to resolve "${specifier}" from ${path.relative(repoRoot, parentFile)}`);
  }

  return resolved;
}

function loadTypeScriptModule(filePath) {
  const resolvedPath = path.resolve(filePath);
  const cached = moduleCache.get(resolvedPath);
  if (cached) return cached.exports;

  const source = fs.readFileSync(resolvedPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: resolvedPath,
  }).outputText;

  const module = { exports: {} };
  moduleCache.set(resolvedPath, module);

  const localRequire = (specifier) => loadTypeScriptModule(resolveLocalModule(specifier, resolvedPath));
  const context = {
    console,
    exports: module.exports,
    module,
    require: localRequire,
    __dirname: path.dirname(resolvedPath),
    __filename: resolvedPath,
  };

  vm.runInNewContext(transpiled, context, {
    filename: resolvedPath,
    timeout: 10000,
  });

  return module.exports;
}

const { PAGE_BLUEPRINTS, MAIN_NAV, BOTTOM_NAV } = loadTypeScriptModule(
  path.join(repoRoot, "src", "config", "erpBlueprints.ts")
);

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
