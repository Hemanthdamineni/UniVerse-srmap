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
      extractedText: [
        "Student One",
        "student@example.com | GH: studentone | LN: in/student-one",
        "",
        "Education",
        "SRM University AP — B.Tech CSE, 2023–2027, GPA 9.1/10",
        "",
        "Work Experience",
        "Frontend Engineering Intern | Acme Corp | Jun 2025 – Aug 2025",
        "• Built React and TypeScript dashboards used by 500 students.",
        "• Cut API latency from 300ms to 90ms with query batching.",
        "Data Intern | Globex | May 2024 – Jul 2024",
        "• Shipped 4 reporting pipelines with PostgreSQL and Python.",
        "",
        "Projects",
        "Campus Planner | Node.js + SQL scheduling tool   GitHub",
        "• Implemented recurring-event logic and a REST API with 20+ endpoints.",
        "Notes App | Offline-first PWA   GitHub",
        "• Built with React, IndexedDB, and a service worker.",
        "",
        "Technical Skills",
        "Languages Python, JavaScript, TypeScript, SQL, C/C++",
        "Web & Systems React, Node.js, Express.js, PostgreSQL, Redis, Docker, Git",
        "",
        "Certifications",
        "• Certification: AWS Certified Cloud Practitioner",
      ].join("\n"),
    });

    assert.equal(resume.fileName, "resume.txt");
    const pj = resume.parsedJson;
    assert.equal(pj.name, "Student One");
    assert.equal(pj.email, "student@example.com");
    assert.ok(pj.skills.includes("React") && pj.skills.includes("Node.js") && pj.skills.includes("TypeScript"));
    assert.ok(pj.skills.length >= 8);
    assert.equal(pj.education.length, 1);
    assert.match(pj.education[0].degree, /B\.?\s?Tech/i);
    assert.equal(pj.education[0].gpa, "9.1");
    assert.equal(pj.projects.length, 2);
    assert.equal(pj.projects[0].title, "Campus Planner");
    assert.equal(pj.experience.length, 2);
    assert.equal(pj.experience[0].org, "Acme Corp");
    assert.ok(pj.experience[0].bulletCount >= 2);
    assert.equal(pj.certifications.length, 1);
    assert.ok(pj.sections.includes("skills") && pj.sections.includes("projects"));
    assert.equal(pj.hasGithub, true);
    assert.equal(pj.hasLinkedin, true);
    assert.ok(resume.qualityScore >= 70 && resume.qualityScore <= 100);
    assert.ok(Array.isArray(resume.analysis.suggestions));
    resume.analysis.suggestions.forEach((s) => {
      assert.ok(typeof s.tip === "string" && ["high", "medium"].includes(s.priority));
    });

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

test("alumni: FE field names map to storage, requested flips after a connection request", () => {
  const { store, tempDir } = makeStore();
  try {
    const admin = makeUser({ userId: "alum-admin", role: "admin" });
    const student = makeUser({ userId: "student-9" });

    const created = store.createAlumni(
      {
        name: "Ananya Rao",
        email: "ananya@demo.alumni",
        batch: "2021",
        degree: "B.Tech Computer Science and Engineering",
        role: "Software Engineer",
        location: "Bengaluru",
        expertise: ["aws", "node.js", "AWS"],
        openToConnect: true,
      },
      admin,
    );

    // Stored under DB names, echoed under both.
    assert.equal(created.branch, "B.Tech Computer Science and Engineering");
    assert.equal(created.degree, created.branch);
    assert.equal(created.position, "Software Engineer");
    assert.equal(created.role, created.position);
    assert.deepEqual(created.expertise, ["AWS", "Node.js"]); // canonical + de-duped
    assert.deepEqual(created.skills, created.expertise);
    assert.equal(created.openToConnect, true);
    assert.equal(created.isAvailableForMentoring, true);
    assert.equal(created.requested, false);

    let listed = store.listAlumni({ user: student, query: "node" }); // matches on skills
    assert.equal(listed.length, 1);
    assert.equal(listed[0].requested, false);

    store.requestAlumniConnection(created.id, { message: "Hi" }, student);
    // Idempotent — a second request does not error or duplicate.
    store.requestAlumniConnection(created.id, { message: "Hi again" }, student);

    listed = store.listAlumni({ user: student });
    assert.equal(listed[0].requested, true);
    assert.equal(store.listSentAlumniRequests(student).length, 1);

    assert.throws(() => store.requestAlumniConnection("missing-id", {}, student), { status: 404 });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("alumni: student nomination approval publishes a directory entry with all contact fields", () => {
  const { store, tempDir } = makeStore();
  try {
    const admin = makeUser({ userId: "alum-admin-2", role: "admin" });
    const student = makeUser({ userId: "student-nominator" });

    const nomination = store.nominateAlumnus(
      {
        name: "Priya Menon",
        email: "priya@demo.alumni",
        batch: "2019",
        degree: "M.Tech Data Science",
        company: "Globex",
        role: "ML Engineer",
        location: "Hyderabad",
        linkedinUrl: "https://linkedin.com/in/priya",
        instagramUrl: "https://instagram.com/priya",
        portfolioUrl: "https://priya.dev",
        expertise: ["pytorch", "aws"],
        relation: "Mentored me in a hackathon",
      },
      student,
    );
    assert.equal(nomination.status, "pending");
    assert.equal(nomination.submitterName, "Test Student");

    let mine = store.listMyAlumniNominations(student);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].status, "pending");

    const pending = store.getPendingAlumniNominations();
    assert.equal(pending.length, 1);

    // Reviewer must give a reason, same as opportunity-submission review.
    assert.throws(() => store.reviewAlumniNomination(nomination.id, { decision: "approve" }, admin), {
      status: 400,
    });
    // The submitter cannot review their own nomination.
    assert.throws(
      () => store.reviewAlumniNomination(nomination.id, { decision: "approve", reason: "ok looks good" }, student),
      { status: 403 },
    );

    const reviewed = store.reviewAlumniNomination(
      nomination.id,
      { decision: "approve", reason: "Verified via LinkedIn" },
      admin,
    );
    assert.equal(reviewed.status, "approved");
    assert.ok(reviewed.publishedAlumniId);

    const directory = store.listAlumni({ user: student });
    const published = directory.find((a) => a.id === reviewed.publishedAlumniId);
    assert.ok(published, "approved nomination should appear in the live directory");
    assert.equal(published.name, "Priya Menon");
    assert.equal(published.linkedinUrl, "https://linkedin.com/in/priya");
    assert.equal(published.instagramUrl, "https://instagram.com/priya");
    assert.equal(published.portfolioUrl, "https://priya.dev");
    assert.deepEqual(published.expertise, ["PyTorch", "AWS"]);

    // A reviewed nomination cannot be reviewed again.
    assert.throws(
      () => store.reviewAlumniNomination(nomination.id, { decision: "reject", reason: "changed my mind" }, admin),
      { status: 400 },
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("alumni: nomination rejection requires a reason and never touches the directory", () => {
  const { store, tempDir } = makeStore();
  try {
    const admin = makeUser({ userId: "alum-admin-3", role: "admin" });
    const student = makeUser({ userId: "student-nominator-2" });

    const nomination = store.nominateAlumnus(
      { name: "Rahul Iyer", email: "rahul@demo.alumni", batch: "2018" },
      student,
    );

    assert.throws(() => store.reviewAlumniNomination(nomination.id, { decision: "reject" }, admin), {
      status: 400,
    });

    const reviewed = store.reviewAlumniNomination(
      nomination.id,
      { decision: "reject", reason: "Could not verify identity" },
      admin,
    );
    assert.equal(reviewed.status, "rejected");
    assert.equal(reviewed.publishedAlumniId, null);
    assert.equal(store.listAlumni({ user: student }).length, 0);

    const mine = store.listMyAlumniNominations(student);
    assert.equal(mine[0].reviewReason, "Could not verify identity");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("alumni: nomination requires an email or LinkedIn URL to identify the alumnus", () => {
  const { store, tempDir } = makeStore();
  try {
    const student = makeUser({ userId: "student-nominator-3" });
    assert.throws(() => store.nominateAlumnus({ name: "No Contact" }, student), { status: 400 });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("alumni: admin can accept/decline a connection request and the requester sees the outcome", () => {
  const { store, tempDir } = makeStore();
  try {
    const admin = makeUser({ userId: "alum-admin-4", role: "admin" });
    const student = makeUser({ userId: "student-requester", name: "Asha Rao" });

    const alumnus = store.createAlumni(
      { name: "Vikram Shah", batch: "2017", degree: "B.Tech ECE", company: "Initech", role: "SRE", openToConnect: true },
      admin,
    );

    store.requestAlumniConnection(alumnus.id, { message: "Would love to connect" }, student);

    const pendingRequests = store.getPendingAlumniConnectionRequests();
    assert.equal(pendingRequests.length, 1);
    assert.equal(pendingRequests[0].requesterName, "Asha Rao");
    assert.equal(pendingRequests[0].alumniName, "Vikram Shah");

    assert.throws(
      () => store.reviewAlumniConnectionRequest(pendingRequests[0].id, { decision: "bogus" }, admin),
      { status: 400 },
    );

    const reviewed = store.reviewAlumniConnectionRequest(
      pendingRequests[0].id,
      { decision: "accept", note: "Introduced over email" },
      admin,
    );
    assert.equal(reviewed.status, "accepted");
    assert.equal(reviewed.reviewedBy, "alum-admin-4");

    const sent = store.listSentAlumniRequests(student);
    assert.equal(sent[0].status, "accepted");

    // Already-reviewed requests cannot be reviewed again.
    assert.throws(
      () => store.reviewAlumniConnectionRequest(pendingRequests[0].id, { decision: "decline" }, admin),
      { status: 400 },
    );
    assert.equal(store.getPendingAlumniConnectionRequests().length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("deleteResumeVersion removes a version and repoints the profile résumé", () => {
  const { store, tempDir } = makeStore();
  try {
    const user = makeUser({ userId: "resume-del" });
    const first = store.createResumeVersion(user, {
      fileName: "old.txt",
      extractedText: "Built React and Node.js dashboards used by 500 students. SQL Python AWS Docker Git.",
    });
    const second = store.createResumeVersion(user, {
      fileName: "new.txt",
      extractedText: "Shipped TypeScript and Kubernetes platform. React Node.js AWS Terraform CI/CD Git.",
    });

    assert.equal(store.listResumeVersions(user).length, 2);
    assert.equal(store.getProfile(user).resumeFileName, "new.txt");

    // Delete the current (newest) — profile falls back to the older one.
    let res = store.deleteResumeVersion(user, second.id);
    assert.equal(res.deleted, true);
    assert.equal(res.latest.id, first.id);
    assert.equal(store.listResumeVersions(user).length, 1);
    assert.equal(store.getProfile(user).resumeFileName, "old.txt");

    // Delete the last one — profile résumé is cleared.
    res = store.deleteResumeVersion(user, first.id);
    assert.equal(res.latest, null);
    assert.equal(store.listResumeVersions(user).length, 0);
    assert.equal(store.getProfile(user).resumeFileName, "");

    assert.throws(() => store.deleteResumeVersion(user, "nope"), { status: 404 });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("résumé analysis surfaces a career-fit skill-gap suggestion", () => {
  const { store, tempDir } = makeStore();
  try {
    const user = makeUser({ userId: "cf-student" });
    store.updateProfile(user, {
      skills: ["Python", "React"],
      preferredTypes: ["Internship"],
      preferredLocations: [],
      bio: "",
      linkedinUrl: "",
      githubUrl: "",
      portfolioUrl: "",
      minStipend: "",
      cgpa: 8,
    });
    // Active opportunity needs Kubernetes + Go — neither on the profile nor the résumé.
    store.db
      .prepare(
        `INSERT INTO career_opportunities (id,type,title,company,description,shortDescription,skills,tags,source,sourceUrl,applyUrl,scrapedAt,updatedAt,isActive,moderationState)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,0)`,
      )
      .run(
        "cf-opp", "internship", "Platform Intern", "Acme", "x", "x",
        JSON.stringify(["Kubernetes", "Go", "React"]), "[]", "manual", "u", "u",
        new Date().toISOString(), new Date().toISOString(),
      );
    store._recomputeSkillGaps(user.userId, ["Python", "React"]);

    const resume = store.createResumeVersion(user, {
      fileName: "r.txt",
      extractedText: [
        "Sam Lee",
        "sam@example.com",
        "Skills",
        "Python, React, Flask, PostgreSQL",
        "Experience",
        "Intern | Foo | Jan 2024 – Jun 2024",
        "• Built a Flask API.",
      ].join("\n"),
    });

    const gapTip = resume.analysis.suggestions.find((s) => s.category === "career-fit" && /missing/i.test(s.tip));
    assert.ok(gapTip, "expected a skill-gap suggestion");
    assert.match(gapTip.tip, /Kubernetes|Go/);
    assert.equal(gapTip.priority, "high");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
