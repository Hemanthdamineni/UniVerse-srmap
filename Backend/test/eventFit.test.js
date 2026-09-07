const test = require("node:test");
const assert = require("node:assert/strict");

const { scoreEventFit, rankEvents, studentSliceFromGraph } = require("../src/services/events/eventFit");

const NOW = Date.parse("2026-09-07T00:00:00.000Z");

const STUDENT = {
  skills: ["React", "Python", "SQL"],
  interests: ["Machine Learning"],
  skillGaps: [{ skill: "Kubernetes" }, "Docker"],
  atRiskSubjects: [{ code: "CSE304", name: "Operating Systems", pct: 62 }],
  branch: "CSE",
  department: "Computer Science",
  year: 3,
  targetRoles: ["Data Scientist"],
  pastCategories: ["Technical"],
  pastTags: ["hackathon"],
};

function event(overrides = {}) {
  return {
    id: overrides.id || "e1",
    title: "Campus Hackathon",
    description: "Build campus tools with React and Python.",
    category: "Technical",
    department: "Computer Science",
    tags: ["React", "hackathon"],
    eligibility: "",
    startAt: new Date(NOW + 20 * 86_400_000).toISOString(),
    registrationDeadline: new Date(NOW + 10 * 86_400_000).toISOString(),
    featured: false,
    competitionConfig: null,
    ...overrides,
  };
}

test("scores a strong match well above a weak one, with concrete reasons", () => {
  const strong = scoreEventFit({ event: event(), student: STUDENT }, NOW);
  const weak = scoreEventFit(
    {
      event: event({
        title: "Open Mic Evening",
        description: "Campus cultural evening.",
        category: "Cultural",
        department: "Arts",
        tags: ["music"],
      }),
      student: { ...STUDENT, pastCategories: [], pastTags: [] },
    },
    NOW,
  );
  assert.equal(strong.eligible, true);
  assert.ok(strong.fitScore >= 50, `expected a solid score, got ${strong.fitScore}`);
  assert.ok(strong.fitScore - weak.fitScore >= 20, `strong ${strong.fitScore} vs weak ${weak.fitScore}`);
  assert.ok(strong.matchedSkills.includes("React"));
  assert.ok(strong.whyThis.some((w) => /Matches your skills/.test(w)));
  assert.ok(strong.whyThis.some((w) => /Hosted by your department/.test(w)));
});

test("surfaces a recovery-aid reason when the event touches an at-risk subject", () => {
  const r = scoreEventFit(
    {
      event: event({
        title: "Operating Systems crash course",
        description: "Revise scheduling, paging and deadlocks before finals.",
        tags: [],
      }),
      student: STUDENT,
    },
    NOW,
  );
  assert.equal(r.breakdown.recoveryAidScore, 1);
  assert.ok(r.whyThis.some((w) => /Could help with Operating Systems/.test(w)));
});

test("surfaces a gap-builder reason", () => {
  const r = scoreEventFit(
    {
      event: event({ title: "Docker & Kubernetes workshop", description: "Containers end to end.", tags: [] }),
      student: STUDENT,
    },
    NOW,
  );
  assert.ok(r.breakdown.gapBuilderScore > 0);
  assert.ok(r.whyThis.some((w) => /Builds a skill you're missing/.test(w)));
});

test("a generic unrelated event still gets a fallback reason and a low score", () => {
  const r = scoreEventFit(
    {
      event: event({
        title: "Open Mic Evening",
        description: "Campus cultural evening.",
        category: "Cultural",
        department: "Student Union",
        tags: ["music"],
        competitionConfig: null,
        registrationDeadline: new Date(NOW + 40 * 86_400_000).toISOString(),
      }),
      student: { ...STUDENT, pastCategories: [], pastTags: [] },
    },
    NOW,
  );
  assert.ok(r.fitScore < 45, `expected low score, got ${r.fitScore}`);
  assert.deepEqual(r.whyThis, ["Upcoming cultural event"]);
});

test("a known branch excluded by the eligibility line is ineligible", () => {
  const r = scoreEventFit(
    { event: event({ eligibility: "Open to ECE and EEE students only" }), student: STUDENT },
    NOW,
  );
  assert.equal(r.eligible, false);
});

test("an unknown branch is never disqualified", () => {
  const r = scoreEventFit(
    { event: event({ eligibility: "ECE only" }), student: { ...STUDENT, branch: "" } },
    NOW,
  );
  assert.equal(r.eligible, true);
});

test("flags a closing-soon registration window", () => {
  const r = scoreEventFit(
    {
      event: event({
        title: "Alumni networking mixer",
        description: "Meet alumni over coffee.",
        category: "Cultural",
        department: "Student Union",
        tags: [],
        registrationDeadline: new Date(NOW + 2 * 86_400_000).toISOString(),
      }),
      student: { ...STUDENT, pastCategories: [], pastTags: [] },
    },
    NOW,
  );
  assert.equal(r.breakdown.urgencyScore, 1);
  assert.ok(r.whyThis.some((w) => /closes in 2 days/.test(w)));
});

test("rankEvents sorts by fit and keeps ineligible last", () => {
  const ranked = rankEvents(
    [
      event({ id: "weak", title: "Open Mic", description: "music", category: "Cultural", department: "Arts", tags: [] }),
      event({ id: "strong" }),
      event({ id: "blocked", eligibility: "MECH students only" }),
    ],
    STUDENT,
    { now: NOW },
  );
  assert.equal(ranked[0].id, "strong");
  assert.equal(ranked[ranked.length - 1].id, "blocked");
  assert.ok(ranked.every((e) => e.fit && typeof e.fit.fitScore === "number"));
});

test("studentSliceFromGraph pulls skills, gaps, at-risk subjects and identity", () => {
  const slice = studentSliceFromGraph({
    identity: { branch: "CSE", program: "Computer Science", semester: 5 },
    skills: [{ skill: "React" }, { skill: "Python" }],
    derived: {
      skillGaps: [{ skill: "Docker" }],
      atRiskSubjects: [{ code: "CSE304", name: "Operating Systems" }],
    },
    intent: { targetRoles: ["Data Scientist"], interestAreas: ["ML"] },
  });
  assert.deepEqual(slice.skills, ["React", "Python"]);
  assert.equal(slice.branch, "CSE");
  assert.equal(slice.department, "Computer Science");
  assert.equal(slice.year, 3);
  assert.deepEqual(slice.targetRoles, ["Data Scientist"]);
  assert.equal(slice.atRiskSubjects[0].code, "CSE304");
  assert.deepEqual(slice.pastCategories, []);
});
