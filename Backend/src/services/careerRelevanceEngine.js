/**
 * Phase 4 - Career Relevance Engine
 * Handles user-specific scoring for opportunities.
 */

class CareerRelevanceEngine {
  /**
   * Compute a personalized score for an opportunity based on user context and profile.
   * Max score: 100
   */
  static computePersonalizedScore(opportunity, userContext, profile) {
    let score = 0;

    // 1. Skill Match (Max 40 pts)
    const oppSkills = new Set((opportunity.skills || []).map(s => s.toLowerCase()));
    const userSkills = new Set((profile?.skills || []).map(s => s.toLowerCase()));
    
    if (oppSkills.size > 0) {
      let matchCount = 0;
      oppSkills.forEach(skill => {
        if (userSkills.has(skill)) matchCount++;
      });
      score += (matchCount / oppSkills.size) * 40;
    } else {
      score += 20; // Default if no skills listed
    }

    // 2. Branch Match (Max 20 pts)
    const eligibleBranches = new Set((opportunity.eligibleBranches || []).map(b => b.toLowerCase()));
    const userBranch = (userContext.branch || "").toLowerCase();
    
    if (eligibleBranches.size === 0 || eligibleBranches.has(userBranch) || eligibleBranches.has("all")) {
      score += 20;
    }

    // 3. Year Match (Max 20 pts)
    const eligibleYears = new Set(opportunity.eligibleYears || []);
    const userYear = Number.parseInt(String(userContext.year ?? ""), 10);

    if (!Number.isFinite(userYear)) {
      score += 10;
    } else if (eligibleYears.size === 0 || eligibleYears.has(userYear)) {
      score += 20;
    }

    // 4. Preference Match (Max 20 pts)
    const preferredTypes = new Set((profile?.preferredTypes || []).map(t => t.toLowerCase()));
    const preferredLocations = new Set((profile?.preferredLocations || []).map(l => l.toLowerCase()));
    
    if (preferredTypes.size > 0 && preferredTypes.has(opportunity.type.toLowerCase())) {
      score += 10;
    } else if (preferredTypes.size === 0) {
      score += 5;
    }

    if (preferredLocations.size > 0) {
      const oppLoc = (opportunity.location || "").toLowerCase();
      const oppMode = (opportunity.mode || "").toLowerCase();
      
      let locMatch = false;
      preferredLocations.forEach(loc => {
        if (oppLoc.includes(loc) || (loc === "remote" && oppMode === "remote")) {
          locMatch = true;
        }
      });
      
      if (locMatch) score += 10;
    } else {
      score += 5;
    }

    const base = Number(opportunity.relevanceScore);
    const baseBoost = Number.isFinite(base) ? Math.min(15, base * 0.15) : 0;
    return Math.min(100, Math.round(score + baseBoost));
  }

  /**
   * Get skill match details for UI display.
   */
  static getSkillMatchInfo(opportunity, profile) {
    const oppSkills = (opportunity.skills || []);
    const userSkills = new Set((profile?.skills || []).map(s => s.toLowerCase()));
    
    const matched = oppSkills.filter(s => userSkills.has(s.toLowerCase()));
    const missing = oppSkills.filter(s => !userSkills.has(s.toLowerCase()));
    
    return {
      matched,
      missing,
      percent: oppSkills.length > 0 ? Math.round((matched.length / oppSkills.length) * 100) : 100
    };
  }
}

module.exports = CareerRelevanceEngine;
