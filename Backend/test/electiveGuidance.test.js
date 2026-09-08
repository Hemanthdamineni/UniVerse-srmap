const test = require("node:test");
const assert = require("node:assert/strict");

const { TRACKS, resolveTracks, rankElectives, fromGraph } = require("../src/services/career/electiveGuidance");

const SUBJECTS = [
  { code: "E1", name: "Introduction to Machine Learning", credit: 3 },
  { code: "E2", name: "Cloud Computing", credit: 3 },
  { code: "E3", name: "Natural Language Processing", credit: 3 },
  { code: "E4", name: "Cryptography and Network Security", credit: 3 },
  { code: "E5", name: "Indian Constitution", credit: 2 }, // no keyword → ignored
];

test("resolveTracks maps free-text goals to track ids", () => {
  assert.deepEqual(resolveTracks(["ML Engineer"]).sort(), ["ml-ai"]);
  assert.deepEqual(resolveTracks(["Data Scientist", "backend developer"]).sort(), [
    "data-science",
    "software-engineer",
  ]);
  assert.deepEqual(resolveTracks(["poet"]), []);
});

test("rankElectives scores electives by the student's target track", () => {
  const { tracks, electives } = rankElectives({
    subjects: SUBJECTS,
    targetRoles: ["Machine Learning Engineer"],
  });
  assert.deepEqual(tracks, [{ id: "ml-ai", label: TRACKS["ml-ai"], primary: true }]);

  const codes = electives.map((e) => e.code);
  assert.ok(codes.includes("E1") && codes.includes("E3")); // ML + NLP
  assert.ok(!codes.includes("E2")); // cloud — no ml-ai weight
  assert.ok(!codes.includes("E5")); // no keyword at all
  assert.equal(electives[0].code, "E1");
  assert.match(electives[0].why, /ML \/ AI Engineer/);
});

test("interest areas count at half weight, behind the primary goal", () => {
  const { tracks, electives } = rankElectives({
    subjects: SUBJECTS,
    targetRoles: ["Security Engineer"],
    interestAreas: ["cloud infrastructure"],
  });
  assert.deepEqual(
    tracks.map((t) => [t.id, t.primary]),
    [["security", true], ["devops-cloud", false]],
  );
  const byCode = Object.fromEntries(electives.map((e) => [e.code, e.score]));
  // Crypto (security, weight 3 × 1) outranks Cloud (devops, weight 3 × 0.5).
  assert.ok(byCode.E4 > byCode.E2);
});

test("no resolvable career goal → empty electives, tracks still hint what was parsed", () => {
  const r = rankElectives({ subjects: SUBJECTS, targetRoles: [], interestAreas: [] });
  assert.deepEqual(r, { tracks: [], electives: [] });
});

test("fromGraph reads curriculum + intent off a StudentGraph", () => {
  const r = fromGraph({
    academic: { curriculum: { subjects: SUBJECTS } },
    intent: { targetRoles: ["Data Engineer"], interestAreas: [] },
  });
  assert.equal(r.tracks[0].id, "data-engineering");
  assert.equal(r.electives[0].code, "E2"); // Cloud Computing weights data-engineering
});
