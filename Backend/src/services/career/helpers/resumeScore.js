/**
 * helpers/resumeScore.js — pure computation for résumé / skill quality scoring.
 *
 * `scoreResume()` evaluates a parsed résumé (`parsed` from `resumeParse`) plus
 * career-fit context (profile skills, in-demand skill gaps, preferred types)
 * and returns a 0–100 `score`, the per-criterion `rubric`, and an ordered list
 * of `suggestions` (first item is the single biggest win). This is the
 * calculation core of `_scoreResume` in `careerStore.js`.
 */

const { canonicalizeSkill, isKnownSkill } = require("../../../utils/skillNames");

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * @param {object} parsed  output of `resumeParse.parseResume`
 * @param {object} ctx     { profileSkills[], skillGaps[{skill,opportunityCount}], preferredTypes[] }
 * @returns {{ score: number, rubric: Array, suggestions: Array }}
 */
function scoreResume(parsed = {}, ctx = {}) {
  const profileSkills = ensureArray(ctx.profileSkills).map((s) => String(s).toLowerCase());
  const skillGaps = ensureArray(ctx.skillGaps);
  const preferredTypes = ensureArray(ctx.preferredTypes).map((t) => String(t).toLowerCase());

  const sectionCount = ensureArray(parsed.sections).length;
  const skillCount = ensureArray(parsed.skills).length;
  const projectCount = ensureArray(parsed.projects).length;
  const impactCount = ensureArray(parsed.quantifiedImpacts).length;
  const experienceCount = ensureArray(parsed.experience).length;
  const thinEntries = [...ensureArray(parsed.projects), ...ensureArray(parsed.experience)].filter(
    (e) => (e.bulletCount || 0) < 2,
  ).length;
  const resumeSkillsLower = new Set(ensureArray(parsed.skills).map((s) => String(s).toLowerCase()));
  const overlap = profileSkills.filter((s) => resumeSkillsLower.has(s)).length;
  const overlapRatio = profileSkills.length ? overlap / profileSkills.length : 0;
  const missingLinks = [
    parsed.hasGithub ? null : "GitHub",
    parsed.hasLinkedin ? null : "LinkedIn",
    parsed.hasPortfolio ? null : "a portfolio",
  ].filter(Boolean);

  const rubric = [
    {
      key: "structure",
      label: "Resume structure",
      score:
        sectionCount >= 4 && parsed.wordCount >= 150 ? 20
          : sectionCount >= 3 || parsed.wordCount >= 120 ? 13
            : parsed.wordCount >= 60 ? 7
              : 3,
      max: 20,
      reason:
        sectionCount >= 4
          ? `Clear structure — ${sectionCount} standard sections detected.`
          : `Only ${sectionCount} standard section${sectionCount === 1 ? "" : "s"} detected.`,
      tip: "Add clearly labelled sections: Experience, Projects, Skills, Education.",
    },
    {
      key: "skills",
      label: "Skill coverage",
      score: skillCount >= 12 ? 20 : skillCount >= 6 ? 15 : skillCount >= 1 ? 8 : 0,
      max: 20,
      reason: skillCount ? `${skillCount} distinct skills detected.` : "No recognizable skills detected.",
      tip:
        skillCount >= 6
          ? "Group skills under headings (Languages, Frameworks, Tools) for readability."
          : "Add a Technical Skills section listing languages, frameworks and tools.",
    },
    {
      key: "projects",
      label: "Project evidence",
      score: projectCount >= 3 ? 15 : projectCount === 2 ? 11 : projectCount === 1 ? 6 : 0,
      max: 15,
      reason: projectCount
        ? `${projectCount} project${projectCount === 1 ? "" : "s"} detected.`
        : "No projects detected.",
      tip: "Add a Projects section with 2-3 concrete builds and their impact.",
    },
    {
      key: "detail",
      label: "Entry detail",
      score: (() => {
        const entries = projectCount + experienceCount;
        if (!entries) return 0;
        return Math.round(10 * (1 - thinEntries / entries));
      })(),
      max: 10,
      reason: thinEntries
        ? `${thinEntries} project/role${thinEntries === 1 ? "" : "s"} have fewer than 2 bullet points.`
        : "Every project and role has supporting bullets.",
      tip: "Give each project and role at least 2-3 result-oriented bullet points.",
    },
    {
      key: "impact",
      label: "Quantified impact",
      score: Math.min(15, impactCount * 4),
      max: 15,
      reason: impactCount
        ? `${impactCount} quantified outcome${impactCount === 1 ? "" : "s"}.`
        : "No quantified outcomes.",
      tip: "Back up bullets with numbers — %, users served, latency, revenue.",
    },
    {
      key: "links",
      label: "Portfolio links",
      score: Math.min(15, (parsed.hasGithub ? 6 : 0) + (parsed.hasLinkedin ? 6 : 0) + (parsed.hasPortfolio ? 3 : 0)),
      max: 15,
      reason: missingLinks.length
        ? `Missing ${missingLinks.join(", ")} link${missingLinks.length === 1 ? "" : "s"}.`
        : "GitHub, LinkedIn and portfolio links are present.",
      tip: "Add GitHub, LinkedIn and portfolio links to your header.",
    },
    {
      key: "target",
      label: "Profile alignment",
      score: profileSkills.length === 0 ? 10 : overlapRatio >= 0.5 ? 15 : overlapRatio >= 0.25 ? 10 : 5,
      max: 15,
      reason:
        profileSkills.length === 0
          ? "Add skills to your Career profile so we can compare."
          : `${overlap} of your ${profileSkills.length} profile skills appear on the résumé.`,
      tip: "Merge the résumé skills into your Career profile so opportunity matching improves.",
    },
  ];

  // Normalise to /100 (rubric maxes sum to 110 after adding "detail").
  const rawScore = rubric.reduce((sum, item) => sum + item.score, 0);
  const rawMax = rubric.reduce((sum, item) => sum + item.max, 0);
  const score = Math.round((rawScore / rawMax) * 100);

  // Ordered suggestions: rubric gaps by (missed points), then career-fit items.
  const suggestions = rubric
    .filter((item) => item.score < item.max * 0.7)
    .sort((a, b) => b.max - b.score - (a.max - a.score))
    .map((item) => ({
      tip: item.tip,
      category: item.key,
      priority: item.max - item.score >= item.max * 0.6 ? "high" : "medium",
    }));

  const gapMissing = skillGaps
    .map((g) => String(g.skill || ""))
    .filter((s) => s && isKnownSkill(s) && !resumeSkillsLower.has(s.toLowerCase()))
    .map((s) => canonicalizeSkill(s))
    .slice(0, 5);
  if (gapMissing.length) {
    suggestions.unshift({
      tip: `Add ${gapMissing.length} in-demand skill${gapMissing.length === 1 ? "" : "s"} your résumé is missing: ${gapMissing.join(", ")}.`,
      category: "career-fit",
      priority: "high",
    });
  }
  if (experienceCount === 0 && preferredTypes.some((t) => /job|intern/.test(t))) {
    suggestions.push({
      tip: "You're targeting jobs/internships — add a Work Experience section, even for projects, freelance or open-source work.",
      category: "career-fit",
      priority: "medium",
    });
  }
  if (profileSkills.length && skillCount && overlapRatio < 0.3) {
    suggestions.push({
      tip: "Your résumé and Career profile skills barely overlap — use “Merge to Profile” to align them.",
      category: "career-fit",
      priority: "medium",
    });
  }

  return { score, rubric, suggestions: suggestions.slice(0, 6) };
}

module.exports = { scoreResume };