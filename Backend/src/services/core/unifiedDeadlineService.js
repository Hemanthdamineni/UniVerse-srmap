/**
 * unifiedDeadlineService.js — one chronological timeline of everything with a
 * date the student needs to act on (Batch B12 / T6.6.3):
 *
 *   - Google Classroom coursework due dates (when connected + enabled)
 *   - saved-opportunity application deadlines
 *   - events the student registered for
 *   - academic-calendar milestones (registration windows, exams, …)
 *
 * Every source is optional; the endpoint degrades to whatever is available.
 *
 * @module core/unifiedDeadlineService
 */

const { parseDdMmYyyy, listAcademicMilestones } = require("./academicCalendar");

/**
 * @param {object} deps
 * @param {object} [deps.classroomService]  listCoursework(userId) => Promise<item[]>
 * @param {object} [deps.careerStore]        getBookmarkDeadlineReminderCandidates(days)
 * @param {object} [deps.eventsStore]        registrationsByUser: Map, eventById: Map
 */
class UnifiedDeadlineService {
  constructor({ classroomService = null, careerStore = null, eventsStore = null } = {}) {
    this.classroomService = classroomService;
    this.careerStore = careerStore;
    this.eventsStore = eventsStore;
  }

  /**
   * @param {object} user  { userId }
   * @param {{ horizonDays?: number, includePast?: boolean }} [opts]
   * @returns {Promise<{ generatedAt: string, items: Array, sources: object }>}
   */
  async getTimeline(user, { horizonDays = 60, includePast = false } = {}) {
    const userId = user?.userId;
    const now = Date.now();
    const horizon = now + horizonDays * 86_400_000;
    const items = [];
    const sources = { classroom: "unavailable", opportunities: "unavailable", events: "unavailable", "academic-calendar": "ok" };

    // Classroom
    if (userId && this.classroomService?.isUsable?.(userId)) {
      try {
        const cw = await this.classroomService.listCoursework(userId);
        for (const c of cw) {
          if (!c.dueAt || c.submitted) continue;
          items.push({ ...c, meta: { course: c.course, state: c.state } });
        }
        sources.classroom = "ok";
      } catch {
        sources.classroom = "error";
      }
    }

    // Saved-opportunity deadlines
    if (userId && this.careerStore?.getBookmarkDeadlineReminderCandidates) {
      try {
        for (const r of this.careerStore.getBookmarkDeadlineReminderCandidates(horizonDays)) {
          if (r.userId !== userId || !r.deadline) continue;
          items.push({
            id: `opp:${r.opportunityId}`,
            title: `Closes: ${r.title}`,
            dueAt: new Date(r.deadline).toISOString(),
            link: `/career/opportunities/${r.opportunityId}`,
            source: "opportunity",
          });
        }
        sources.opportunities = "ok";
      } catch {
        sources.opportunities = "error";
      }
    }

    // Registered events
    if (userId && this.eventsStore?.registrationsByUser) {
      try {
        const regs = this.eventsStore.registrationsByUser.get(userId) || [];
        for (const reg of regs) {
          const ev = this.eventsStore.eventById?.get(reg.eventId);
          if (!ev?.startAt) continue;
          items.push({
            id: `event:${ev.id}`,
            title: ev.title || "Registered event",
            dueAt: new Date(ev.startAt).toISOString(),
            link: `/events/${ev.id}`,
            source: "event",
          });
        }
        sources.events = "ok";
      } catch {
        sources.events = "error";
      }
    }

    // Academic calendar
    for (const m of listAcademicMilestones()) items.push(m);

    const filtered = items
      .filter((i) => {
        const t = Date.parse(i.dueAt);
        if (Number.isNaN(t)) return false;
        if (!includePast && t < now - 86_400_000) return false;
        return t <= horizon;
      })
      .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));

    // de-dupe by id
    const seen = new Set();
    const deduped = filtered.filter((i) => (seen.has(i.id) ? false : seen.add(i.id)));

    return { generatedAt: new Date().toISOString(), items: deduped, sources };
  }
}

module.exports = { UnifiedDeadlineService, parseDdMmYyyy };
