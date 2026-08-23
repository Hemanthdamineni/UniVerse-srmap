import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../data/lms.sqlite");

const db = new DatabaseSync(dbPath);

// --- helpers ---
function randomId(prefix) {
  const value = crypto.randomUUID();
  return prefix ? `${prefix}_${value}` : value;
}

function normalizeUnit(unit) {
  return String(unit ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

// --- 5 questions for CSE310 Software Engineering Unit 1 ---
const questions = [
  {
    question: "What is the primary goal of Software Engineering?",
    options: JSON.stringify([
      "To write code as quickly as possible",
      "To develop software using systematic, disciplined, and quantifiable approaches",
      "To create graphical user interfaces for all applications",
      "To replace hardware components with software equivalents"
    ]),
    correctIndex: 1,
    explanation: "Software Engineering applies systematic, disciplined, and quantifiable approaches to the development, operation, and maintenance of software. It is not just about writing code but about following engineering principles to produce reliable and efficient software.",
    difficulty: "easy",
  },
  {
    question: "Which SDLC model is most suitable for projects with well-understood requirements and where changes are minimal?",
    options: JSON.stringify([
      "Spiral Model",
      "Waterfall Model",
      "Agile Model",
      "V-Model"
    ]),
    correctIndex: 1,
    explanation: "The Waterfall Model is a linear sequential model best suited for projects with clearly defined, stable requirements and minimal expected changes. Each phase must be completed before the next begins.",
    difficulty: "easy",
  },
  {
    question: "In the Spiral model of software development, what are the four major activities performed in each iteration?",
    options: JSON.stringify([
      "Plan, Design, Code, Test",
      "Determine objectives, Identify risks, Develop and test, Plan next iteration",
      "Requirements, Analysis, Design, Implementation",
      "Gather requirements, Build prototype, Get feedback, Refine"
    ]),
    correctIndex: 1,
    explanation: "The Spiral model's four quadrants per iteration are: (1) Determine objectives and constraints, (2) Identify and evaluate risks, (3) Develop and verify the product, and (4) Plan the next iteration. Risk assessment is central to this model.",
    difficulty: "hard",
  },
  {
    question: "Which phase in the SDLC involves translating design specifications into executable code?",
    options: JSON.stringify([
      "Testing",
      "Implementation / Coding",
      "Design",
      "Maintenance"
    ]),
    correctIndex: 1,
    explanation: "The Implementation (Coding) phase is where the actual source code is written based on the design documents. It transforms design specifications into a working software product.",
    difficulty: "easy",
  },
  {
    question: "What is the main advantage of the Iterative model over the Waterfall model?",
    options: JSON.stringify([
      "It requires less documentation",
      "It delivers a working version of the software early and refines it through repeated cycles",
      "It eliminates all risks before development begins",
      "It does not require user involvement"
    ]),
    correctIndex: 1,
    explanation: "The Iterative model develops software through repeated cycles (iterations), each producing a working version of increasing functionality. This allows early delivery of core features and incorporates feedback between iterations, unlike the rigid linear Waterfall model.",
    difficulty: "medium",
  },
];

const subjectCode = "CSE310";
const unit = "Unit  1";
const unitNorm = normalizeUnit(unit);
const contributedBy = "populator-bot";
const resourceId = randomId("res");

// --- resource ---
const resourceTitle = "CSE310 Software Engineering — Unit 1 Quiz";
const resourceDescription = "5 questions covering Unit 1: Introduction to Software Engineering, SDLC models, and software process frameworks.";
const resourceTags = JSON.stringify(["software-engineering", "sdlc", "introduction", "process-models"]);
const structuredContent = JSON.stringify({
  totalQuestions: 5,
  subjectCode,
  unit,
  questions: questions.map((q) => ({
    question: q.question,
    options: JSON.parse(q.options),
    correctIndex: q.correctIndex,
    explanation: q.explanation,
    difficulty: q.difficulty,
  })),
});

// Insert quiz resource
const insertResource = db.prepare(`
  INSERT OR IGNORE INTO lms_resources (
    id, type, title, description, difficulty, semester, subjectCode, subjectName, unit, unitNormalized,
    tags, uploadedBy, uploadedAt, updatedAt, structuredContent, estimatedMinutes, renderType, exportable, isDeleted
  ) VALUES (?, 'quiz', ?, ?, 'beginner', 'VI', ?, 'Software Engineering', ?, ?, ?, 'populator-bot', datetime('now'), datetime('now'), ?, 10, 'quiz', 1, 0)
`);

insertResource.run(
  resourceId,
  resourceTitle,
  resourceDescription,
  subjectCode,
  unit,
  unitNorm,
  resourceTags,
  structuredContent
);

// Insert questions
const insertQuestion = db.prepare(`
  INSERT OR IGNORE INTO lms_question_bank (
    id, subjectCode, unit, unitNormalized, question, options, correctIndex, explanation, difficulty, contributedBy, createdAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

let questionsAdded = 0;
for (const q of questions) {
  const qId = randomId("q_auto");
  insertQuestion.run(
    qId,
    subjectCode,
    unit,
    unitNorm,
    q.question,
    q.options,
    q.correctIndex,
    q.explanation,
    q.difficulty,
    contributedBy
  );
  questionsAdded++;
}

console.log(JSON.stringify({ resourceId, questionsAdded }));
