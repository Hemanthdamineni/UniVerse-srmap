/**
 * vapid.js — VAPID keypair resolution for Web Push (Batch B8 / T6.2.1).
 *
 * Precedence:
 *   1. VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY from the environment.
 *   2. A pair persisted at data/vapid.json (auto-generated on first boot in a
 *      non-production environment so Web Push works with zero setup).
 *   3. null — Web Push is simply unavailable; everything else still runs.
 *
 * In production the keys MUST come from the environment; we never auto-write a
 * keypair there (rotating it silently would drop every existing subscription).
 */

const fs = require("fs");
const path = require("path");
const { log } = require("../utils/logger");

const STORE_PATH = process.env.VAPID_KEY_FILE || path.join(__dirname, "../../data/vapid.json");
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:notifications@university-erp.local";

function fromEnv() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey && privateKey) return { publicKey, privateKey, subject: SUBJECT, source: "env" };
  return null;
}

function fromFile() {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed?.publicKey && parsed?.privateKey) {
      return { publicKey: parsed.publicKey, privateKey: parsed.privateKey, subject: SUBJECT, source: "file" };
    }
  } catch {
    /* not present / unreadable */
  }
  return null;
}

function generateAndPersist() {
  let webpush;
  try {
    webpush = require("web-push");
  } catch {
    return null;
  }
  const keys = webpush.generateVAPIDKeys();
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify({ ...keys, generatedAt: new Date().toISOString() }, null, 2));
  } catch (error) {
    log({ level: "warn", msg: "Could not persist auto-generated VAPID keys", error: error?.message });
  }
  return { publicKey: keys.publicKey, privateKey: keys.privateKey, subject: SUBJECT, source: "generated" };
}

let cached;

/** @returns {{ publicKey: string, privateKey: string, subject: string, source: string } | null} */
function resolveVapid() {
  if (cached !== undefined) return cached;

  cached = fromEnv() || fromFile();

  if (!cached && process.env.NODE_ENV !== "production") {
    cached = generateAndPersist();
    if (cached) {
      log({
        level: "info",
        msg: "Web Push: auto-generated a VAPID keypair (dev). Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY for production.",
        vapidPublicKey: cached.publicKey,
      });
    }
  }

  if (!cached) {
    log({ level: "warn", msg: "Web Push disabled: no VAPID keypair (set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)." });
    cached = null;
  }
  return cached;
}

module.exports = { resolveVapid };
