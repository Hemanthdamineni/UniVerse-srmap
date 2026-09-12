const test = require("node:test");
const assert = require("node:assert/strict");

const { parseResume, repairLineWraps } = require("../src/services/career/resumeParse");

const STRUCTURED = [
  "Priya Sharma",
  "priya.sharma@example.com | +91 98765 43210 | github.com/priyash | linkedin.com/in/priya-sharma",
  "",
  "Summary",
  "Final-year computer science student focused on backend systems and applied machine learning,",
  "with two internships shipping production services.",
  "",
  "Education",
  "SRM University AP — B.Tech in Computer Science and Engineering",
  "2022 – 2026 | CGPA: 9.1/10",
  "",
  "Work Experience",
  "Backend Engineering Intern | Acme Corp | Jun 2025 – Aug 2025",
  "• Built a Node.js and PostgreSQL billing service handling 2,000 requests per minute.",
  "• Cut p95 latency from 400ms to 90ms with query batching and Redis caching.",
  "• Wrote the CI pipeline in GitHub Actions, dropping release time by 60 percent.",
  "Data Intern | Globex | May 2024 – Jul 2024",
  "• Shipped 4 reporting dashboards with Python, Pandas and Metabase.",
  "",
  "Projects",
  "Campus Planner | Node.js + SQL scheduling tool | github.com/priyash/planner",
  "• Implemented recurring-event logic and a REST API with 20+ endpoints.",
  "• Wrote 120 unit tests with Jest, reaching 90% coverage.",
  "Notes PWA | Offline-first note app",
  "• Built with React, IndexedDB and a service worker.",
  "",
  "Technical Skills",
  "Languages: Python, JavaScript, TypeScript, SQL, C/C++",
  "Backend: Node.js, Express.js, PostgreSQL, Redis, Docker | Cloud: AWS, GCP",
  "ML: PyTorch, scikit-learn, Pandas | Tools: Git, GitHub Actions, Kubernetes",
  "",
  "Certifications",
  "• Certification: AWS Certified Cloud Practitioner",
].join("\n");

test("parses a well-structured résumé into full structured output", () => {
  const p = parseResume(STRUCTURED);

  assert.equal(p.name, "Priya Sharma");
  assert.equal(p.email, "priya.sharma@example.com");
  assert.match(p.phone, /98765/);
  assert.match(p.headline, /backend systems/);

  assert.equal(p.education.length, 1);
  assert.match(p.education[0].degree, /B\.Tech/);
  assert.match(p.education[0].institution, /SRM University/);
  assert.equal(p.education[0].year, "2026");
  assert.equal(p.education[0].gpa, "9.1");

  assert.equal(p.experience.length, 2);
  assert.equal(p.experience[0].title, "Backend Engineering Intern");
  assert.equal(p.experience[0].org, "Acme Corp");
  assert.match(p.experience[0].dateRange, /Jun 2025/);
  assert.ok(p.experience[0].bulletCount >= 3);

  assert.equal(p.projects.length, 2);
  assert.equal(p.projects[0].title, "Campus Planner");
  assert.ok(p.projects[1].bulletCount >= 1);

  for (const s of ["Python", "TypeScript", "Node.js", "PostgreSQL", "Redis", "Docker", "AWS", "Kubernetes", "PyTorch", "scikit-learn"]) {
    assert.ok(p.skills.includes(s), `missing skill ${s}`);
  }
  assert.ok(!p.skills.some((s) => /:/.test(s)), "no label leaked into skills");

  assert.deepEqual(p.certifications, ["AWS Certified Cloud Practitioner"]);
  assert.equal(p.hasGithub, true);
  assert.equal(p.hasLinkedin, true);
  assert.ok(p.sections.includes("skills") && p.sections.includes("experience"));
  assert.equal(p.layoutWarning, "");
});

test("heading-less résumé still yields skills and experience via the fallback", () => {
  const text = [
    "Rahul Verma  rahul@example.com  +91 91234 56789",
    "",
    "Python, Java, Spring Boot, MySQL, Docker, Kubernetes, AWS, Kafka, Redis, React",
    "",
    "Software Engineer, Initech   Jan 2023 – Present",
    "- Designed a microservices platform handling 10,000 requests per second.",
    "- Migrated the monolith to Kubernetes, cutting infra cost by 30 percent.",
    "Backend Intern, Umbrella   May 2022 – Aug 2022",
    "- Built REST APIs in Spring Boot backed by MySQL.",
  ].join("\n");
  const p = parseResume(text);
  assert.ok(p.skills.includes("Python") && p.skills.includes("Kubernetes") && p.skills.includes("Kafka"));
  assert.ok(p.experience.length >= 1);
});

test("an essay / non-résumé scores structurally empty, not garbage", () => {
  const text = [
    "Tell Me About Yourself",
    "Hi, I am a final-year student who loves building things. I spent last summer learning about",
    "distributed systems and I enjoy mentoring juniors. My goal is to work on developer tools.",
    "I studied at a university and worked on a few side projects during my degree.",
  ].join("\n");
  const p = parseResume(text);
  assert.equal(p.education.length, 0);
  assert.equal(p.experience.length, 0);
  assert.equal(p.projects.length, 0);
});

test("repairLineWraps joins an obvious continuation", () => {
  const out = repairLineWraps(["Google Summer of", "Code — The Linux Foundation", "Next Section"]);
  assert.equal(out[0], "Google Summer of Code — The Linux Foundation");
  assert.equal(out[1], "Next Section");
});
