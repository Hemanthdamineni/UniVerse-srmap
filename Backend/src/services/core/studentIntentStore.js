/**
 * studentIntentStore.js — what the student told us they want, plus their
 * consent choices about inference.
 *
 * Backlog Stories 3.2 / 3.3 (Batch B5). Feeds the student graph: intent
 * sharpens recommendations, consent gates whether the graph exposes derived
 * signals and whether the student appears on leaderboards / a public profile.
 *
 * Shares the unified-profile SQLite file (same "who is this student" concern);
 * pass its own `dbPath` to isolate in tests.
 *
 * @module core/studentIntentStore
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const MAX_LIST = 12;
const MAX_ITEM_LEN = 80;

// Consent flags — all default OFF (refusable, per T3.3.1). A student can use
// the whole app with every one of these false.
const CONSENT_KEYS = ["derivedSignals", "leaderboards", "publicProfile"];

function nowIso() {
  return new Date().toISOString();
}

function cleanStr(v, max = MAX_ITEM_LEN) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanList(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  const out = [];
  for (const item of v) {
    const s = cleanStr(item);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

function cleanConsent(v) {
  const out = {};
  for (const key of CONSENT_KEYS) out[key] = Boolean(v && v[key]);
  return out;
}

function parseJson(text, fallback) {
  try {
    const parsed = JSON.parse(text);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function emptyIntent(userId) {
  return {
    userId,
    targetRoles: [],
    interestAreas: [],
    skills: [],
    graduationYear: null,
    placementIntent: "", // "placement" | "higher-studies" | "entrepreneurship" | "undecided" | ""
    consent: cleanConsent(null),
    status: "none", // none | skipped | complete
    onboardedAt: null,
    updatedAt: null,
  };
}

class StudentIntentStore {
  constructor({ dbPath }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS student_intent (
        user_id TEXT PRIMARY KEY,
        target_roles_json TEXT NOT NULL DEFAULT '[]',
        interest_areas_json TEXT NOT NULL DEFAULT '[]',
        skills_json TEXT NOT NULL DEFAULT '[]',
        graduation_year INTEGER,
        placement_intent TEXT NOT NULL DEFAULT '',
        consent_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'none',
        onboarded_at TEXT,
        updated_at TEXT NOT NULL
      )
    `);
  }

  _assertUser(user) {
    const userId = typeof user === "string" ? user : user?.userId;
    if (!userId) {
      const err = new Error("Authenticated user required");
      err.status = 401;
      throw err;
    }
    return userId;
  }

  /** Always returns a fully-shaped object, even for a student with no row. */
  get(user) {
    const userId = this._assertUser(user);
    const row = this.db
      .prepare("SELECT * FROM student_intent WHERE user_id = ?")
      .get(userId);
    if (!row) return emptyIntent(userId);
    return {
      userId,
      targetRoles: parseJson(row.target_roles_json, []),
      interestAreas: parseJson(row.interest_areas_json, []),
      skills: parseJson(row.skills_json, []),
      graduationYear: row.graduation_year ?? null,
      placementIntent: row.placement_intent || "",
      consent: cleanConsent(parseJson(row.consent_json, {})),
      status: row.status || "none",
      onboardedAt: row.onboarded_at || null,
      updatedAt: row.updated_at || null,
    };
  }

  /**
   * Merge-write. Only the fields present in `patch` change; omit a field to
   * leave it. `status` moves to "complete" on a normal save and "skipped" when
   * `patch.skipped === true` (T3.2.3 — a skip must still leave a usable row).
   */
  update(user, patch = {}) {
    const userId = this._assertUser(user);
    const current = this.get(user);

    const next = {
      targetRoles: patch.targetRoles !== undefined ? cleanList(patch.targetRoles) : current.targetRoles,
      interestAreas: patch.interestAreas !== undefined ? cleanList(patch.interestAreas) : current.interestAreas,
      skills: patch.skills !== undefined ? cleanList(patch.skills) : current.skills,
      graduationYear:
        patch.graduationYear !== undefined
          ? normalizeGradYear(patch.graduationYear)
          : current.graduationYear,
      placementIntent:
        patch.placementIntent !== undefined
          ? normalizePlacementIntent(patch.placementIntent)
          : current.placementIntent,
      consent:
        patch.consent !== undefined
          ? cleanConsent({ ...current.consent, ...patch.consent })
          : current.consent,
    };

    let status = current.status;
    if (patch.skipped === true) {
      status = current.status === "complete" ? "complete" : "skipped";
    } else if (patch.status === "complete" || hasAnySignal(next)) {
      status = "complete";
    }

    const onboardedAt =
      current.onboardedAt || (status !== "none" ? nowIso() : null);
    const updatedAt = nowIso();

    this.db
      .prepare(
        `INSERT INTO student_intent (
          user_id, target_roles_json, interest_areas_json, skills_json,
          graduation_year, placement_intent, consent_json, status, onboarded_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          target_roles_json = excluded.target_roles_json,
          interest_areas_json = excluded.interest_areas_json,
          skills_json = excluded.skills_json,
          graduation_year = excluded.graduation_year,
          placement_intent = excluded.placement_intent,
          consent_json = excluded.consent_json,
          status = excluded.status,
          onboarded_at = COALESCE(student_intent.onboarded_at, excluded.onboarded_at),
          updated_at = excluded.updated_at`
      )
      .run(
        userId,
        JSON.stringify(next.targetRoles),
        JSON.stringify(next.interestAreas),
        JSON.stringify(next.skills),
        next.graduationYear,
        next.placementIntent,
        JSON.stringify(next.consent),
        status,
        onboardedAt,
        updatedAt
      );

    return this.get(user);
  }

  /** Forget everything the student told us / we inferred as intent (T3.3.3). */
  clear(user) {
    const userId = this._assertUser(user);
    this.db.prepare("DELETE FROM student_intent WHERE user_id = ?").run(userId);
    return emptyIntent(userId);
  }

  close() {
    this.db.close();
  }
}

function normalizeGradYear(value) {
  const n = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isInteger(n)) return null;
  const thisYear = new Date().getFullYear();
  // A plausible window; anything outside is a typo.
  return n >= thisYear - 8 && n <= thisYear + 8 ? n : null;
}

const PLACEMENT_INTENTS = new Set([
  "placement",
  "higher-studies",
  "entrepreneurship",
  "undecided",
]);

function normalizePlacementIntent(value) {
  const s = cleanStr(value, 24).toLowerCase();
  return PLACEMENT_INTENTS.has(s) ? s : "";
}

function hasAnySignal(intent) {
  return (
    intent.targetRoles.length > 0 ||
    intent.interestAreas.length > 0 ||
    intent.skills.length > 0 ||
    intent.graduationYear != null ||
    intent.placementIntent !== ""
  );
}

module.exports = {
  StudentIntentStore,
  CONSENT_KEYS,
  PLACEMENT_INTENTS: [...PLACEMENT_INTENTS],
  emptyIntent,
};
