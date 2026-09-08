/**
 * studentGraphService.js — one typed, cached, queryable profile per student.
 *
 * Backlog Story 3.1 / Batch B4. This is the composition layer the audit found
 * missing: identity + curriculum + per-subject attendance + marks + skills +
 * activity + a set of *derived* signals (at-risk subjects, skill gaps, a
 * readiness score), assembled from the stores that already hold each piece.
 *
 * Design notes
 * ------------
 * - **No live ERP fetching here.** The graph composes from what is already
 *   persisted (attendance snapshots, the unified profile, career skill gaps)
 *   plus an optional `erpReader` the caller can wire to the aggregation
 *   cache. A section with no data is reported in `graph.sources` as
 *   "unavailable" / "stale" rather than silently blanked — the AC is a warm
 *   response under 200ms, not a scrape.
 * - **Cache** is an in-process TTL map keyed by user id. Swap `SimpleTtlCache`
 *   for a Redis-backed client with the same `get`/`set`/`delete` shape when
 *   one is available; nothing else changes.
 * - The `StudentGraph` shape is mirrored in the frontend contract at
 *   `Frontend/src/lib/core/studentGraph.ts` and the JSON schema below.
 *
 * @module core/studentGraphService
 */

const defaultAcademicCalendar = require("./academicCalendar");

const CONTRACT_VERSION = "student-graph-v1";

// Attendance below this is a breach; within BUFFER above it is "borderline".
const ATTENDANCE_MIN = 75;
const ATTENDANCE_BUFFER = 3;

// Readiness score component weights (sum = 100).
const READINESS_WEIGHTS = { academic: 40, skills: 25, activity: 20, profile: 15 };
const TARGET_SKILL_COUNT = 8;

function nowIso() {
  return new Date().toISOString();
}

function clamp(n, lo, hi) {
  return Math.min(Math.max(n, lo), hi);
}

function toNumber(value) {
  const n = Number.parseFloat(String(value ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function round(n, dp = 1) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Minimal TTL cache. Same surface as a Redis wrapper: get / set / delete. */
class SimpleTtlCache {
  constructor({ ttlMs = 60_000, max = 5_000 } = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value) {
    if (this.map.size >= this.max) {
      // drop oldest insertion
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  delete(key) {
    return this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

class StudentGraphService {
  /**
   * @param {object} deps
   * @param {object} deps.unifiedProfileStore  - must expose buildUnifiedProfile(user, opts)
   * @param {object} [deps.attendanceSnapshotStore] - must expose history(userKey, opts)
   * @param {object} [deps.careerStore]         - optional; getSkillGaps(user)
   * @param {object} [deps.erpReader]           - optional, SYNCHRONOUS. { getCurriculum, getResults }
   *   each `(user) => data | null`, reading from an already-resolved in-memory
   *   structure (never a live scrape or a Promise). Absent → those academic
   *   sections report `sources.curriculum = "unavailable"` and the graph still
   *   builds. Wiring this to the ERP aggregation cache is a follow-up
   *   (backlog T3.1.2 marks/curriculum sub-items).
   * @param {object} [deps.cache]               - optional; get/set/delete. Defaults to an in-proc TTL map.
   * @param {number} [deps.cacheTtlMs]
   */
  constructor({
    unifiedProfileStore,
    attendanceSnapshotStore = null,
    careerStore = null,
    studentIntentStore = null,
    erpReader = null,
    academicCalendar = defaultAcademicCalendar,
    cache = null,
    cacheTtlMs = 60_000,
  } = {}) {
    if (!unifiedProfileStore || typeof unifiedProfileStore.buildUnifiedProfile !== "function") {
      throw new Error("StudentGraphService requires a unifiedProfileStore with buildUnifiedProfile()");
    }
    this.unifiedProfileStore = unifiedProfileStore;
    this.attendanceSnapshotStore = attendanceSnapshotStore;
    this.careerStore = careerStore;
    this.studentIntentStore = studentIntentStore;
    this.erpReader = erpReader;
    this.academicCalendar = academicCalendar;
    this.cache = cache || new SimpleTtlCache({ ttlMs: cacheTtlMs });
  }

  _cacheKey(user) {
    return `student-graph:${user.userId}`;
  }

  /**
   * Returns the graph for `user`, from cache when warm.
   * @param {object} user  authenticated user context ({ userId, name, ... })
   * @param {object} [opts]
   * @param {boolean} [opts.recompute=false]  bypass + refresh the cache
   */
  getGraph(user, { recompute = false } = {}) {
    this._assertUser(user);
    const key = this._cacheKey(user);
    if (!recompute) {
      const hit = this.cache.get(key);
      if (hit) return { ...hit, warm: true };
    }
    const graph = this._build(user);
    this.cache.set(key, graph);
    return { ...graph, warm: false };
  }

  /** Drop the cached graph for a user — call after an ERP refresh. */
  invalidate(user) {
    const userId = typeof user === "string" ? user : user?.userId;
    if (!userId) return false;
    return this.cache.delete(`student-graph:${userId}`);
  }

  _assertUser(user) {
    if (!user || !user.userId) {
      const err = new Error("Authenticated user required");
      err.status = 401;
      throw err;
    }
  }

  _build(user) {
    const sources = {
      identity: "session",
      curriculum: "unavailable",
      attendance: "unavailable",
      results: "unavailable",
      skills: "unavailable",
      activity: "unavailable",
    };

    const identity = this._identity(user);
    const { intent, consent } = this._intent(user);

    let unified = null;
    try {
      unified = this.unifiedProfileStore.buildUnifiedProfile(user, { recompute: false });
      sources.skills = "store";
      sources.activity = "store";
    } catch {
      unified = null;
    }

    const skills = this._skills(unified, intent);
    const activity = this._activity(unified);
    const attendance = this._attendance(user, sources);
    const curriculum = this._curriculum(user, sources);
    const results = this._results(user, sources);

    const derived = this._derive({ attendance, results, skills, activity, unified });

    return {
      contractVersion: CONTRACT_VERSION,
      generatedAt: nowIso(),
      userId: user.userId,
      warm: false,
      identity,
      intent,
      consent,
      academic: { curriculum, attendance, results },
      skills,
      activity,
      derived,
      sources,
    };
  }

  _intent(user) {
    if (!this.studentIntentStore?.get) {
      return {
        intent: {
          status: "none",
          targetRoles: [],
          interestAreas: [],
          skills: [],
          graduationYear: null,
          placementIntent: "",
        },
        consent: { derivedSignals: false, leaderboards: false, publicProfile: false },
      };
    }
    let row;
    try {
      row = this.studentIntentStore.get(user);
    } catch {
      row = null;
    }
    if (!row) {
      return {
        intent: {
          status: "none",
          targetRoles: [],
          interestAreas: [],
          skills: [],
          graduationYear: null,
          placementIntent: "",
        },
        consent: { derivedSignals: false, leaderboards: false, publicProfile: false },
      };
    }
    return {
      intent: {
        status: row.status,
        targetRoles: row.targetRoles,
        interestAreas: row.interestAreas,
        skills: row.skills,
        graduationYear: row.graduationYear,
        placementIntent: row.placementIntent,
        onboardedAt: row.onboardedAt,
        updatedAt: row.updatedAt,
      },
      consent: row.consent,
    };
  }

  _identity(user) {
    return {
      name: user.name || "",
      registerNo: user.userId,
      program: user.program || user.department || "",
      branch: user.branch || "",
      semester: user.semester ?? user.year ?? null,
      section: user.section || "",
      email: user.email || "",
    };
  }

  _skills(unified, intent) {
    const list = Array.isArray(unified?.skills) ? unified.skills : [];
    const out = list
      .map((s) => ({
        skill: String(s.skill || s.name || "").trim(),
        source: s.source || "unknown",
        confidence: typeof s.confidence === "number" ? s.confidence : null,
      }))
      .filter((s) => s.skill);

    // Fold in skills the student declared during onboarding that the profile
    // store hasn't picked up yet.
    const known = new Set(out.map((s) => s.skill.toLowerCase()));
    for (const declared of intent?.skills || []) {
      const skill = String(declared || "").trim();
      if (skill && !known.has(skill.toLowerCase())) {
        known.add(skill.toLowerCase());
        out.push({ skill, source: "declared", confidence: 0.6 });
      }
    }
    return out;
  }

  _activity(unified) {
    const events = unified?.events || {};
    const lms = unified?.lms || {};
    const contributions = lms.contributions || {};
    return {
      events: {
        registered: Number(events.registeredCount || 0),
        organized: Number(events.organizedCount || 0),
      },
      lms: {
        resourcesCompleted: Number(lms.progress?.completed || lms.progress?.resourcesCompleted || 0),
        masteryTopics: Array.isArray(lms.mastery) ? lms.mastery.length : 0,
        contributions:
          Number(contributions.resources || 0) +
          Number(contributions.guides || 0) +
          Number(contributions.roadmaps || 0),
      },
      achievements: Array.isArray(unified?.achievements) ? unified.achievements.length : 0,
    };
  }

  _attendance(user, sources) {
    if (!this.attendanceSnapshotStore?.history) return null;
    let history = [];
    try {
      history = this.attendanceSnapshotStore.history(user.userId, { limit: 1 });
    } catch {
      return null;
    }
    const latest = history[history.length - 1];
    if (!latest || !Array.isArray(latest.subjects) || latest.subjects.length === 0) return null;

    const subjects = latest.subjects.map((row) => {
      const pct = toNumber(row.attendancePercentage);
      const conducted = toNumber(row.classesConducted);
      const present = toNumber(row.present);
      return {
        code: String(row.subjectCode || "").trim(),
        name: String(row.subjectDescription || "").trim(),
        conducted,
        present,
        pct,
        status: pct == null ? "unknown" : pct < ATTENDANCE_MIN ? "breach" : pct < ATTENDANCE_MIN + ATTENDANCE_BUFFER ? "borderline" : "safe",
      };
    });

    const rated = subjects.filter((s) => s.pct != null);
    const overallPct = rated.length ? round(rated.reduce((a, s) => a + s.pct, 0) / rated.length) : null;

    sources.attendance = "snapshot";
    return { asOf: latest.date, overallPct, subjects };
  }

  _curriculum(user, sources) {
    if (!this.erpReader?.getCurriculum) return null;
    let data = null;
    try {
      data = this.erpReader.getCurriculum(user);
    } catch {
      data = null;
    }
    if (!data) return null;
    sources.curriculum = data.stale ? "stale" : "cache";
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];
    const totalCredits = subjects.reduce((a, s) => a + (toNumber(s.credit) || 0), 0);
    return {
      totalCredits: round(totalCredits, 0),
      completedCredits: toNumber(data.completedCredits),
      subjects: subjects.map((s) => ({
        code: String(s.code || s.subjectCode || "").trim(),
        name: String(s.name || s.description || "").trim(),
        credit: toNumber(s.credit),
        semester: toNumber(s.semester),
      })),
    };
  }

  _results(user, sources) {
    if (!this.erpReader?.getResults) return null;
    let data = null;
    try {
      data = this.erpReader.getResults(user);
    } catch {
      data = null;
    }
    if (!data) return null;
    sources.results = data.stale ? "stale" : "cache";
    return {
      cgpa: toNumber(data.cgpa),
      sgpaBySemester: Array.isArray(data.sgpaBySemester)
        ? data.sgpaBySemester
            .map((r) => ({ semester: toNumber(r.semester), sgpa: toNumber(r.sgpa) }))
            .filter((r) => r.semester != null)
        : [],
      currentSubjects: Array.isArray(data.currentSubjects)
        ? data.currentSubjects.map((s) => ({
            code: String(s.code || s.subjectCode || "").trim(),
            grade: String(s.grade || "").trim(),
            result: String(s.result || "").trim(),
          }))
        : [],
    };
  }

  _derive({ attendance, results, skills, activity, unified }) {
    const atRiskSubjects = [];
    const borderlineSubjects = [];
    for (const s of attendance?.subjects || []) {
      if (s.status === "breach") {
        atRiskSubjects.push({
          code: s.code,
          name: s.name,
          pct: s.pct,
          classesToRecover: this._classesToRecover(s.present, s.conducted),
        });
      } else if (s.status === "borderline") {
        borderlineSubjects.push({ code: s.code, name: s.name, pct: s.pct });
      }
    }

    const skillGaps = this._skillGaps(unified);

    const readinessBreakdown = this._readiness({ attendance, results, skills, activity, unified });
    const readinessScore = Math.round(
      (readinessBreakdown.academic * READINESS_WEIGHTS.academic +
        readinessBreakdown.skills * READINESS_WEIGHTS.skills +
        readinessBreakdown.activity * READINESS_WEIGHTS.activity +
        readinessBreakdown.profile * READINESS_WEIGHTS.profile) /
        100,
    );

    let termProgress = null;
    try {
      termProgress = this.academicCalendar?.termProgress?.() ?? null;
    } catch {
      termProgress = null;
    }

    return {
      atRiskSubjects,
      borderlineSubjects,
      skillGaps,
      readinessScore,
      readinessBreakdown,
      termProgress,
    };
  }

  /** Classes that must be attended consecutively to climb back to ATTENDANCE_MIN. */
  _classesToRecover(present, conducted) {
    if (present == null || conducted == null || conducted <= 0) return null;
    const target = ATTENDANCE_MIN / 100;
    if (present / conducted >= target) return 0;
    // (present + x) / (conducted + x) >= target  ->  x >= (target*conducted - present) / (1 - target)
    const x = (target * conducted - present) / (1 - target);
    return Math.max(0, Math.ceil(x));
  }

  _skillGaps(unified) {
    // Prefer the unified profile's already-computed gaps; fall back to careerStore.
    let raw = unified?.career?.skillGaps;
    if ((!Array.isArray(raw) || raw.length === 0) && this.careerStore?.getSkillGaps) {
      try {
        raw = this.careerStore.getSkillGaps({ userId: unified?.user?.userId });
      } catch {
        raw = [];
      }
    }
    return (Array.isArray(raw) ? raw : [])
      .map((g) => (typeof g === "string" ? { skill: g, demand: null } : { skill: g.skill || g.name || "", demand: toNumber(g.demand ?? g.count ?? g.weight) }))
      .filter((g) => g.skill);
  }

  /** Each component is a 0..1 score. */
  _readiness({ attendance, results, skills, activity, unified }) {
    // Academic: blend attendance health and CGPA when present.
    const parts = [];
    if (attendance?.overallPct != null) parts.push(clamp(attendance.overallPct / 100, 0, 1));
    const cgpa = results?.cgpa;
    if (cgpa != null) parts.push(clamp(cgpa / 10, 0, 1));
    const academic = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;

    const skillsScore = clamp(skills.length / TARGET_SKILL_COUNT, 0, 1);

    const activityRaw =
      Math.min(activity.events.registered, 5) / 5 * 0.4 +
      Math.min(activity.lms.resourcesCompleted, 10) / 10 * 0.4 +
      Math.min(activity.achievements, 5) / 5 * 0.2;
    const activityScore = clamp(activityRaw, 0, 1);

    const completeness = toNumber(unified?.career?.completeness);
    const profile = completeness != null ? clamp(completeness / 100, 0, 1) : 0;

    return {
      academic: round(academic, 3),
      skills: round(skillsScore, 3),
      activity: round(activityScore, 3),
      profile: round(profile, 3),
    };
  }
}

module.exports = { StudentGraphService, SimpleTtlCache, CONTRACT_VERSION, ATTENDANCE_MIN };
