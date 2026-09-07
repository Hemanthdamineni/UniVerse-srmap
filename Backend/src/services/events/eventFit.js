/**
 * eventFit.js — pure fit scoring for a campus event against a student profile
 * slice. Batch B7 / Story 4.4. The events-side mirror of
 * `career/opportunityFit.js`.
 *
 * `scoreEventFit()` is the single source of truth for "how relevant is this
 * event to this student": event text ∩ the student's skills, whether it builds
 * a known skill gap, whether it touches a subject the student is behind in,
 * academic-department alignment, target-role / interest overlap, affinity with
 * event categories they've joined before, and registration urgency. It returns
 * a 0–100 `fitScore`, the matched skills, an `eligible` flag, and a short
 * `whyThis` list of plain-language reasons for the card.
 *
 * `rankEvents()` scores + sorts a batch. Nothing is dropped by default (unlike
 * opportunities, campus events are rarely hard-gated); pass `onlyEligible` to
 * drop the few that name a branch/year the student demonstrably fails.
 *
 * @module events/eventFit
 */

function arr(v) {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

function str(v) {
  return String(v ?? "").trim();
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

/** Lowercase word tokens of length > 2, de-duped. */
function tokenize(text) {
  return [
    ...new Set(
      str(text)
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/i)
        .map((w) => w.trim())
        .filter((w) => w.length > 2),
    ),
  ];
}

const WEIGHTS = {
  openness: 0.15,
  skillMatch: 0.22,
  gapBuilder: 0.16,
  targetRoleInterest: 0.14,
  academicAlign: 0.13,
  recoveryAid: 0.1,
  history: 0.08,
  urgency: 0.07,
};

/** Build the searchable haystack for one event. */
function eventHaystack(event) {
  return [
    event.title,
    event.description,
    event.category,
    event.department,
    event.eligibility,
    event.prizes,
    ...arr(event.tags),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * @param {object} input
 * @param {object} input.event    { title, description, category, department, tags, eligibility, prizes, startAt, registrationDeadline, featured, competitionConfig }
 * @param {object} input.student
 * @param {string[]} input.student.skills
 * @param {string[]} input.student.interests
 * @param {Array<string|{skill:string}>} input.student.skillGaps
 * @param {Array<{code?:string,name?:string}>} input.student.atRiskSubjects
 * @param {string}   input.student.branch
 * @param {string}   input.student.department
 * @param {number}   input.student.year
 * @param {string[]} input.student.targetRoles
 * @param {string[]} input.student.pastCategories
 * @param {string[]} input.student.pastTags
 * @param {number}   [now]  epoch ms, for deterministic tests
 * @returns {{
 *   fitScore: number, eligible: boolean, matchedSkills: string[], missingSkills: string[],
 *   whyThis: string[], breakdown: Record<string, number>
 * }}
 */
function scoreEventFit({ event = {}, student = {} }, now = Date.now()) {
  const haystack = eventHaystack(event);
  const contains = (needle) => {
    const n = str(needle).toLowerCase();
    return n.length > 2 && haystack.includes(n);
  };

  // ---- Skill match ----
  const studentSkills = arr(student.skills).map(str).filter(Boolean);
  const matchedSkills = studentSkills.filter(contains);
  const skillMatchScore = Math.min(1, matchedSkills.length / 3);

  // ---- Gap builder ----
  const gaps = arr(student.skillGaps)
    .map((g) => (typeof g === "string" ? g : str(g && g.skill)))
    .filter(Boolean);
  const matchedGaps = gaps.filter(contains);
  const gapBuilderScore = Math.min(1, matchedGaps.length / 2);

  // ---- Recovery aid: does the event touch a subject the student is behind in? ----
  const atRisk = arr(student.atRiskSubjects)
    .map((s) => (typeof s === "string" ? { name: s } : s || {}))
    .filter((s) => s.code || s.name);
  const recoveredSubject = atRisk.find((s) => {
    if (s.code && contains(s.code)) return true;
    const words = tokenize(s.name).filter((w) => w.length > 3);
    return words.some((w) => haystack.includes(w));
  });
  const recoveryAidScore = recoveredSubject ? 1 : 0;

  // ---- Academic alignment ----
  const dept = str(student.department).toLowerCase();
  const branch = str(student.branch).toLowerCase();
  const eventDept = str(event.department).toLowerCase();
  let academicAlignScore = 0.3;
  if (eventDept && (eventDept === dept || (branch && eventDept.includes(branch)))) academicAlignScore = 1;
  else if ((dept && contains(dept)) || (branch && contains(branch))) academicAlignScore = 0.6;

  // ---- Target roles + interests ----
  const roleTerms = [...arr(student.targetRoles), ...arr(student.interests)].map(str).filter(Boolean);
  const roleHits = roleTerms.filter((role) => {
    const words = tokenize(role);
    return words.length > 0 && words.some((w) => haystack.includes(w));
  });
  const targetRoleInterestScore =
    roleTerms.length === 0 ? 0.5 : Math.min(1, roleHits.length / Math.min(roleTerms.length, 2));

  // ---- History affinity ----
  const pastCategories = new Set(arr(student.pastCategories).map((c) => str(c).toLowerCase()));
  const pastTags = new Set(arr(student.pastTags).map((t) => str(t).toLowerCase()));
  const categoryMatch = pastCategories.has(str(event.category).toLowerCase());
  const tagMatch = arr(event.tags).some((t) => pastTags.has(str(t).toLowerCase()));
  let historyScore = 0.5;
  if (categoryMatch) historyScore = 1;
  else if (tagMatch) historyScore = 0.7;
  else if (pastCategories.size || pastTags.size) historyScore = 0.35;

  // ---- Urgency ----
  const deadlineRaw = event.registrationDeadline || event.startAt;
  const deadlineMs = deadlineRaw ? Date.parse(deadlineRaw) : NaN;
  let urgencyScore = 0.5;
  let daysToDeadline = null;
  if (Number.isFinite(deadlineMs)) {
    daysToDeadline = (deadlineMs - now) / 86_400_000;
    urgencyScore = daysToDeadline < 0 ? 0 : daysToDeadline <= 7 ? 1 : daysToDeadline <= 21 ? 0.8 : 0.5;
  }

  // ---- Eligibility (soft) ----
  // Only a *known* student branch that an explicit eligibility line names a
  // whitelist without is ineligible; an unknown branch or a line that doesn't
  // enumerate branches leaves the event open.
  const eligibilityText = str(event.eligibility).toLowerCase();
  const namesBranches = /\b(cse|ece|eee|mech|civil|csbs|aiml|biotech|bba|mba)\b/.test(eligibilityText);
  const eligible = !namesBranches || !branch || new RegExp(`\\b${branch}\\b`).test(eligibilityText);

  // An eligible, live event carries a baseline of relevance — the events-side
  // analogue of the opportunity scorer's ever-present eligibility term.
  const opennessScore = eligible ? 1 : 0.3;

  const competitionBoost = event.competitionConfig ? 0.06 : 0;
  const featuredBoost = event.featured ? 0.05 : 0;

  const raw =
    WEIGHTS.openness * opennessScore +
    WEIGHTS.skillMatch * skillMatchScore +
    WEIGHTS.gapBuilder * gapBuilderScore +
    WEIGHTS.targetRoleInterest * targetRoleInterestScore +
    WEIGHTS.academicAlign * academicAlignScore +
    WEIGHTS.recoveryAid * recoveryAidScore +
    WEIGHTS.history * historyScore +
    WEIGHTS.urgency * urgencyScore +
    competitionBoost +
    featuredBoost;
  const fitScore = Math.max(0, Math.min(100, Math.round(raw * 100)));

  // ---- Plain-language reasons (most specific first) ----
  const whyThis = [];
  if (recoveredSubject) {
    whyThis.push(
      `Could help with ${recoveredSubject.name || recoveredSubject.code}, where your attendance is low`,
    );
  }
  if (matchedGaps.length) {
    whyThis.push(`Builds a skill you're missing: ${matchedGaps.slice(0, 2).join(", ")}`);
  }
  if (matchedSkills.length) {
    whyThis.push(`Matches your skills: ${matchedSkills.slice(0, 3).join(", ")}`);
  }
  if (roleHits.length) whyThis.push(`Aligned with your goal: ${roleHits[0]}`);
  if (academicAlignScore === 1) whyThis.push("Hosted by your department");
  if (categoryMatch) whyThis.push(`Similar to ${str(event.category)} events you've joined`);
  if (event.competitionConfig) whyThis.push("Competition experience strengthens your profile");
  if (daysToDeadline != null && daysToDeadline >= 0 && daysToDeadline <= 3) {
    const d = Math.ceil(daysToDeadline);
    whyThis.push(`Registration closes in ${d} day${d === 1 ? "" : "s"}`);
  }
  if (whyThis.length === 0) {
    whyThis.push(`Upcoming ${str(event.category).toLowerCase() || "campus"} event`);
  }

  return {
    fitScore,
    eligible,
    matchedSkills,
    missingSkills: [],
    whyThis: whyThis.slice(0, 3),
    breakdown: {
      opennessScore,
      skillMatchScore: round(skillMatchScore),
      gapBuilderScore: round(gapBuilderScore),
      targetRoleInterestScore: round(targetRoleInterestScore),
      academicAlignScore: round(academicAlignScore),
      recoveryAidScore,
      historyScore: round(historyScore),
      urgencyScore: round(urgencyScore),
    },
  };
}

/**
 * Score + sort a batch. Ineligible items sort last but are kept unless
 * `onlyEligible` is set.
 *
 * @param {Array} events
 * @param {object} student  same slice as scoreEventFit
 * @param {{ onlyEligible?: boolean, now?: number }} [opts]
 * @returns {Array} each item = { ...event, fit: { ... } }
 */
function rankEvents(events, student, { onlyEligible = false, now = Date.now() } = {}) {
  const scored = arr(events).map((event) => ({
    ...event,
    fit: scoreEventFit({ event, student }, now),
  }));
  const filtered = onlyEligible ? scored.filter((e) => e.fit.eligible) : scored;
  return filtered.sort((a, b) => {
    if (a.fit.eligible !== b.fit.eligible) return a.fit.eligible ? -1 : 1;
    return b.fit.fitScore - a.fit.fitScore;
  });
}

/** Pull the fit-relevant slice out of a full StudentGraph. */
function studentSliceFromGraph(graph) {
  const identity = graph && graph.identity ? graph.identity : {};
  const derived = graph && graph.derived ? graph.derived : {};
  const intent = graph && graph.intent ? graph.intent : {};
  return {
    skills: arr(graph && graph.skills)
      .map((s) => (typeof s === "string" ? s : s && s.skill))
      .filter(Boolean),
    interests: arr(intent.interestAreas),
    skillGaps: arr(derived.skillGaps),
    atRiskSubjects: arr(derived.atRiskSubjects),
    branch: identity.branch || "",
    department: identity.program || identity.department || "",
    year: identity.semester != null ? Math.ceil(Number(identity.semester) / 2) : "",
    targetRoles: arr(intent.targetRoles),
    pastCategories: [],
    pastTags: [],
  };
}

module.exports = { scoreEventFit, rankEvents, studentSliceFromGraph, EVENT_FIT_WEIGHTS: WEIGHTS };
