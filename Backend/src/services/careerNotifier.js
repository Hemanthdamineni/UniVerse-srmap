/**
 * Phase 5 — career notifications via EventsStore (in-app).
 * Idempotent per (user, kind, ref, UTC day) using career_notification_log.
 */

function utcDay(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function runCareerNotificationCycle({ careerStore, eventsStore, now = new Date() } = {}) {
  if (!careerStore || !eventsStore || typeof eventsStore.pushCareerNotification !== "function") {
    return { deadlineSent: 0, digestSent: 0 };
  }

  const day = utcDay(now);
  let deadlineSent = 0;
  let digestSent = 0;

  const deadlineRows = careerStore.getBookmarkDeadlineReminderCandidates(3);
  for (const row of deadlineRows) {
    if (careerStore.hasCareerNotificationLog(row.userId, "deadline_soon", row.opportunityId, day)) {
      continue;
    }
    eventsStore.pushCareerNotification(row.userId, {
      type: "career_deadline_soon",
      title: "Application deadline approaching",
      message: `"${row.title}" closes soon. Review your bookmarks in the Career portal.`,
      channel: ["in-app"],
    });
    careerStore.recordCareerNotificationLog(row.userId, "deadline_soon", row.opportunityId, day);
    deadlineSent += 1;
  }

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const digestRows = careerStore.getSkillMatchDigestRows(since);
  for (const row of digestRows) {
    if (!row.userId || !row.count) continue;
    if (careerStore.hasCareerNotificationLog(row.userId, "skill_digest", "daily", day)) {
      continue;
    }
    eventsStore.pushCareerNotification(row.userId, {
      type: "career_skill_digest",
      title: "New opportunities matched your skills",
      message: `${row.count} new listing(s) in the last day may fit your career profile. Open Career → Personalized feed.`,
      channel: ["in-app"],
    });
    careerStore.recordCareerNotificationLog(row.userId, "skill_digest", "daily", day);
    digestSent += 1;
  }

  return { deadlineSent, digestSent };
}

module.exports = {
  runCareerNotificationCycle,
  utcDay,
};
