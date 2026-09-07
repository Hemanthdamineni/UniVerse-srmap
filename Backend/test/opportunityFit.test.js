const test = require("node:test");
const assert = require("node:assert/strict");

const {
  scoreOpportunityFit,
  rankOpportunities,
  studentSliceFromGraph,
} = require("../src/services/career/opportunityFit");

const STUDENT = {
  skills: ["Python", "SQL", "React"],
  branch: "CSE",
  year: 3,
  cgpa: 8.2,
  targetRoles: ["Data Scientist", "ML Engineer"],
  preferredTypes: ["internship"],
};

function opp(overrides = {}) {
  return {
    id: overrides.id || "o1",
    title: "Backend Internship",
    type: "internship",
    skills: ["Python", "SQL"],
    eligibleBranches: ["CSE", "IT"],
    eligibleYears: [3, 4],
    minCGPA: 7,
    tags: [],
    deadline: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    ...overrides,
  };
}

test("scores a strong match high and lists concrete reasons", () => {
  const r = scoreOpportunityFit({ opportunity: opp(), student: STUDENT });
  assert.equal(r.eligible, true);
  assert.ok(r.fitScore >= 70, `expected high score, got ${r.fitScore}`);
  assert.deepEqual(r.matchedSkills.sort(), ["Python", "SQL"]);
  assert.deepEqual(r.missingSkills, []);
  assert.ok(r.whyThis.some((w) => /2\/2 of the listed skills/.test(w)));
  assert.ok(r.whyThis.some((w) => /clears the 7 cutoff/.test(w)));
});

test("hard-fails eligibility on branch, year, or a known sub-cutoff CGPA", () => {
  assert.equal(scoreOpportunityFit({ opportunity: opp({ eligibleBranches: ["ECE"] }), student: STUDENT }).eligible, false);
  assert.equal(scoreOpportunityFit({ opportunity: opp({ eligibleYears: [1, 2] }), student: STUDENT }).eligible, false);
  assert.equal(scoreOpportunityFit({ opportunity: opp({ minCGPA: 9 }), student: STUDENT }).eligible, false);
  // Unknown CGPA is not disqualifying.
  assert.equal(
    scoreOpportunityFit({ opportunity: opp({ minCGPA: 9 }), student: { ...STUDENT, cgpa: null } }).eligible,
    true,
  );
});

test("rewards a target-role keyword hit in the title/tags", () => {
  const plain = scoreOpportunityFit({ opportunity: opp({ title: "Backend Internship" }), student: STUDENT });
  const onTarget = scoreOpportunityFit({ opportunity: opp({ title: "Machine Learning Engineer Internship" }), student: STUDENT });
  assert.ok(onTarget.fitScore > plain.fitScore);
  assert.ok(onTarget.whyThis.some((w) => /Matches your goal/.test(w)));
});

test("missing skills are reported for the skill-gap flow", () => {
  const r = scoreOpportunityFit({
    opportunity: opp({ skills: ["Python", "Kubernetes", "Go"] }),
    student: STUDENT,
  });
  assert.deepEqual(r.missingSkills.sort(), ["Go", "Kubernetes"]);
});

test("rankOpportunities drops ineligible and sorts by fit desc", () => {
  const list = [
    opp({ id: "eligible-weak", skills: ["Rust"], title: "Systems role" }),
    opp({ id: "ineligible", eligibleBranches: ["MECH"] }),
    opp({ id: "eligible-strong", title: "Data Scientist Internship", skills: ["Python", "SQL", "React"] }),
  ];
  const ranked = rankOpportunities(list, STUDENT);
  assert.deepEqual(ranked.map((o) => o.id), ["eligible-strong", "eligible-weak"]);
  assert.ok(ranked.every((o) => o.fit.eligible));
});

test("rankOpportunities can keep ineligible items, sorted last", () => {
  const list = [opp({ id: "ineligible", eligibleYears: [1] }), opp({ id: "ok" })];
  const ranked = rankOpportunities(list, STUDENT, { includeIneligible: true });
  assert.equal(ranked.length, 2);
  assert.equal(ranked[ranked.length - 1].id, "ineligible");
});

test("studentSliceFromGraph derives year from semester and pulls target roles + cgpa", () => {
  const slice = studentSliceFromGraph({
    skills: [{ skill: "Python" }, { skill: "SQL" }],
    identity: { branch: "CSE", semester: 6 },
    academic: { results: { cgpa: 8.4 } },
    intent: { targetRoles: ["SRE"] },
  });
  assert.deepEqual(slice.skills, ["Python", "SQL"]);
  assert.equal(slice.branch, "CSE");
  assert.equal(slice.year, 3); // ceil(6/2)
  assert.equal(slice.cgpa, 8.4);
  assert.deepEqual(slice.targetRoles, ["SRE"]);
});
