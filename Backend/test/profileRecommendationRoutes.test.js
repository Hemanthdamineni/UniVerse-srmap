const test = require("node:test");
const assert = require("node:assert/strict");

function createSessionStore() {
  return {
    async getOrThrow() {
      return {
        loggedIn: true,
        profileData: {
          TableContent: {
            "Register No.": "AP23110010001",
            "Student Name": "Student One",
            "Student E-Mail": "student@example.edu",
            "Program / Section": "B.Tech Computer Science and Engineering / A",
            "Academic Year": "III Year",
          },
        },
      };
    },
  };
}

function createUnifiedProfileStore() {
  return {
    buildUnifiedProfile: () => ({ contractVersion: "unified-profile-v1" }),
    listSignals: () => [],
    recordSignal: () => ({ id: "signal-1" }),
    listSkills: () => [],
    updateSkillVisibility: () => [],
    listAchievements: () => [],
    syncEventAchievements: () => ({ synced: [] }),
    updateAchievementVisibility: () => ({ id: "achievement-1" }),
    getPublicCareerProfile: () => ({ contractVersion: "career-public-profile-v1" }),
    getPrivacySettings: () => ({ achievements: "private" }),
    updatePrivacySettings: () => ({ achievements: "public" }),
    getRecommendations: () => ({ contractVersion: "recommendations-v1", items: [] }),
    recordRecommendationFeedback: () => ({ recorded: true }),
  };
}

test("profile router exposes unified profile, signal, skill, achievement, and privacy contracts", () => {
  delete require.cache[require.resolve("../src/routes/profileRoutes")];
  const { createProfileRoutes } = require("../src/routes/profileRoutes");
  const router = createProfileRoutes({
    unifiedProfileStore: createUnifiedProfileStore(),
    sessionStore: createSessionStore(),
    adminPassword: "test-admin",
  });

  const paths = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  for (const routePath of [
    "/profile/unified",
    "/profile/public/:userId",
    "/profile/public-preview",
    "/profile/recompute",
    "/profile/signals",
    "/profile/skills",
    "/profile/skills/:skill/visibility",
    "/profile/achievements",
    "/profile/achievements/sync",
    "/profile/achievements/:achievementId/visibility",
    "/profile/privacy",
  ]) {
    assert.ok(paths.includes(routePath), `missing route ${routePath}`);
  }
});

test("recommendation router exposes domain feeds and feedback capture", () => {
  delete require.cache[require.resolve("../src/routes/recommendationRoutes")];
  const { createRecommendationRoutes } = require("../src/routes/recommendationRoutes");
  const router = createRecommendationRoutes({
    unifiedProfileStore: createUnifiedProfileStore(),
    sessionStore: createSessionStore(),
    adminPassword: "test-admin",
  });

  const paths = router.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  for (const routePath of [
    "/recommendations/home",
    "/recommendations/lms",
    "/recommendations/career",
    "/recommendations/events",
    "/recommendations/feedback",
  ]) {
    assert.ok(paths.includes(routePath), `missing route ${routePath}`);
  }
});
