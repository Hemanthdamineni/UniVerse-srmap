/**
 * helpers/skillGaps.js — pure computation for career skill-gap analysis.
 *
 * Given a student's known skills and the skills required across active
 * opportunities, compute the canonical list of missing skills ranked by how
 * many opportunities demand them. This is the calculation core of
 * `_recomputeSkillGaps` in `careerStore.js`; the store keeps the SQL
 * persistence and delegates the ranking here.
 *
 * Canonical skill names collapse aliases ("aws" / "AWS" / "Amazon Web
 * Services" all collapse to one gap displayed as "AWS").
 */

const { canonicalizeSkills } = require("../../../utils/skillNames");

const TOP_GAP_LIMIT = 10;

/**
 * @param {string[]} userSkills            skills the student already has
 * @param {Array<{ skills?: string|string[] }>} opportunities  active listings, each exposing a `skills` column value (JSON string or array)
 * @returns {Array<{ skill: string, count: number }>} top missing skills by demand count, descending
 */
function computeSkillGaps(userSkills, opportunities = []) {
  const haveSet = new Set(canonicalizeSkills(userSkills).map((skill) => skill.toLowerCase()));

  const gapMap = new Map(); // canonical-lowercase -> { skill, count }
  for (const opp of opportunities) {
    const oppSkills = Array.isArray(opp && opp.skills) ? opp.skills : parseSkills(opp && opp.skills);
    for (const skill of canonicalizeSkills(oppSkills)) {
      const key = skill.toLowerCase();
      if (haveSet.has(key)) continue;
      const entry = gapMap.get(key) || { skill, count: 0 };
      entry.count += 1;
      gapMap.set(key, entry);
    }
  }

  return Array.from(gapMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_GAP_LIMIT);
}

function parseSkills(value) {
  if (value == null || value === "") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = { computeSkillGaps, TOP_GAP_LIMIT };