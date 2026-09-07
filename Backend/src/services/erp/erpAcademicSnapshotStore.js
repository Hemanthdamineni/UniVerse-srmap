/**
 * erpAcademicSnapshotStore.js — the last-known curriculum, results, and CGPA
 * per student, captured from successful live ERP fetches.
 *
 * The student graph needs these synchronously and fast (T3.1 AC: warm < 200ms),
 * but the ERP aggregation cache is async and session-scoped. This store is the
 * documented in-proc fallback: the live-data sink pushes extracted payloads in,
 * the graph reads a plain row out via `readerFor()`. Mirrors
 * `attendanceSnapshotStore` in shape and lifecycle.
 *
 * @module erp/erpAcademicSnapshotStore
 */

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

function nowIso() {
  return new Date().toISOString();
}

function toNum(v) {
  const n = Number.parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function readExtracted(payload) {
  if (!payload || typeof payload !== "object") return null;
  return payload._extracted && typeof payload._extracted === "object" ? payload._extracted : null;
}

class ErpAcademicSnapshotStore {
  constructor({ dbPath, staleAfterMs = 7 * 24 * 60 * 60 * 1000 }) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS erp_academic_snapshots (
        user_key TEXT NOT NULL,
        kind TEXT NOT NULL,            -- 'curriculum' | 'results' | 'cgpa' | 'exam-history'
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_key, kind)
      )
    `);
    this.staleAfterMs = staleAfterMs;
  }

  _put(userKey, kind, data) {
    if (!userKey || userKey === "anonymous" || !data) return "ignored";
    this.db
      .prepare(
        `INSERT INTO erp_academic_snapshots (user_key, kind, data_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_key, kind) DO UPDATE SET
           data_json = excluded.data_json,
           updated_at = excluded.updated_at`,
      )
      .run(String(userKey), kind, JSON.stringify(data), nowIso());
    return "stored";
  }

  _get(userKey, kind) {
    if (!userKey) return null;
    const row = this.db
      .prepare("SELECT data_json, updated_at FROM erp_academic_snapshots WHERE user_key = ? AND kind = ?")
      .get(String(userKey), kind);
    if (!row) return null;
    let data;
    try {
      data = JSON.parse(row.data_json);
    } catch {
      return null;
    }
    const stale = Date.now() - new Date(row.updated_at).getTime() > this.staleAfterMs;
    return { data, updatedAt: row.updated_at, stale };
  }

  /** The last-known timetable schedule ({ schedule, timeSlots }), or null. */
  getTimetable(userKey) {
    const row = this._get(userKey, "timetable");
    return row?.data?.schedule?.length ? row.data : null;
  }

  /** True if a results row with at least one real (non-pending) grade is stored. */
  hasGradedResults(userKey) {
    const row = this._get(userKey, "results");
    return Boolean(
      row?.data?.currentSubjects?.some((s) => s.grade && !/pending|not published/i.test(String(s.grade))),
    );
  }

  /**
   * Feed one live ERP page. No-op for page keys it doesn't care about.
   * Returns the kind it recorded, or null.
   */
  ingest({ userKey, pageKey, payload }) {
    if (!userKey || !payload) return null;
    const key = String(pageKey || "");
    const extracted = readExtracted(payload);

    if (key === "academic/time-table" || key === "academic/timetable") {
      const schedule = extracted?.schedule || payload.schedule;
      if (!Array.isArray(schedule) || schedule.length === 0) return null;
      this._put(userKey, "timetable", {
        schedule: schedule.map((r) => ({
          day: String(r.day || "").trim(),
          periods: Array.isArray(r.periods) ? r.periods.map((p) => String(p || "")) : [],
        })),
        timeSlots: Array.isArray(extracted?.timeSlots) ? extracted.timeSlots.map(String) : [],
      });
      return "timetable";
    }

    if (key === "academic/student-wise-subjects") {
      const records = (extracted?.records || payload.records || []).map((r) => ({
        code: String(r.code || r.subjectCode || "").trim(),
        name: String(r.name || r.subjectName || r.description || "").trim(),
        credit: toNum(r.credit),
        semester: toNum(r.semester),
      })).filter((r) => r.code);
      if (records.length === 0) return null;
      this._put(userKey, "curriculum", { subjects: records });
      return "curriculum";
    }

    if (key === "examination/current-semester-results") {
      const records = (extracted?.records || payload.records || []).map((r) => ({
        code: String(r.subjectCode || r.code || "").trim(),
        grade: String(r.grade || "").trim(),
        result: String(r.result || "").trim(),
        credit: toNum(r.extras?.credit ?? r.credit),
      })).filter((r) => r.code);
      if (records.length === 0) return null;
      this._put(userKey, "results", { currentSubjects: records });
      return "results";
    }

    if (key === "academic/cgpa-summary") {
      // Backend adapts CGPA to TableContent / meta; be liberal about shape.
      const tc = payload.TableContent || payload.data?.Academic?.["CGPA Summary"]?.TableContent || {};
      const meta = extracted?.meta || payload.meta || {};
      const cgpa = toNum(tc["Current CGPA"] ?? meta.cgpa ?? extracted?.cgpa);
      if (cgpa == null) return null;
      this._put(userKey, "cgpa", { cgpa });
      return "cgpa";
    }

    if (key === "examination/exam-mark-details") {
      const records = extracted?.records || payload.records || [];
      // SGPA per semester from grade points × credit.
      const bySem = new Map();
      for (const r of records) {
        const sem = toNum(r.semesterNo ?? r.semester);
        const gp = toNum(r.gradePoints ?? r.gradePoint);
        const cr = toNum(r.credit);
        if (sem == null || gp == null || cr == null) continue;
        const acc = bySem.get(sem) || { points: 0, credits: 0 };
        acc.points += gp * cr;
        acc.credits += cr;
        bySem.set(sem, acc);
      }
      const sgpaBySemester = [...bySem.entries()]
        .map(([semester, { points, credits }]) => ({
          semester,
          sgpa: credits > 0 ? Math.round((points / credits) * 100) / 100 : null,
        }))
        .filter((s) => s.sgpa != null)
        .sort((a, b) => a.semester - b.semester);
      if (sgpaBySemester.length === 0) return null;
      this._put(userKey, "exam-history", { sgpaBySemester });
      return "exam-history";
    }

    return null;
  }

  /**
   * A synchronous `erpReader` for `StudentGraphService`: `{ getCurriculum,
   * getResults }`, each `(user) => data | null` reading only from this store.
   */
  readerFor() {
    const store = this;
    return {
      getCurriculum(user) {
        const userKey = typeof user === "string" ? user : user?.userId;
        const row = store._get(userKey, "curriculum");
        if (!row) return null;
        return { ...row.data, stale: row.stale };
      },
      getResults(user) {
        const userKey = typeof user === "string" ? user : user?.userId;
        const cur = store._get(userKey, "results");
        const cgpa = store._get(userKey, "cgpa");
        const hist = store._get(userKey, "exam-history");
        if (!cur && !cgpa && !hist) return null;
        return {
          cgpa: cgpa?.data.cgpa ?? null,
          currentSubjects: cur?.data.currentSubjects ?? [],
          sgpaBySemester: hist?.data.sgpaBySemester ?? [],
          stale: Boolean((cur?.stale ?? true) && (cgpa?.stale ?? true) && (hist?.stale ?? true)),
        };
      },
    };
  }

  close() {
    this.db.close();
  }
}

module.exports = { ErpAcademicSnapshotStore };
