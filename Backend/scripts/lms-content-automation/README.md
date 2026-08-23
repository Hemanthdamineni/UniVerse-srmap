# LMS Content Automation Pipeline

End-to-end workflow for populating the Learning Management System (LMS) with structured, high-quality CSE educational resources. Follows a strict **Plan → Generate → Verify → Critique** pipeline with full audit trail.

## Quick Start

```bash
# Full pipeline (plan + generate + verify + critique)
./Backend/scripts/lms-content-automation/run-pipeline.sh

# Verify existing content
./Backend/scripts/lms-content-automation/run-pipeline.sh --verify-only

# Run critique/gap analysis
./Backend/scripts/lms-content-automation/run-pipeline.sh --critique-only
```

## Architecture

```
scripts/lms-content-automation/
├── contentCurriculum.js    # Planning: curriculum definition (subjects, units, topics)
├── generate.js             # Writing: content generation engine
├── verify.js               # QA: multi-layered verification checks
├── critique.js             # Refinement: gap analysis & recommendations
├── run-pipeline.sh         # Orchestrator: sequential pipeline executor
├── cleanup.js              # Utility: remove demo data & duplicates
└── README.md               # This file
```

Output artifacts (auto-generated):
```
├── content-report-<timestamp>.json      # Generation audit report
├── content-report-latest.json           # Stable report copy
├── content-critique-<timestamp>.json    # Critique/gap analysis
├── content-critique-latest.json         # Stable critique copy
├── verify-report-<timestamp>.json       # Verification results
└── pipeline-<timestamp>.log             # Full pipeline log
```

## Pipeline Phases

### Phase 0: Planning (`contentCurriculum.js`)

The curriculum definition is the single source of truth. It defines:

| Subject | Code | Units | Topics |
|---------|------|-------|--------|
| Design & Analysis of Algorithms | CSE302 | 5 | 24 |
| Operating Systems | CSE304 | 5 | 29 |
| Database Management Systems | CSE306 | 5 | 27 |
| Computer Networks | CSE308 | 5 | 35 |
| Software Engineering | CSE310 | 5 | 28 |
| Machine Learning Fundamentals | CSE312 | 5 | 25 |
| Theory of Computation | CSE314 | 5 | 25 |
| Compiler Design | CSE316 | 5 | 26 |

**Skill Roadmaps** (5 defined):
- Full-Stack Web Development (10 stages)
- Data Science & Machine Learning (9 stages)
- Cloud & DevOps Engineering (10 stages)
- Mobile App Development (React Native) (7 stages)
- Cybersecurity & Ethical Hacking (7 stages)

### Phase 1: Generate (`generate.js`)

Generates content directly into the LMS SQLite database:

| Resource Type | Generation Strategy |
|--------------|---------------------|
| **Note** | Structured markdown with overview, concepts, examples, pitfalls, review questions |
| **Quiz** | 4-option MCQ questions with correct answer indices |
| **Flashcard** | Front/back question-answer pairs for rapid revision |
| **PYQ** | Previous year exam questions with year, type, marks |
| **Link** | Curated external resource references |

**Guide generation**: One comprehensive study guide per unit with sections for each topic, intro, learning objectives, and exam prep.

**Roadmap generation**: Skill-based learning paths with prerequisite-linked node chains.

**Question bank**: Subject-specific MCQs across easy/medium/hard difficulty levels.

### Phase 2: Verify (`verify.js`)

39 automated checks across these categories:

| Category | Checks | What We Verify |
|----------|--------|----------------|
| Schema | 9 | All required tables exist |
| Resources | 3 | Active count, type validity, required fields |
| Coverage | 16 | Per-subject resource count + type diversity |
| Guides | 3 | Count, sections, publication status |
| Roadmaps | 2 | Count, node completeness |
| Questions | 3 | Count, difficulty diversity, option validity |
| Topics | 2 | Count, resource-topic links |
| Quality | 1 | Content presence in resources |

### Phase 3: Critique (`critique.js`)

Evaluates content against pedagogical and quality criteria:

- **Coverage Analysis**: Per-unit completeness scoring
- **Quality Signals**: Content depth, type distribution, subject balance
- **Accessibility Check**: Screen-reader compatibility signals
- **Recommendations**: Prioritized gap remediation plan

## Content Generation Details

### Resource Naming Convention

```
<SubjectName> — <Unit>: <Topic> (<TYPE>)
```
Example: `Operating Systems — Unit 2: Semaphores — counting vs binary, wait/signal, classic problems (NOTE)`

### Note Content Structure

Each generated note contains:
1. Topic heading and overview
2. Key concepts with definitions
3. Core principles (modularity, abstraction, efficiency, scalability)
4. Practical applications with real-world use cases
5. Detailed explanation with theoretical foundations
6. Code examples and pseudocode
7. Common pitfalls and review questions
8. Summary

### Guide Structure

Each guide contains:
1. Introduction with learning objectives
2. One section per topic with detailed breakdown
3. Summary with key takeaways
4. Practice questions (conceptual, analytical, application, design, critical thinking)
5. Exam preparation tips

## Verification Checklist

Before running the pipeline, ensure:

- [ ] Node.js >= v22 (for `node:sqlite`)
- [ ] LMS database exists at `Backend/data/lms.sqlite`
- [ ] Backend server is NOT writing to DB during generation (WAL mode supports concurrent reads)
- [ ] Sufficient disk space (generates ~10MB of text content)

## Customization

### Adding a new subject

1. Add to `CORE_CSE_SUBJECTS` array in `contentCurriculum.js`:
   ```js
   {
     subjectCode: "CSE3XX",
     subjectName: "New Subject Name",
     semester: "VI",
     description: "...",
     totalUnits: 5,
     units: [
       { unit: "Unit 1", title: "...", topics: ["..."], resourceMix: { note: 3, quiz: 2, flashcard: 1, pyq: 1 }, description: "..." },
     ],
     examPatterns: [...],
     tags: ["..."],
   }
   ```
2. Add subject-specific questions to the `subjectQuestions` map in `generate.js`
3. Re-run pipeline

### Adding a new resource type

1. Add type to `RESOURCE_TYPES` in `generate.js`
2. Create a content generator function (e.g., `generateVideoContent()`)
3. Add type to `unit.resourceMix` in curriculum definition
4. Add the type to `determineEstimatedMinutes()`

## Output Artifacts

### content-report-latest.json (after generation)
```json
{
  "summary": {
    "resources": 318,
    "guides": 41,
    "roadmaps": 6,
    "questions": 364,
    "topics": 231
  },
  "stats": {
    "resourcesCreated": 318,
    "guidesCreated": 41,
    "questionsCreated": 91,
    "errors": [],
    "warnings": []
  }
}
```

### verify-report-latest.json (after verification)
```json
{
  "summary": {
    "passed": 39,
    "failed": 0,
    "warnings": 0
  },
  "checks": [...]
}
```

### critique-report-latest.json (after critique)
```json
{
  "overallCompleteness": 83,
  "subjectCoverage": [...],
  "recommendations": [...]
}
```

## Post-Launch Monitoring

After deployment, track these metrics for iterative improvement:

| Metric | Source | Frequency |
|--------|--------|-----------|
| Resources viewed per subject | LMS analytics | Weekly |
| Quiz attempt completion rate | `lms_quiz_attempts` | Weekly |
| Exam feedback scores | `lms_exam_feedback` | Per exam cycle |
| Student resource requests | `lms_requests` | Weekly |
| Guide read progress | `lms_guide_progress` | Monthly |
| Question difficulty calibration | `lms_question_bank` usage | Semester |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "column index out of range" | SQL parameter mismatch | Count `?` vs `run()` args |
| "Cannot find module" | Wrong working directory | Run from project root `cd University-ERP` |
| Database locked | Backend server is writing | Stop server or use WAL mode |
| Resources created: 0 | Resource type keys mismatch | Check plural/singular forms |
| Verification fails on type diversity | Missing resource type | Add type to `resourceMix` or adjust check threshold |
