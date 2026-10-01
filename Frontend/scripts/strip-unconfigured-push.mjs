#!/usr/bin/env node
/**
 * strip-unconfigured-push.mjs — remove @capacitor/push-notifications from the
 * Capacitor native plugin manifest when Firebase isn't configured.
 *
 * Background: `@capacitor/push-notifications` is registered (via
 * capacitor.plugins.json) in the Android shell so the app can use FCM push
 * once a Firebase project is wired in. But the plugin's native
 * `register()`/`FirebaseMessaging.getInstance()` calls throw
 * `IllegalStateException: Default FirebaseApp is not initialized` when
 * `google-services.json` is missing, and Capacitor's bridge rethrows that on
 * the handler thread — crashing the whole JVM process at startup before the
 * failure ever reaches JS (see nativePush.ts's PUSH_CONFIGURED note).
 *
 * When `android/app/google-services.json` is absent, Capacitor must not load
 * the plugin at all, otherwise the app is unusable. This script filters
 * `@capacitor/push-notifications` out of the generated plugin manifest so
 * Capacitor doesn't try to load the native module. It is a no-op (and succeeds)
 * when the plugin isn't registered or when the manifest can't be found, so it
 * is safe to run unconditionally in CI.
 *
 * Usage:
 *   node scripts/strip-unconfigured-push.mjs [--check]
 *
 * The path defaults to Frontend/android/app/src/main/assets/capacitor.plugins.json
 * (relative to this script's parent), symmetrical with how `cap sync android`
 * writes it. `--check` only verifies the manifest no longer lists the plugin,
 * exiting non-zero if it does — used by the test/verification path.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG = "@capacitor/push-notifications";

const scriptDir = dirname(fileURLToPath(import.meta.url));
// Working dir matters: CI runs this from Frontend/. Resolve relative to cwd
// first, then fall back to a path anchored on this file, so the script works
// from either location.
const candidates = [
  join(process.cwd(), "android/app/src/main/assets/capacitor.plugins.json"),
  join(scriptDir, "../android/app/src/main/assets/capacitor.plugins.json"),
];
const manifestPath = candidates.find(existsSync);

const checkOnly = process.argv.includes("--check");

if (!manifestPath) {
  if (checkOnly) {
    console.error("strip[check]: no capacitor.plugins.json found to check");
    process.exit(1);
  }
  // Nothing to strip — no native shell present. Success.
  console.log("strip: capacitor.plugins.json not found; nothing to do");
  process.exit(0);
}

let plugins;
try {
  plugins = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (err) {
  // A corrupt manifest should not silently pass strip; make it a hard failure
  // so CI notices rather than shipping a broken plugin list.
  console.error(`strip: failed to parse ${manifestPath}: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(plugins)) {
  console.error(`strip: unexpected shape in ${manifestPath} — expected an array`);
  process.exit(1);
}

const kept = plugins.filter((entry) => entry?.pkg !== PKG);
const removed = plugins.length - kept.length;

if (checkOnly) {
  if (removed > 0) {
    console.error(`strip[check]: ${PKG} still present in ${manifestPath}`);
    process.exit(1);
  }
  console.log(`strip[check]: ok — ${PKG} not registered in ${manifestPath}`);
  process.exit(0);
}

writeFileSync(manifestPath, JSON.stringify(kept, null, 2) + "\n", "utf8");

if (removed === 0) {
  console.log(`strip: ${PKG} not registered in ${manifestPath}; unchanged`);
} else {
  console.log(`strip: removed ${PKG} from ${manifestPath} (${removed} plugin(s) dropped)`);
}
process.exit(0);
