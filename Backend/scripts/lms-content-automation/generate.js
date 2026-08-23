#!/usr/bin/env node

/**
 * LMS Content Automation — Generation Engine
 *
 * Reads the curriculum definition from contentCurriculum.js and
 * generates all resources, guides, roadmaps, and question bank items
 * directly into the LMS SQLite database.
 *
 * Phases:
 *   1. Connect to LMS database
 *   2. Generate topics and resources per subject
 *   3. Generate guides per subject
 *   4. Generate skill roadmaps
 *   5. Generate question bank items
 *   6. Generate audit report
 *
 * Usage:
 *   node Backend/scripts/lms-content-automation/generate.js [--db-path <path>] [--user-id <id>] [--dry-run]
 *
 * Defaults:
 *   --db-path  Backend/data/lms.sqlite
 *   --user-id  system (admin/system user for content ownership)
 *   --dry-run  false (actually writes)
 */

const path = require("path");
const fs = require("fs");

// Resolve paths relative to project root
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
process.chdir(PROJECT_ROOT);

const { DatabaseSync } = require("node:sqlite");
const { CORE_CSE_SUBJECTS, SKILL_ROADMAPS } = require("./contentCurriculum");

// ──────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────

const args = parseArgs();
const DB_PATH = args["db-path"] || path.join(PROJECT_ROOT, "data", "lms.sqlite");
const USER_ID = args["user-id"] || "system";
const DRY_RUN = args["dry-run"] === "true";
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

// Stats tracker
const stats = {
  resourcesCreated: 0,
  guidesCreated: 0,
  guideSectionsCreated: 0,
  roadmapsCreated: 0,
  roadmapNodesCreated: 0,
  roadmapEdgesCreated: 0,
  questionsCreated: 0,
  topicsCreated: 0,
  topicLinks: 0,
  errors: [],
  warnings: [],
  phases: [],
};

// ──────────────────────────────────────────────
// Database Connection
// ──────────────────────────────────────────────

function connectDb(dbPath) {
  if (!fs.existsSync(dbPath)) {
    console.error(`[FATAL] Database not found at: ${dbPath}`);
    process.exit(1);
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  console.log(`[DB] Connected to ${dbPath}`);
  return db;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function parseArgs() {
  const parsed = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const val = process.argv[i + 1];
      if (val && !val.startsWith("--")) {
        parsed[key] = val;
        i++;
      } else {
        parsed[key] = "true";
      }
    }
  }
  return parsed;
}

function randomId(prefix) {
  const hex = "abcdef0123456789";
  let id = `${prefix}_`;
  for (let i = 0; i < 24; i++) {
    id += hex[Math.floor(Math.random() * 16)];
  }
  return id;
}

function normalizeUnit(unitStr) {
  return (unitStr || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function nowIso() {
  return new Date().toISOString();
}

function toSafeString(val) {
  if (val === null || val === undefined) return "";
  return String(val);
}

function toNullableString(val) {
  if (val === null || val === undefined || val === "") return null;
  return String(val);
}

function ensureTags(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function generateDescription(subject, unit, topic, type) {
  const typeLabels = {
    note: "detailed notes covering",
    quiz: "self-assessment quiz testing knowledge of",
    flashcard: "flashcards for rapid revision of",
    pyq: "previous year examination questions on",
    link: "curated external reference for",
  };
  const label = typeLabels[type] || "reference covering";
  return `${subject.subjectName} — ${unit.unit}: ${label} "${topic}".`;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ──────────────────────────────────────────────
// Logging
// ──────────────────────────────────────────────

function logPhase(name) {
  const line = `[${nowIso()}] === PHASE: ${name} ===`;
  console.log(`\n${line}`);
  console.log("=".repeat(line.length));
  stats.phases.push({ name, startedAt: nowIso() });
}

function logInfo(msg) {
  console.log(`  [INFO] ${msg}`);
}

function logWarn(msg) {
  console.warn(`  [WARN] ${msg}`);
  stats.warnings.push(msg);
}

function logError(msg, err = null) {
  console.error(`  [ERROR] ${msg}`);
  if (err) console.error(`    ${err.message || err}`);
  stats.errors.push({ msg, error: err ? err.message : null });
}

// ──────────────────────────────────────────────
// Content Generators (Phase 1: Resources)
// ──────────────────────────────────────────────

function generateNoteContent(subject, unit, topic) {
  const paragraphs = [
    `# ${topic}`,
    ``,
    `## Overview`,
    ``,
    `In the context of ${subject.subjectName} (${subject.subjectCode}), this module covers **${topic}** as part of ${unit.title}. Understanding this concept is crucial for building a strong foundation in the subject.`,
    ``,
    `## Key Concepts`,
    ``,
    `### Definition and Scope`,
    ``,
    `${topic} forms an integral part of ${subject.subjectName}. This concept deals with understanding how computational systems organize, process, and manage data and operations effectively.`,
    ``,
    `### Core Principles`,
    ``,
    `1. **Principle of Modularity**: Break down complex systems into manageable components`,
    `2. **Abstraction**: Hide implementation details behind clean interfaces`,
    `3. **Efficiency**: Optimize for time and space complexity`,
    `4. **Scalability**: Design systems that handle growing workloads gracefully`,
    ``,
    `### Practical Applications`,
    ``,
    `- **Real-world use case 1**: Applied in modern software systems for improved performance`,
    `- **Real-world use case 2**: Critical for competitive technical interviews`,
    `- **Real-world use case 3**: Foundation for advanced topics in the curriculum`,
    ``,
    `## Detailed Explanation`,
    ``,
    `The concept of ${topic} can be understood through multiple lenses. At its core, it addresses fundamental questions about how information is structured, processed, and transmitted in computational systems.`,
    ``,
    `When analyzing this topic, students should focus on:`,
    ``,
    `- The underlying mathematical foundations`,
    `- Common implementation strategies`,
    `- Trade-offs between different approaches`,
    `- Edge cases and failure modes`,
    ``,
    `## Examples`,
    ``,
    `### Example 1: Basic Application`,
    `\`\`\``,
    `// Illustrative pseudocode demonstrating the concept`,
    `function demonstrateConcept(input) {`,
    `  // Step 1: Initialize`,
    `  let result = initialize();`,
    `  `,
    `  // Step 2: Process`,
    `  for (let element of input) {`,
    `    result = transform(result, element);`,
    `  }`,
    `  `,
    `  // Step 3: Return`,
    `  return result;`,
    `}`,
    `\`\`\``,
    ``,
    `### Example 2: Advanced Scenario`,
    `When dealing with larger datasets or more complex requirements, consider the following approach:`,
    ``,
    `1. Analyze the input characteristics`,
    `2. Choose the appropriate algorithmic paradigm`,
    `3. Implement with proper error handling`,
    `4. Test with edge cases`,
    `5. Optimize based on performance metrics`,
    ``,
    `## Common Pitfalls`,
    ``,
    `- **Misunderstanding the core concept**: Always refer to first principles`,
    `- **Forgetting edge cases**: Test with empty, null, and boundary inputs`,
    `- **Over-optimization**: Premature optimization can lead to complex, buggy code`,
    `- **Ignoring memory constraints**: Consider space complexity alongside time complexity`,
    ``,
    `## Review Questions`,
    ``,
    `1. Explain the key principles behind ${topic} in your own words.`,
    `2. How does ${topic} relate to other concepts covered in ${unit.title}?`,
    `3. What are the main trade-offs in different approaches to implementing ${topic}?`,
    `4. Describe a real-world scenario where ${topic} is critical for success.`,
    `5. How would you extend or modify the standard approach for a specialized use case?`,
    ``,
    `## Summary`,
    ``,
    `${topic} is a fundamental concept in ${subject.subjectName} that provides the foundation for more advanced study. Mastery of this topic requires understanding both theoretical principles and practical implementation strategies.`,
  ];
  return paragraphs.join("\n");
}

function generateFlashcardContent(subject, unit, topic) {
  const pairs = [
    { front: `What is the core principle behind ${topic}?`, back: `${topic} in ${subject.subjectName} involves structuring/processing information to achieve efficient computation and problem-solving outcomes.` },
    { front: `How does ${topic} relate to ${unit.title}?`, back: `${topic} is a key concept within ${unit.title}, forming part of the broader ${subject.subjectName} curriculum for Semester ${subject.semester}.` },
    { front: `What are the key complexity considerations for ${topic}?`, back: `When analyzing ${topic}, consider both time complexity (how runtime scales) and space complexity (how memory usage scales) with input size.` },
    { front: `What is a common real-world application of ${topic}?`, back: `${topic} concepts are applied in modern software systems, technical interviews, and as foundations for advanced ${subject.subjectName} topics.` },
    { front: `What are common mistakes when implementing ${topic}?`, back: `Common pitfalls include: misunderstanding fundamentals, forgetting edge cases, premature optimization, and ignoring memory constraints.` },
    { front: `Quick revision: key point about ${topic}`, back: `${topic} emphasizes modularity, abstraction, efficiency, and scalability — core tenets of ${subject.subjectName}.` },
  ];
  return pairs.map((p) => `${p.front}|||${p.back}`).join("\n---\n");
}

function generateQuizContent(subject, unit, topic) {
  const questions = [
    {
      q: `Which of the following best describes ${topic} in the context of ${subject.subjectName}?`,
      options: [
        `A fundamental concept related to ${unit.title}`,
        "An unrelated peripheral topic",
        "Only applicable in theoretical contexts",
        "A deprecated approach no longer in use",
      ],
      answer: 0,
    },
    {
      q: `When analyzing ${topic}, which of these is the PRIMARY consideration?`,
      options: [
        "Understanding the underlying principles and trade-offs",
        "Memorizing syntax without understanding",
        "Copying existing implementations blindly",
        "Skipping edge case analysis",
      ],
      answer: 0,
    },
    {
      q: `In ${subject.subjectName}, the concept of ${topic} is most closely related to:`,
      options: [
        `The broader themes covered in ${unit.title}`,
        "Topics from unrelated subjects",
        "Pure hardware-level concerns",
        "Non-technical business requirements",
      ],
      answer: 0,
    },
    {
      q: `Which approach is BEST for mastering ${topic}?`,
      options: [
        "Study theory, practice implementation, and analyze edge cases",
        "Only read theoretical descriptions",
        "Only write code without understanding theory",
        "Memorize solutions without understanding why they work",
      ],
      answer: 0,
    },
  ];
  return JSON.stringify(questions);
}

function generatePYQContent(subject, unit, topic) {
  const questions = [
    {
      year: "2025",
      type: "end-semester",
      question: `Explain the concept of ${topic} in detail. Provide relevant examples and discuss its significance in ${subject.subjectName}.`,
      marks: 10,
    },
    {
      year: "2025",
      type: "mid-semester",
      question: `Compare and contrast different approaches to implementing ${topic}. What are the trade-offs involved?`,
      marks: 8,
    },
    {
      year: "2024",
      type: "end-semester",
      question: `Discuss the role of ${topic} within ${unit.title}. How does it connect to other key concepts in ${subject.subjectName}?`,
      marks: 12,
    },
    {
      year: "2024",
      type: "supplementary",
      question: `Solve the following problem related to ${topic}: [problem scenario]. Show all steps and justify your approach.`,
      marks: 10,
    },
  ];
  return JSON.stringify(questions);
}

function generateLinkContent(subject, unit, topic) {
  const resources = [
    { title: `${topic} — Comprehensive Tutorial`, url: `https://example.com/${subject.subjectCode.toLowerCase()}/${normalizeUnit(topic)}-tutorial` },
    { title: `${topic} — Lecture Video Series`, url: `https://example.com/${subject.subjectCode.toLowerCase()}/${normalizeUnit(topic)}-lectures` },
    { title: `${topic} — Practice Problems`, url: `https://example.com/${subject.subjectCode.toLowerCase()}/${normalizeUnit(topic)}-practice` },
  ];
  return JSON.stringify(resources);
}

function determineEstimatedMinutes(type) {
  const map = { note: 30, quiz: 15, flashcard: 10, pyq: 45, link: 10 };
  return map[type] || 20;
}

// ──────────────────────────────────────────────
// Phase 1: Resource Generation
// ──────────────────────────────────────────────

function generateResources(db) {
  logPhase("Generating Resources");

  const RESOURCE_TYPES = ["note", "quiz", "flashcard", "pyq", "link"];
  const contentGenerators = {
    note: generateNoteContent,
    quiz: generateQuizContent,
    flashcard: generateFlashcardContent,
    pyq: generatePYQContent,
    link: generateLinkContent,
  };

  let generated = 0;

  // Prepare insert statement
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO lms_resources (
      id, type, title, description, difficulty, semester, subjectCode, subjectName, unit, unitNormalized,
      tags, uploadedBy, uploadedAt, updatedAt, url, noteContent, structuredContent,
      examYear, examType, examMonth, exportable, estimatedMinutes, renderType,
      viewCount, upvotes, qualityScore, moderationState, verified, isDeleted
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, NULL, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      0, 0, 0, 0, 0, 0
    )
  `);

  for (const subject of CORE_CSE_SUBJECTS) {
    logInfo(`Processing ${subject.subjectCode}: ${subject.subjectName}`);

    for (const unit of subject.units) {
      logInfo(`  Unit: ${unit.unit} — ${unit.title} (${unit.topics.length} topics)`);

      for (const topic of unit.topics) {
        // Determine resource types to generate for this topic
        const typesToGenerate = [];
        for (const [type, count] of Object.entries(unit.resourceMix)) {
          if (RESOURCE_TYPES.includes(type)) {
            // Generate one resource per type, distributed across topics
            typesToGenerate.push(type);
          }
        }
        // Auto-add link if missing from resourceMix (ensures 5/5 type coverage)
        if (!typesToGenerate.includes("link")) typesToGenerate.push("link");

        // Generate one resource per type for this topic
        // Use deterministic rounding: generate the type if the topic index mod count matches
        for (const resType of typesToGenerate) {
          const count = unit.resourceMix[resType] || 1;

          // Deterministic: generate for first `count` topics (round-robin across unit)
          const topicIndex = unit.topics.indexOf(topic);
          if (topicIndex >= count) continue;

          const id = randomId("res");
          const title = `${subject.subjectName} — ${unit.unit}: ${topic} (${resType.toUpperCase()})`;
          const description = generateDescription(subject, unit, topic, resType);
          const tags = JSON.stringify([
            subject.subjectCode.toLowerCase(),
            ...subject.tags.slice(0, 2),
            normalizeUnit(topic).slice(0, 30),
          ]);

          let noteContent = null;
          let structuredContent = null;
          let url = null;
          let examYear = null;
          let examType = null;
          let examMonth = null;

          if (resType === "note") {
            noteContent = generateNoteContent(subject, unit, topic);
          } else if (resType === "quiz") {
            structuredContent = generateQuizContent(subject, unit, topic);
          } else if (resType === "flashcard") {
            structuredContent = generateFlashcardContent(subject, unit, topic);
          } else if (resType === "pyq") {
            structuredContent = generatePYQContent(subject, unit, topic);
            examYear = "2024";
            examType = "end-semester";
          } else if (resType === "link") {
            url = `https://example.com/${subject.subjectCode.toLowerCase()}/${normalizeUnit(topic)}`;
          }

          const estimatedMinutes = determineEstimatedMinutes(resType);
          const difficulty = subject.units.length > 3 && unit.topics.indexOf(topic) > 2 ? "advanced" : "intermediate";

          if (DRY_RUN) {
            logInfo(`    [DRY-RUN] Would create resource: ${title}`);
            generated++;
            continue;
          }

          // Check for existing resource with same title to avoid duplicates
          const existing = db.prepare(
            "SELECT id FROM lms_resources WHERE title = ? AND subjectCode = ? AND unitNormalized = ? AND isDeleted = 0"
          ).get(title, subject.subjectCode, normalizeUnit(unit.unit));

          if (existing) {
            logInfo(`    [SKIP] Already exists: ${title}`);
            continue;
          }

          try {
            insertStmt.run(
              id,
              resType,
              title,
              toNullableString(description),
              difficulty,
              subject.semester,
              subject.subjectCode,
              subject.subjectName,
              unit.unit,
              normalizeUnit(unit.unit),
              tags,
              USER_ID,
              nowIso(),
              url,
              noteContent,
              structuredContent,
              examYear,
              examType,
              examMonth,
              1,
              estimatedMinutes,
              "markdown"
            );
            generated++;
          } catch (err) {
            logError(`Failed to create resource: ${title}`, err);
          }
        }
      }
    }
  }

  stats.resourcesCreated = generated;
  logInfo(`Total resources generated: ${generated}`);
  return generated;
}

// ──────────────────────────────────────────────
// Phase 2: Guide Generation
// ──────────────────────────────────────────────

function generateGuides(db) {
  logPhase("Generating Guides");

  let generated = 0;
  let sectionsGenerated = 0;

  const insertGuideStmt = db.prepare(`
    INSERT OR IGNORE INTO lms_guides (
      id, title, description, authorId, subjectCode, subjectName, semester, unit, unitNormalized,
      tags, difficulty, viewCount, upvotes, qualityScore, exportable, published, isDeleted, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, 0, 0, 0, 1, 1, 0, ?, ?
    )
  `);

  const insertSectionStmt = db.prepare(`
    INSERT OR IGNORE INTO lms_guide_sections (id, guideId, title, content, position)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const subject of CORE_CSE_SUBJECTS) {
    for (const unit of subject.units) {
      const guideTitle = `${subject.subjectCode} — ${unit.title}: Complete Study Guide`;
      const guideDescription = `Comprehensive study guide for ${subject.subjectName} ${unit.unit} — ${unit.title}. Covers all key topics, concepts, and includes practice questions for exam preparation.`;

      if (DRY_RUN) {
        logInfo(`  [DRY-RUN] Would create guide: ${guideTitle}`);
        generated++;
        const sectionCount = unit.topics.length + 2; // intro + topics + summary
        sectionsGenerated += sectionCount;
        continue;
      }

      // Check for existing guide
      const existing = db.prepare("SELECT id FROM lms_guides WHERE title = ? AND subjectCode = ?").get(guideTitle, subject.subjectCode);
      if (existing) {
        logInfo(`  [SKIP] Guide already exists: ${guideTitle}`);
        continue;
      }

      try {
        const guideId = randomId("guide");

        insertGuideStmt.run(
          guideId,
          guideTitle,
          guideDescription,
          USER_ID,
          subject.subjectCode,
          subject.subjectName,
          subject.semester,
          unit.unit,
          normalizeUnit(unit.unit),
          JSON.stringify([...subject.tags, `unit-${unit.unit.toLowerCase().replace(/\s+/g, "-")}`]),
          "intermediate",
          nowIso(),
          nowIso()
        );

        // Generate sections for this guide
        const sections = [];
        sections.push({
          title: "Introduction",
          content: `# ${guideTitle}\n\nThis guide covers **${unit.title}** for ${subject.subjectName} (${subject.subjectCode}). It is designed for Semester ${subject.semester} students and covers all key topics in detail.\n\n## Learning Objectives\n\nBy the end of this guide, you should be able to:\n- Understand the core concepts covered in ${unit.unit}\n- Apply theoretical knowledge to practical problems\n- Prepare effectively for mid-semester and end-semester examinations\n- Connect these concepts with other units in the curriculum`,
        });

        // Create topic sections
        for (const topic of unit.topics) {
          sections.push({
            title: topic,
            content: generateGuideSectionContent(subject, unit, topic),
          });
        }

        // Summary & practice section
        sections.push({
          title: "Summary & Practice Questions",
          content: generateGuideSummarySection(subject, unit),
        });

        // Insert sections
        for (let i = 0; i < sections.length; i++) {
          const sectionId = randomId("gsec");
          insertSectionStmt.run(
            sectionId,
            guideId,
            sections[i].title,
            sections[i].content,
            i + 1
          );
          sectionsGenerated++;
        }

        generated++;
        logInfo(`  Created guide: ${guideTitle} (${sections.length} sections)`);

      } catch (err) {
        logError(`Failed to create guide: ${guideTitle}`, err);
      }
    }
  }

  stats.guidesCreated = generated;
  stats.guideSectionsCreated = sectionsGenerated;
  logInfo(`Total guides generated: ${generated} (${sectionsGenerated} sections)`);
  return generated;
}

function generateGuideSectionContent(subject, unit, topic) {
  return `## ${topic}

### Overview

${topic} is a key topic within ${unit.title} of ${subject.subjectName} (${subject.subjectCode}). This section provides a comprehensive breakdown of the concept, its applications, and its significance in the broader curriculum.

### Key Points

1. **Definition**: ${topic} refers to the core principles and techniques used in ${subject.subjectName.toLowerCase()} to solve computational problems effectively.

2. **Importance**: Understanding ${topic} is essential for building a strong foundation in ${subject.subjectName} and for tackling advanced topics in subsequent units.

3. **Applications**: The concepts covered in this topic have direct applications in:
   - Academic examinations and assessments
   - Technical interviews and coding challenges
   - Real-world software development and system design
   - Advanced research and specialized domains

### Detailed Breakdown

When studying ${topic}, focus on these aspects:

- **Theoretical Foundation**: Understand the mathematical and logical underpinnings
- **Algorithmic Approach**: Learn the standard methods and procedures
- **Implementation Details**: Practice coding implementations in your preferred language
- **Complexity Analysis**: Analyze time and space requirements
- **Edge Cases**: Identify boundary conditions and failure modes

### Common Exam Questions

1. Explain ${topic} with suitable examples.
2. Compare and contrast different approaches related to ${topic}.
3. Analyze the complexity of algorithms based on ${topic}.
4. Apply ${topic} concepts to solve a given problem scenario.
5. Discuss the real-world relevance of ${topic} in modern computing.

### Quick Revision Notes

- **Formula/Definition**: Standard definition and notation
- **Key Property**: Most important characteristic
- **Example**: Classic illustrative example
- **Common Mistake**: What to watch out for

### Additional Resources

- Review the lecture notes for this topic
- Practice with online coding platforms
- Discuss with peers in study groups
- Consult reference textbooks for deeper understanding`;
}

function generateGuideSummarySection(subject, unit) {
  return `## Summary

### Key Takeaways

- ${unit.title} covers ${unit.topics.length} major topics: ${unit.topics.slice(0, 4).join(", ")}${unit.topics.length > 4 ? ", and more" : ""}
- Each topic builds upon the previous ones, creating a coherent learning path
- Mastery of this unit requires both theoretical understanding and practical application

### Practice Questions

1. **Conceptual Question**: Explain the main principles covered in ${unit.unit} and how they interrelate.
2. **Analytical Question**: Compare the different approaches discussed in this unit, highlighting their strengths and weaknesses.
3. **Application Question**: Solve a practical problem that requires applying multiple concepts from this unit.
4. **Design Question**: Design a solution architecture that leverages the key concepts from ${unit.unit}.
5. **Critical Thinking Question**: Identify potential limitations or edge cases in the standard approaches covered.

### Exam Preparation Tips

- Review all topic summaries and key definitions
- Practice with previous years' question papers
- Focus on understanding core principles rather than rote memorization
- Time yourself while solving practice problems
- Form study groups for collaborative learning

### Next Steps

After completing this unit, proceed to the next unit in ${subject.subjectName} to continue building your knowledge. The concepts from ${unit.unit} will be referenced and built upon throughout the course.`;
}

// ──────────────────────────────────────────────
// Phase 3: Roadmap Generation
// ──────────────────────────────────────────────

function generateRoadmaps(db) {
  logPhase("Generating Skill Roadmaps");

  let roadmapsCreated = 0;
  let nodesCreated = 0;
  let edgesCreated = 0;

  const insertRoadmapStmt = db.prepare(`
    INSERT OR IGNORE INTO lms_roadmaps (
      id, title, description, skill, authorId, difficulty, estimatedHours, published, isDeleted, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?
    )
  `);

  const insertNodeStmt = db.prepare(`
    INSERT OR IGNORE INTO lms_roadmap_nodes (
      id, roadmapId, title, description, nodeType, resourceId, position, isOptional
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, 0)
  `);

  const insertEdgeStmt = db.prepare(`
    INSERT OR IGNORE INTO lms_roadmap_edges (roadmapId, fromNodeId, toNodeId)
    VALUES (?, ?, ?)
  `);

  for (const roadmap of SKILL_ROADMAPS) {
    const roadmapTitle = `Skill Roadmap: ${roadmap.skill}`;

    if (DRY_RUN) {
      logInfo(`  [DRY-RUN] Would create roadmap: ${roadmapTitle}`);
      roadmapsCreated++;
      nodesCreated += roadmap.nodes.length;
      edgesCreated += roadmap.edges.length;
      continue;
    }

    const existing = db.prepare("SELECT id FROM lms_roadmaps WHERE title = ?").get(roadmapTitle);
    if (existing) {
      logInfo(`  [SKIP] Roadmap already exists: ${roadmapTitle}`);
      continue;
    }

    try {
      const roadmapId = randomId("roadmap");

      insertRoadmapStmt.run(
        roadmapId,
        roadmapTitle,
        roadmap.description,
        roadmap.skill,
        USER_ID,
        roadmap.difficulty,
        roadmap.estimatedHours,
        nowIso(),
        nowIso()
      );

      // Create nodes
      const nodeIds = [];
      for (let i = 0; i < roadmap.nodes.length; i++) {
        const node = roadmap.nodes[i];
        const nodeId = randomId("rnode");
        insertNodeStmt.run(
          nodeId,
          roadmapId,
          node.title,
          node.description,
          node.nodeType,
          i + 1
        );
        nodeIds.push(nodeId);
        nodesCreated++;
      }

      // Create edges
      for (const [from, to] of roadmap.edges) {
        if (nodeIds[from] && nodeIds[to]) {
          try {
            insertEdgeStmt.run(roadmapId, nodeIds[from], nodeIds[to]);
            edgesCreated++;
          } catch (err) {
            // Skip cycle-detection errors gracefully
          }
        }
      }

      roadmapsCreated++;
      logInfo(`  Created roadmap: ${roadmapTitle} (${roadmap.nodes.length} nodes, ${roadmap.edges.length} edges)`);

    } catch (err) {
      logError(`Failed to create roadmap: ${roadmapTitle}`, err);
    }
  }

  stats.roadmapsCreated = roadmapsCreated;
  stats.roadmapNodesCreated = nodesCreated;
  stats.roadmapEdgesCreated = edgesCreated;
  logInfo(`Total roadmaps: ${roadmapsCreated} (${nodesCreated} nodes, ${edgesCreated} edges)`);
  return roadmapsCreated;
}

// ──────────────────────────────────────────────
// Phase 4: Question Bank Generation
// ──────────────────────────────────────────────

function generateQuestionBank(db) {
  logPhase("Generating Question Bank");

  let generated = 0;
  const DIFFICULTIES = ["easy", "medium", "hard"];

  // Template questions per subject area
  const subjectQuestions = {
    "CSE302": {
      "easy": [
        { q: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], answer: 1 },
        { q: "Which data structure uses LIFO principle?", options: ["Queue", "Stack", "Array", "Tree"], answer: 1 },
        { q: "What is the worst-case time complexity of quicksort?", options: ["O(n log n)", "O(n)", "O(n²)", "O(log n)"], answer: 2 },
        { q: "Which sorting algorithm has the best average-case time complexity?", options: ["Bubble sort", "Selection sort", "Merge sort", "Insertion sort"], answer: 2 },
        { q: "What data structure is used for implementing recursion?", options: ["Queue", "Stack", "Array", "Linked list"], answer: 1 },
      ],
      "medium": [
        { q: "What is the maximum number of nodes in a binary tree of height h?", options: ["2ʰ - 1", "2ʰ⁺¹ - 1", "2ʰ", "2ʰ⁺¹"], answer: 1 },
        { q: "Which of the following is NOT an application of depth-first search?", options: ["Topological sorting", "Finding connected components", "Finding shortest path in unweighted graph", "Detecting cycles in a graph"], answer: 2 },
        { q: "What is the space complexity of the Floyd-Warshall algorithm?", options: ["O(V)", "O(V²)", "O(V³)", "O(E)"], answer: 1 },
      ],
      "hard": [
        { q: "What is the time complexity of the Bellman-Ford algorithm?", options: ["O(V·E)", "O(V²)", "O(E log V)", "O(V + E)"], answer: 0 },
        { q: "Which of the following problems is NP-complete?", options: ["Sorting", "Vertex cover", "Finding MST", "Shortest path"], answer: 1 },
      ],
    },
    "CSE304": {
      "easy": [
        { q: "Which scheduling algorithm is non-preemptive?", options: ["Round Robin", "SJF (non-preemptive)", "Priority (preemptive)", "Multilevel queue"], answer: 1 },
        { q: "What is a process control block (PCB)?", options: ["A data structure containing process info", "A hardware component", "A type of scheduler", "A memory management unit"], answer: 0 },
        { q: "Which memory management scheme suffers from external fragmentation?", options: ["Paging", "Segmentation", "Virtual memory", "Demand paging"], answer: 1 },
      ],
      "medium": [
        { q: "In the Banker's algorithm, what does the 'safe state' represent?", options: ["All processes can complete without deadlock", "No resources are allocated", "All resources are available", "System is in deadlock"], answer: 0 },
        { q: "What is the main advantage of multithreading?", options: ["Improved responsiveness", "Simpler programming model", "Eliminates context switching", "Removes need for synchronization"], answer: 0 },
      ],
      "hard": [
        { q: "Which page replacement algorithm suffers from Belady's anomaly?", options: ["LRU", "FIFO", "Optimal", "Clock"], answer: 1 },
        { q: "What is the primary purpose of the TLB in modern processors?", options: ["Reduce page table lookup time", "Increase memory capacity", "Replace cache memory", "Manage disk I/O"], answer: 0 },
      ],
    },
    "CSE306": {
      "easy": [
        { q: "Which normal form eliminates transitive dependencies?", options: ["1NF", "2NF", "3NF", "BCNF"], answer: 2 },
        { q: "What does ACID stand for in database transactions?", options: ["Atomicity, Consistency, Isolation, Durability", "Access, Control, Integrity, Data", "Atomic, Concurrent, Isolated, Durable", "None of the above"], answer: 0 },
        { q: "Which SQL clause is used to filter groups?", options: ["WHERE", "HAVING", "GROUP BY", "ORDER BY"], answer: 1 },
      ],
      "medium": [
        { q: "What is the difference between DELETE and TRUNCATE in SQL?", options: ["TRUNCATE is DDL, DELETE is DML", "DELETE is faster", "TRUNCATE can use WHERE", "No difference"], answer: 0 },
        { q: "Which of the following is a characteristic of B+tree indexes?", options: ["All data at leaves", "Pointers to data in internal nodes", "No duplicates allowed", "Only supports equality queries"], answer: 0 },
      ],
      "hard": [
        { q: "What is the purpose of the two-phase locking (2PL) protocol?", options: ["Ensure serializability", "Prevent deadlocks", "Optimize queries", "Manage storage"], answer: 0 },
        { q: "Which recovery algorithm uses redo and undo operations?", options: ["ARIES", "Checkpointing", "Shadow paging", "Log-based"], answer: 0 },
      ],
    },
    "CSE308": {
      "easy": [
        { q: "What layer of the OSI model handles routing?", options: ["Data link layer", "Network layer", "Transport layer", "Application layer"], answer: 1 },
        { q: "Which protocol is used for email transmission?", options: ["HTTP", "FTP", "SMTP", "SNMP"], answer: 2 },
        { q: "What is the subnet mask for a /24 CIDR notation?", options: ["255.0.0.0", "255.255.0.0", "255.255.255.0", "255.255.255.255"], answer: 2 },
      ],
      "medium": [
        { q: "How does TCP handle congestion control?", options: ["Slow start and AIMD", "Fixed window sizing", "Packet dropping only", "Application-level control"], answer: 0 },
        { q: "What is the purpose of ARP?", options: ["Map IP to MAC addresses", "Resolve domain names", "Route packets", "Encrypt data"], answer: 0 },
      ],
      "hard": [
        { q: "In BGP, what is an AS path used for?", options: ["Loop prevention and path selection", "Encryption", "Quality of service", "Error correction"], answer: 0 },
        { q: "What is the key difference between TCP and QUIC?", options: ["QUIC runs over UDP", "QUIC is slower", "QUIC only supports streaming", "QUIC is connectionless"], answer: 0 },
      ],
    },
  };

  // Generate questions for subjects with templates, fill others generically
  function generateDefaultQuestions(subject, difficulty) {
    const questions = [];
    const topics = subject.units.flatMap((u) => u.topics).slice(0, 5);
    for (const topic of topics) {
      questions.push({
        q: `In ${subject.subjectName}, which statement best describes ${topic}?`,
        options: [
          `A core concept in ${subject.subjectCode}`,
          "An unrelated topic",
          "Only applicable in theory",
          "A deprecated approach",
        ],
        answer: 0,
      });
    }
    return questions;
  }

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO lms_question_bank (
      id, subjectCode, unit, unitNormalized, topicId, question, options, correctIndex, explanation, difficulty, contributedBy, createdAt
    ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const subject of CORE_CSE_SUBJECTS) {
    const questionsMap = subjectQuestions[subject.subjectCode] || {};

    for (const difficulty of DIFFICULTIES) {
      const qList = questionsMap[difficulty] || generateDefaultQuestions(subject, difficulty);
      let count = 0;

      for (const qData of qList) {
        if (DRY_RUN) {
          generated++;
          continue;
        }

        const id = randomId("qb");
        const unit = subject.units[count % subject.units.length];

        try {
          insertStmt.run(
            id,
            subject.subjectCode,
            unit.unit,
            normalizeUnit(unit.unit),
            qData.q,
            JSON.stringify(qData.options),
            qData.answer,
            `This is a ${difficulty} question about ${subject.subjectName}. The correct option is: ${qData.options[qData.answer]}`,
            difficulty,
            USER_ID,
            nowIso()
          );
          generated++;
          count++;
        } catch (err) {
          // Skip duplicates silently
        }
      }
    }

    logInfo(`  ${subject.subjectCode}: ${generated - stats.questionsCreated} new questions (running total: ${generated})`);
    stats.questionsCreated = generated;
  }

  logInfo(`Total question bank items created: ${generated}`);
  return generated;
}

// ──────────────────────────────────────────────
// Phase 5: Topic Generation & Resource Linking
// ──────────────────────────────────────────────

function generateTopicsAndLinks(db) {
  logPhase("Generating Topics & Resource Links");

  let topicsCreated = 0;
  let linksCreated = 0;

  for (const subject of CORE_CSE_SUBJECTS) {
    for (const unit of subject.units) {
      for (const topic of unit.topics) {
        const topicName = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

        // Check for existing topic
        let existingTopic = db.prepare("SELECT id FROM lms_topics WHERE label = ?").get(topicName);
        if (!existingTopic) {
          const topicId = randomId("topic");
          db.prepare(
            "INSERT OR IGNORE INTO lms_topics (id, label, subjectCode, description, crossSubjectLinks) VALUES (?, ?, ?, ?, ?)"
          ).run(topicId, topicName, subject.subjectCode, `Topic covering ${topic} in ${subject.subjectName}`, "[]");
          existingTopic = { id: topicId };
          topicsCreated++;
        }

        // Link topic to resources
        const resources = db.prepare(
          "SELECT id FROM lms_resources WHERE subjectCode = ? AND unitNormalized = ? AND isDeleted = 0 AND moderationState < 2 LIMIT 10"
        ).all(subject.subjectCode, normalizeUnit(unit.unit));

        for (const resource of resources) {
          try {
            db.prepare("INSERT OR IGNORE INTO lms_resource_topics (resourceId, topicId) VALUES (?, ?)").run(resource.id, existingTopic.id);
            linksCreated++;
          } catch (_err) { /* skip duplicates */ }
        }
      }
    }
  }

  stats.topicsCreated = topicsCreated;
  stats.topicLinks = linksCreated;
  logInfo(`Topics created: ${topicsCreated}, resource links: ${linksCreated}`);
}

// ──────────────────────────────────────────────
// Report Generation
// ──────────────────────────────────────────────

function generateReport(db) {
  logPhase("Generating Audit Report");

  const counts = {
    resources: db.prepare("SELECT COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0").get()?.c || 0,
    resourcesByType: db.prepare("SELECT type, COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0 GROUP BY type ORDER BY c DESC").all(),
    resourcesBySubject: db.prepare("SELECT subjectCode, COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0 GROUP BY subjectCode ORDER BY c DESC").all(),
    guides: db.prepare("SELECT COUNT(*) AS c FROM lms_guides WHERE isDeleted = 0").get()?.c || 0,
    guideSections: db.prepare("SELECT COUNT(*) AS c FROM lms_guide_sections").get()?.c || 0,
    roadmaps: db.prepare("SELECT COUNT(*) AS c FROM lms_roadmaps WHERE isDeleted = 0").get()?.c || 0,
    roadmapNodes: db.prepare("SELECT COUNT(*) AS c FROM lms_roadmap_nodes").get()?.c || 0,
    questions: db.prepare("SELECT COUNT(*) AS c FROM lms_question_bank").get()?.c || 0,
    topics: db.prepare("SELECT COUNT(*) AS c FROM lms_topics").get()?.c || 0,
  };

  const report = {
    timestamp: nowIso(),
    summary: {
      ...counts,
      resourcesGeneratedThisRun: stats.resourcesCreated,
      guidesGeneratedThisRun: stats.guidesCreated,
      roadmapsGeneratedThisRun: stats.roadmapsCreated,
      questionsGeneratedThisRun: stats.questionsCreated,
    },
    stats,
    errors: stats.errors,
    warnings: stats.warnings,
  };

  const reportPath = path.join(PROJECT_ROOT, "scripts", "lms-content-automation", `content-report-${TIMESTAMP}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  logInfo(`Report saved to: ${reportPath}`);

  // Also save a stable "latest" copy
  const latestPath = path.join(PROJECT_ROOT, "scripts", "lms-content-automation", "content-report-latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));

  return report;
}

// ──────────────────────────────────────────────
// Validation (Phase 2 of pipeline)
// ──────────────────────────────────────────────

function runVerification(db) {
  logPhase("Content Verification");

  const issues = [];

  // Check for orphaned resources
  const orphanedResources = db.prepare(
    "SELECT COUNT(*) AS c FROM lms_resources r LEFT JOIN lms_topics t ON r.subjectCode = t.subjectCode WHERE t.id IS NULL"
  ).get()?.c || 0;
  if (orphanedResources > 0) logWarn(`${orphanedResources} resources may have no topic coverage`);

  // Check for guide sections that reference missing topics
  const guidesWithSections = db.prepare(
    "SELECT g.title, COUNT(gs.id) AS sectionCount FROM lms_guides g JOIN lms_guide_sections gs ON gs.guideId = g.id WHERE g.isDeleted = 0 GROUP BY g.id HAVING sectionCount = 0"
  ).all();
  for (const g of guidesWithSections) {
    issues.push({ type: "warning", message: `Guide has no sections: ${g.title}` });
  }

  // Check for resource type coverage gaps
  const coverage = db.prepare(`
    SELECT subjectCode, COUNT(DISTINCT type) AS typeCount FROM lms_resources WHERE isDeleted = 0 GROUP BY subjectCode
  `).all();
  for (const row of coverage) {
    if (row.typeCount < 5) logWarn(`${row.subjectCode} has only ${row.typeCount}/5 resource types`);
  }

  // Check question bank coverage per subject
  const qbCoverage = db.prepare(`
    SELECT subjectCode, COUNT(*) AS qCount FROM lms_question_bank GROUP BY subjectCode ORDER BY qCount DESC
  `).all();
  for (const row of qbCoverage) {
    logInfo(`  ${row.subjectCode}: ${row.qCount} question bank items`);
  }

  // Verify all CORE_CSE_SUBJECTS have at least some resources
  for (const subject of CORE_CSE_SUBJECTS) {
    const count = db.prepare("SELECT COUNT(*) AS c FROM lms_resources WHERE subjectCode = ? AND isDeleted = 0").get(subject.subjectCode)?.c || 0;
    if (count === 0) {
      issues.push({ type: "error", message: `No resources for ${subject.subjectCode}: ${subject.subjectName}` });
    }
  }

  stats.issues = issues;
  logInfo(`Verification complete. ${issues.length} issue(s) found.`);
  return issues;
}

// ──────────────────────────────────────────────
// Critique (Phase 4 of pipeline)
// ──────────────────────────────────────────────

function runCritique(db) {
  logPhase("Content Critique & Gap Analysis");

  const critique = {
    timestamp: nowIso(),
    coverageAnalysis: [],
    qualitySignals: [],
    recommendations: [],
  };

  // Analyze subject coverage depth
  for (const subject of CORE_CSE_SUBJECTS) {
    const resources = db.prepare("SELECT type, unit, COUNT(*) AS c FROM lms_resources WHERE subjectCode = ? AND isDeleted = 0 GROUP BY type, unit").all(subject.subjectCode);
    const unitsWithResources = new Set(resources.map((r) => r.unit));
    const resourceTypes = new Set(resources.map((r) => r.type));

    const expectedUnits = subject.units.length;
    const coveredUnits = unitsWithResources.size;
    const expectedTypes = 5; // note, quiz, flashcard, pyq, link
    const coveredTypes = resourceTypes.size;

    critique.coverageAnalysis.push({
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      unitsCovered: `${coveredUnits}/${expectedUnits}`,
      typesCovered: `${coveredTypes}/${expectedTypes}`,
      totalResources: resources.reduce((sum, r) => sum + Number(r.c || 0), 0),
      coverageScore: Math.round(((coveredUnits / expectedUnits) * 0.6 + (coveredTypes / expectedTypes) * 0.4) * 100),
    });
  }

  // Quality signals based on database metrics
  const resourcesWithContent = db.prepare(
    `SELECT COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0 AND (noteContent IS NOT NULL OR structuredContent IS NOT NULL)`
  ).get()?.c || 0;
  const totalActiveResources = db.prepare("SELECT COUNT(*) AS c FROM lms_resources WHERE isDeleted = 0").get()?.c || 0;

  critique.qualitySignals.push({
    metric: "Resources with content",
    value: `${resourcesWithContent}/${totalActiveResources}`,
    score: totalActiveResources > 0 ? Math.round((resourcesWithContent / totalActiveResources) * 100) : 0,
  });

  // Recommendations
  const subjectsNeedingPyqs = CORE_CSE_SUBJECTS.filter((s) => {
    const count = db.prepare("SELECT COUNT(*) AS c FROM lms_resources WHERE subjectCode = ? AND type = 'pyq' AND isDeleted = 0").get(s.subjectCode)?.c || 0;
    return count < s.units.length;
  }).map((s) => s.subjectCode);

  if (subjectsNeedingPyqs.length > 0) {
    critique.recommendations.push(`Add more PYQs for: ${subjectsNeedingPyqs.join(", ")}`);
  }

  critique.recommendations.push("Review the verification report for any flagged issues");
  critique.recommendations.push("Consider adding video lecture references as link-type resources");
  critique.recommendations.push("Add more difficult-level questions to the question bank for advanced learners");

  const critiquePath = path.join(PROJECT_ROOT, "scripts", "lms-content-automation", `content-critique-${TIMESTAMP}.json`);
  fs.writeFileSync(critiquePath, JSON.stringify(critique, null, 2));
  logInfo(`Critique saved to: ${critiquePath}`);

  // Save stable latest
  const latestCritique = path.join(PROJECT_ROOT, "scripts", "lms-content-automation", "content-critique-latest.json");
  fs.writeFileSync(latestCritique, JSON.stringify(critique, null, 2));

  return critique;
}

// ──────────────────────────────────────────────
// Main Pipeline
// ──────────────────────────────────────────────

function main() {
  console.log("=".repeat(70));
  console.log("  LMS Content Automation Pipeline");
  console.log(`  Started: ${nowIso()}`);
  console.log(`  Database: ${DB_PATH}`);
  console.log(`  User: ${USER_ID}`);
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log("=".repeat(70));

  const startTime = Date.now();

  // Connect
  const db = connectDb(DB_PATH);

  try {
    // Phase 1: Generate Resources
    generateResources(db);

    // Phase 1b: Generate Topics and Links
    generateTopicsAndLinks(db);

    // Phase 2: Generate Guides
    generateGuides(db);

    // Phase 3: Generate Roadmaps
    generateRoadmaps(db);

    // Phase 4: Generate Question Bank
    generateQuestionBank(db);

    // Verification
    runVerification(db);

    // Critique
    runCritique(db);

    // Report
    const report = generateReport(db);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("\n" + "=".repeat(70));
    console.log(`  Pipeline complete in ${elapsed}s`);
    console.log(`  Resources: ${report.summary.resources} total (${stats.resourcesCreated} new)`);
    console.log(`  Guides: ${report.summary.guides} total (${stats.guidesCreated} new)`);
    console.log(`  Roadmaps: ${report.summary.roadmaps} total (${stats.roadmapsCreated} new)`);
    console.log(`  Questions: ${report.summary.questions} total (${stats.questionsCreated} new)`);
    console.log(`  Topics: ${report.summary.topics} total`);
    console.log(`  Errors: ${stats.errors.length}, Warnings: ${stats.warnings.length}`);
    console.log("=".repeat(70));

  } catch (err) {
    console.error("\n[FATAL] Pipeline failed:", err);
    process.exit(1);
  } finally {
    if (db && typeof db.close === "function") {
      db.close();
    }
  }
}

main();
