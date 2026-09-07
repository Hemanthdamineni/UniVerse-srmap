/**
 * digestService.js — the weekly email digest (Batch B9 / T6.4.2).
 *
 * Composes an HTML + text digest per student from the student graph (readiness,
 * at-risk subjects, skill gaps) plus optional career/events collaborators, and
 * sends it through the notification email transport. Idempotent per ISO week
 * via the notification delivery log.
 *
 * @module core/digestService
 */

const { simpleEmailHtml } = require("./notificationService");

function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/**
 * @param {object} args
 * @param {object} args.graph          StudentGraph for the user
 * @param {Array}  [args.deadlines]    [{ title, deadline, opportunityId }]
 * @param {Array}  [args.topFits]      [{ title, fitScore, id }]
 * @param {Array}  [args.events]       [{ title, startAt }]
 * @param {string} [args.name]
 * @returns {{ subject: string, html: string, text: string, isEmpty: boolean }}
 */
function buildWeeklyDigest({ graph, deadlines = [], topFits = [], events = [], name = "" } = {}) {
  const first = String(name || graph?.identity?.name || "there").split(/\s+/)[0];
  const readiness = graph?.derived?.readinessScore;
  const atRisk = graph?.derived?.atRiskSubjects ?? [];
  const gaps = graph?.derived?.skillGaps ?? [];

  const lines = []; // text
  const blocks = []; // html

  if (typeof readiness === "number") {
    lines.push(`Placement readiness: ${readiness}/100.`);
    blocks.push(`<p style="margin:0 0 12px"><strong>Placement readiness:</strong> ${readiness}/100</p>`);
  }

  if (atRisk.length) {
    lines.push(
      `Attendance needs attention: ${atRisk
        .map((s) => `${s.code || s.name} (${s.pct}%, attend ${s.classesToRecover ?? "?"} more)`)
        .join("; ")}.`,
    );
    blocks.push(
      `<p style="margin:16px 0 4px"><strong>Attendance needs attention</strong></p><ul style="margin:0 0 12px;padding-left:18px">${atRisk
        .map((s) => `<li>${esc(s.code || s.name)} — ${s.pct}%, attend ${s.classesToRecover ?? "?"} more</li>`)
        .join("")}</ul>`,
    );
  }

  if (deadlines.length) {
    lines.push(`Closing soon: ${deadlines.map((d) => `${d.title} (${d.deadline || "soon"})`).join("; ")}.`);
    blocks.push(
      `<p style="margin:16px 0 4px"><strong>Closing soon</strong></p><ul style="margin:0 0 12px;padding-left:18px">${deadlines
        .map((d) => `<li>${esc(d.title)} — ${esc(d.deadline || "soon")}</li>`)
        .join("")}</ul>`,
    );
  }

  if (topFits.length) {
    lines.push(`New matches: ${topFits.map((f) => `${f.title}${f.fitScore ? ` (${f.fitScore}%)` : ""}`).join("; ")}.`);
    blocks.push(
      `<p style="margin:16px 0 4px"><strong>New opportunities that fit you</strong></p><ul style="margin:0 0 12px;padding-left:18px">${topFits
        .map((f) => `<li>${esc(f.title)}${f.fitScore ? ` — ${f.fitScore}% fit` : ""}</li>`)
        .join("")}</ul>`,
    );
  }

  if (events.length) {
    lines.push(`Events this week: ${events.map((e) => e.title).join("; ")}.`);
    blocks.push(
      `<p style="margin:16px 0 4px"><strong>Events this week</strong></p><ul style="margin:0 0 12px;padding-left:18px">${events
        .map((e) => `<li>${esc(e.title)}</li>`)
        .join("")}</ul>`,
    );
  }

  if (gaps.length && !topFits.length) {
    lines.push(`Top skill gap: ${gaps[0].skill}.`);
    blocks.push(`<p style="margin:16px 0 12px">Worth learning next: <strong>${esc(gaps[0].skill)}</strong></p>`);
  }

  const isEmpty = blocks.length === 0;
  const summaryText = isEmpty
    ? "Nothing urgent this week — you're on track."
    : `Hi ${first}, here's your week:\n\n${lines.join("\n")}`;

  return {
    subject: isEmpty ? "Your week: all clear" : `Your week: ${headline(atRisk, deadlines, readiness)}`,
    text: summaryText,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#0A3035">
      <p style="margin:0 0 16px;font-size:15px">Hi ${esc(first)}, here's your week on the platform.</p>
      ${blocks.join("\n")}
      <p style="margin:20px 0 0"><a href="/dashboard" style="display:inline-block;background:#34AEBE;color:#fff;text-decoration:none;padding:8px 16px;border-radius:8px;font-size:13px">Open dashboard</a></p>
    </div>`,
    isEmpty,
  };
}

function headline(atRisk, deadlines, readiness) {
  if (atRisk.length) return `${atRisk.length} attendance risk${atRisk.length === 1 ? "" : "s"}`;
  if (deadlines.length) return `${deadlines.length} deadline${deadlines.length === 1 ? "" : "s"} soon`;
  if (typeof readiness === "number") return `readiness ${readiness}/100`;
  return "your update";
}

/**
 * Send the weekly digest to every eligible recipient, once per ISO week.
 *
 * @param {object} deps
 * @param {import("./notificationStore").NotificationStore} deps.notificationStore
 * @param {object} deps.studentGraphService  { getGraph(user) }
 * @param {object} deps.emailAdapter         { deliver({ userId, notification }) }
 * @param {object} [deps.careerStore]        { getBookmarkDeadlineReminderCandidates(days) }
 * @param {Function} [deps.log]
 * @returns {Promise<{ sent: number, skipped: number }>}
 */
async function runWeeklyDigestCycle({
  notificationStore,
  studentGraphService,
  emailAdapter,
  careerStore = null,
  now = new Date(),
  log = () => {},
} = {}) {
  if (!notificationStore || !studentGraphService || !emailAdapter) return { sent: 0, skipped: 0 };
  const week = isoWeekKey(now);
  const recipients = notificationStore.digestRecipients();
  let sent = 0;
  let skipped = 0;

  // Deadlines are cheap to fetch per user only if the store supports it.
  for (const r of recipients) {
    const already = notificationStore
      .recentDeliveries(r.userId, 20)
      .some((d) => d.event_key === "digest_weekly" && d.detail === week && d.status === "delivered");
    if (already) {
      skipped += 1;
      continue;
    }

    let graph = null;
    try {
      graph = studentGraphService.getGraph({ userId: r.userId, name: r.name, email: r.email });
    } catch {
      graph = null;
    }

    let deadlines = [];
    try {
      if (careerStore?.getBookmarkDeadlineReminderCandidates) {
        deadlines = careerStore
          .getBookmarkDeadlineReminderCandidates(7)
          .filter((row) => row.userId === r.userId)
          .slice(0, 4)
          .map((row) => ({ title: row.title, deadline: row.deadline, opportunityId: row.opportunityId }));
      }
    } catch {
      deadlines = [];
    }

    const digest = buildWeeklyDigest({ graph, deadlines, name: r.name });

    const outcome = await emailAdapter.deliver({
      userId: r.userId,
      notification: {
        eventKey: "digest_weekly",
        category: "system",
        title: digest.subject,
        body: digest.text,
        url: "/dashboard",
        html: digest.html,
        data: { eventKey: "digest_weekly" },
      },
    });

    notificationStore.logDelivery({
      userId: r.userId,
      eventKey: "digest_weekly",
      category: "system",
      channel: "email",
      status: outcome.ok ? "delivered" : "failed",
      detail: week, // idempotency marker
      attempts: 1,
    });
    if (outcome.ok) sent += 1;
    else log({ level: "warn", msg: "Weekly digest send failed", userId: r.userId, error: outcome.error });
  }

  return { sent, skipped };
}

module.exports = { buildWeeklyDigest, runWeeklyDigestCycle, isoWeekKey, simpleEmailHtml };
