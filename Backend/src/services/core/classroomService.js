/**
 * classroomService.js — read-only pull of the student's Google Classroom
 * coursework (Batch B12 / Story 6.6).
 *
 * Gated twice: a configured OAuth client (B10) AND `GOOGLE_CLASSROOM_ENABLED=1`
 * (which itself is only safe once T6.6.0 confirms SRM AP runs Google Workspace
 * for Education). One Google connection covers both Calendar and Classroom —
 * the consent screen requests the union of scopes.
 *
 * @module core/classroomService
 */

const oauth = require("../../config/googleOAuth");
const { validAccessToken } = require("./googleTokenAccess");

const API = "https://classroom.googleapis.com/v1";
const CACHE_TTL_MS = 10 * 60 * 1000;

function dueToIso(dueDate, dueTime) {
  if (!dueDate) return null;
  const { year, month, day } = dueDate;
  const h = dueTime?.hours ?? 23;
  const m = dueTime?.minutes ?? 59;
  // Classroom due times are UTC.
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, h, m)).toISOString();
}

class ClassroomService {
  constructor({ tokenStore, fetchImpl = fetch, log = () => {} } = {}) {
    if (!tokenStore) throw new Error("ClassroomService requires a tokenStore");
    this.tokenStore = tokenStore;
    this.fetch = fetchImpl;
    this.log = log;
    this._cache = new Map(); // userId -> { at, data }
  }

  available() {
    return oauth.isClassroomConfigured();
  }

  /** Connected AND the stored grant actually includes a Classroom scope. */
  isUsable(userId) {
    if (!this.available()) return false;
    const conn = this.tokenStore.get(userId);
    if (!conn?.scope) return false;
    return oauth.CLASSROOM_SCOPES.some((s) => conn.scope.includes(s));
  }

  status(userId) {
    return {
      available: this.available(),
      connected: this.available() && this.isUsable(userId),
      needsReconnect: this.available() && this.tokenStore.isConnected(userId) && !this.isUsable(userId),
    };
  }

  async _get(pathPart, accessToken) {
    const res = await this.fetch(`${API}${pathPart}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`Classroom API ${pathPart} → ${res.status}: ${json.error?.message || ""}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  /**
   * @returns {Promise<Array<{ id, course, title, dueAt, link, state, submitted, source: "classroom" }>>}
   */
  async listCoursework(userId, { force = false } = {}) {
    if (!this.isUsable(userId)) return [];
    const cached = this._cache.get(userId);
    if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

    const accessToken = await validAccessToken(this.tokenStore, userId, this.fetch);
    const coursesRes = await this._get("/courses?courseStates=ACTIVE&studentId=me&pageSize=50", accessToken);
    const courses = Array.isArray(coursesRes.courses) ? coursesRes.courses : [];

    const items = [];
    for (const course of courses) {
      let work;
      try {
        // eslint-disable-next-line no-await-in-loop
        work = await this._get(
          `/courses/${course.id}/courseWork?pageSize=50&orderBy=dueDate asc`,
          accessToken,
        );
      } catch (error) {
        this.log({ level: "warn", msg: "Classroom courseWork fetch failed", courseId: course.id, error: error?.message });
        continue;
      }
      let submissions = new Map();
      try {
        // eslint-disable-next-line no-await-in-loop
        const subs = await this._get(
          `/courses/${course.id}/courseWork/-/studentSubmissions?userId=me&pageSize=200`,
          accessToken,
        );
        for (const s of subs.studentSubmissions || []) submissions.set(s.courseWorkId, s.state);
      } catch {
        submissions = new Map();
      }

      for (const cw of work.courseWork || []) {
        const dueAt = dueToIso(cw.dueDate, cw.dueTime);
        const subState = submissions.get(cw.id);
        items.push({
          id: `cw:${course.id}:${cw.id}`,
          course: course.name || "Classroom",
          title: cw.title || "Coursework",
          dueAt,
          link: cw.alternateLink || course.alternateLink || null,
          state: cw.state || "PUBLISHED",
          submitted: subState === "TURNED_IN" || subState === "RETURNED",
          source: "classroom",
        });
      }
    }

    this._cache.set(userId, { at: Date.now(), data: items });
    return items;
  }

  invalidate(userId) {
    this._cache.delete(userId);
  }
}

module.exports = { ClassroomService, dueToIso };
