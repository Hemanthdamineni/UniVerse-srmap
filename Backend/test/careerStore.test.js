const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { CareerStore } = require("../src/services/career/careerStore");
const { CareerRelevanceEngine } = require("../src/services/career/careerServices");

function makeStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "career-store-test-"));
  const dbPath = path.join(tempDir, "career.sqlite");
  return { store: new CareerStore({ dbPath }), tempDir, dbPath };
}

function makeUser(overrides = {}) {
  return {
    role: "student",
    userId: "student-1",
    name: "Test Student",
    email: "s@test.edu",
    branch: "CSE",
    year: 3,
    isAuthenticated: true,
    ...overrides,
  };
}

test("getOpportunities applies ERP branch/year filters and excludes dismissed rows", () => {
  const { store, tempDir } = makeStore();
  try {
    const u = makeUser({ branch: "CSE", year: 3 });
    const insert = store.db.prepare(`
      INSERT INTO career_opportunities (
        id, type, title, company, description, shortDescription, skills, tags,
        source, sourceUrl, applyUrl, scrapedAt, updatedAt,
        eligibleBranches, eligibleYears, deadline, isActive, moderationState
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
    `);

    insert.run(
      "o-ece",
      "job",
      "ECE only role",
      "ACME",
      "desc",
      "desc",
      "[]",
      "[]",
      "manual",
      "https://example.com/ece",
      "https://example.com/ece-apply",
      new Date().toISOString(),
      new Date().toISOString(),
      JSON.stringify(["ECE"]),
      JSON.stringify([2]),
      "2030-12-31T00:00:00.000Z"
    );

    insert.run(
      "o-cse",
      "job",
      "CSE Python role",
      "ACME",
      "Build Python APIs for campus systems",
      "Build Python APIs",
      JSON.stringify(["Python"]),
      "[]",
      "manual",
      "https://example.com/cse",
      "https://example.com/cse-apply",
      new Date().toISOString(),
      new Date().toISOString(),
      JSON.stringify(["CSE"]),
      JSON.stringify([3]),
      "2030-12-31T00:00:00.000Z"
    );

    insert.run(
      "o-all",
      "internship",
      "Open to all",
      "Globex",
      "Everyone",
      "Everyone",
      "[]",
      "[]",
      "manual",
      "https://example.com/all",
      "https://example.com/all-apply",
      new Date().toISOString(),
      new Date().toISOString(),
      "[]",
      "[]",
      "2030-12-31T00:00:00.000Z"
    );

    const listed = store.getOpportunities({ user: u, limit: 20, page: 1 });
    const ids = new Set(listed.map((r) => r.id));
    assert.ok(ids.has("o-cse"));
    assert.ok(ids.has("o-all"));
    assert.ok(!ids.has("o-ece"));

    store.dismissOpportunity("o-all", u.userId);
    const afterDismiss = store.getOpportunities({ user: u, limit: 20, page: 1 });
    assert.ok(!afterDismiss.some((r) => r.id === "o-all"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("FTS search matches opportunity content via rowid-linked index", () => {
  const { store, tempDir } = makeStore();
  try {
    const u = makeUser();
    store.db
      .prepare(
        `
      INSERT INTO career_opportunities (
        id, type, title, company, description, shortDescription, skills, tags,
        source, sourceUrl, applyUrl, scrapedAt, updatedAt,
        eligibleBranches, eligibleYears, deadline, isActive, moderationState
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, 1, 0)
    `
      )
      .run(
        "o-fts",
        "hackathon",
        "TensorFlow sprint",
        "Org",
        "Machine learning competition using tensorflow framework",
        "ML comp",
        JSON.stringify(["TensorFlow"]),
        "[]",
        "manual",
        "https://example.com/fts",
        "https://example.com/fts-apply",
        new Date().toISOString(),
        new Date().toISOString(),
        "2031-01-01T00:00:00.000Z"
      );
    store._rebuildCareerSearchFts();

    const hits = store.getOpportunities({ user: u, query: "tensorflow", limit: 20, page: 1 });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].id, "o-fts");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("getDeadlineSoonBookmarked returns only bookmarked rows inside window", () => {
  const { store, tempDir } = makeStore();
  try {
    const u = makeUser();
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const later = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();

    store.db
      .prepare(
        `
      INSERT INTO career_opportunities (
        id, type, title, company, description, shortDescription, skills, tags,
        source, sourceUrl, applyUrl, scrapedAt, updatedAt,
        eligibleBranches, eligibleYears, deadline, isActive, moderationState
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, 1, 0)
    `
      )
      .run(
        "b-soon",
        "job",
        "Soon",
        "Co",
        "d",
        "d",
        "[]",
        "[]",
        "manual",
        "https://ex.com/1",
        "https://ex.com/a1",
        new Date().toISOString(),
        new Date().toISOString(),
        soon
      );

    store.db
      .prepare(
        `
      INSERT INTO career_opportunities (
        id, type, title, company, description, shortDescription, skills, tags,
        source, sourceUrl, applyUrl, scrapedAt, updatedAt,
        eligibleBranches, eligibleYears, deadline, isActive, moderationState
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, 1, 0)
    `
      )
      .run(
        "b-later",
        "job",
        "Later",
        "Co",
        "d",
        "d",
        "[]",
        "[]",
        "manual",
        "https://ex.com/2",
        "https://ex.com/a2",
        new Date().toISOString(),
        new Date().toISOString(),
        later
      );

    store.bookmarkOpportunity("b-soon", u.userId);
    store.bookmarkOpportunity("b-later", u.userId);

    const rows = store.getDeadlineSoonBookmarked(u, 3);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "b-soon");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("createApplication rejects unknown opportunity ids", () => {
  const { store, tempDir } = makeStore();
  try {
    assert.throws(
      () => store.createApplication("u1", "missing-opp", ""),
      (err) => err.status === 404
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("updateApplicationStatus rejects invalid status values", () => {
  const { store, tempDir } = makeStore();
  try {
    const u = makeUser();
    store.db
      .prepare(
        `
      INSERT INTO career_opportunities (
        id, type, title, company, description, shortDescription, skills, tags,
        source, sourceUrl, applyUrl, scrapedAt, updatedAt,
        eligibleBranches, eligibleYears, deadline, isActive, moderationState
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, 1, 0)
    `
      )
      .run(
        "o1",
        "job",
        "T",
        "C",
        "d",
        "d",
        "[]",
        "[]",
        "manual",
        "https://ex.com/o",
        "https://ex.com/a",
        new Date().toISOString(),
        new Date().toISOString(),
        "2032-01-01T00:00:00.000Z"
      );
    const { id } = store.createApplication(u.userId, "o1", "");
    assert.throws(
      () => store.updateApplicationStatus(id, u.userId, "bogus_status", null),
      (err) => err.status === 400
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("approveSubmission requires pending status", () => {
  const { store, tempDir } = makeStore();
  try {
    const sid = "sub-1";
    store.db
      .prepare(
        `
      INSERT INTO career_submissions (
        id, submittedBy, status, type, title, applyUrl, createdAt
      ) VALUES (?, ?, 'approved', 'job', 'Old', 'https://example.com/old', ?)
    `
      )
      .run(sid, "u1", new Date().toISOString());

    assert.throws(() => store.approveSubmission(sid, null), (err) => err.status === 400);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("getCareerStats returns aggregate counts", () => {
  const { store, tempDir } = makeStore();
  try {
    const stats = store.getCareerStats();
    assert.ok(typeof stats.totalActive === "number");
    assert.ok(Array.isArray(stats.byType));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("resume versions parse skills, score quality, merge to profile, and fit opportunities", () => {
  const { store, tempDir } = makeStore();
  try {
    const user = makeUser({ userId: "resume-student", branch: "CSE", year: 3 });
    store.updateProfile(user, {
      skills: ["React"],
      preferredTypes: ["internship"],
      preferredLocations: ["remote"],
      bio: "Frontend student",
      linkedinUrl: "",
      githubUrl: "",
      portfolioUrl: "",
      minStipend: "",
      cgpa: 8.2,
    });

    store.db
      .prepare(
        `
      INSERT INTO career_opportunities (
        id, type, title, company, description, shortDescription, skills, tags,
        location, mode, source, sourceUrl, applyUrl, scrapedAt, updatedAt,
        eligibleBranches, eligibleYears, deadline, isActive, moderationState
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
    `
      )
      .run(
        "fit-frontend",
        "internship",
        "Frontend Platform Intern",
        "Acme",
        "Build React and Node.js dashboards with SQL APIs",
        "Build dashboards",
        JSON.stringify(["React", "Node.js", "SQL"]),
        JSON.stringify(["frontend"]),
        "Remote",
        "remote",
        "manual",
        "https://example.com/fit",
        "https://example.com/fit/apply",
        new Date().toISOString(),
        new Date().toISOString(),
        JSON.stringify(["CSE"]),
        JSON.stringify([3]),
        "2030-12-31T00:00:00.000Z"
      );

    const resume = store.createResumeVersion(user, {
      fileName: "resume.txt",
      extractedText: `
        Student One
        https://github.com/student/project
        https://linkedin.com/in/student
        Built React dashboards and Node.js APIs for 500 students.
        Implemented SQL reporting project with 20+ features.
      `,
    });

    assert.equal(resume.fileName, "resume.txt");
    assert.ok(resume.parsedJson.skills.includes("React"));
    assert.ok(resume.parsedJson.skills.includes("Node.js"));
    assert.ok(resume.qualityScore > 50);
    assert.ok(resume.analysis.suggestions.length >= 0);

    const fit = store.getOpportunityFit(user, "fit-frontend", { resumeVersionId: resume.id });
    assert.ok(fit.fitScore >= 75);
    assert.deepEqual(fit.matchedSkills.sort(), ["Node.js", "React", "SQL"].sort());
    assert.equal(fit.eligibility.eligible, true);
    assert.equal(fit.resumeVersionId, resume.id);
    assert.ok(fit.reasons.some((reason) => reason.includes("required skill")));

    const merged = store.mergeResumeToProfile(user, resume.id);
    assert.equal(merged.updated, true);
    assert.ok(merged.profile.skills.includes("Node.js"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CareerRelevanceEngine blends skill match and base relevance score", () => {
  const opp = {
    type: "job",
    skills: ["Python", "SQL"],
    eligibleBranches: [],
    eligibleYears: [],
    relevanceScore: 40,
  };
  const userContext = { branch: "CSE", year: 3 };
  const profile = { skills: ["Python"], preferredTypes: [], preferredLocations: [] };
  const score = CareerRelevanceEngine.computePersonalizedScore(opp, userContext, profile);
  assert.ok(score > 40 && score <= 100);
});

test("getOpportunities list performance stays within a modest budget for small datasets", () => {
  const { store, tempDir } = makeStore();
  try {
    const u = makeUser();
    const insert = store.db.prepare(`
      INSERT INTO career_opportunities (
        id, type, title, company, description, shortDescription, skills, tags,
        source, sourceUrl, applyUrl, scrapedAt, updatedAt,
        eligibleBranches, eligibleYears, deadline, isActive, moderationState
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, ?, '[]', '[]', ?, 1, 0)
    `);
    for (let i = 0; i < 80; i += 1) {
      const id = `perf-${i}`;
      insert.run(
        id,
        "internship",
        `Title ${i}`,
        "Co",
        "Body",
        "Body",
        "[]",
        "[]",
        `https://ex.com/s${i}`,
        `https://ex.com/a${i}`,
        new Date().toISOString(),
        new Date().toISOString(),
        "2035-01-01T00:00:00.000Z"
      );
    }
    store._rebuildCareerSearchFts();
    const t0 = Date.now();
    for (let i = 0; i < 40; i += 1) {
      store.getOpportunities({ user: u, limit: 20, page: (i % 4) + 1, query: i % 2 === 0 ? "Title" : "" });
    }
    const ms = Date.now() - t0;
    assert.ok(ms < 2000, `expected <2s for 40 filtered pages, got ${ms}ms`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
