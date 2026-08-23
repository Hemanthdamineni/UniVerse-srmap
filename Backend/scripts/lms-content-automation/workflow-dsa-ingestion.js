export const meta = {
  name: 'lms-content-ingestion',
  description: 'Ingest DSA-mastery curriculum, generate LMS resources, verify, critique',
  phases: [
    { title: 'Ingest & Map', detail: 'Parse DSA topics, map to CSE302 units' },
    { title: 'Generate Notes', detail: 'Create study notes from DSA data' },
    { title: 'Write to DB', detail: 'Persist all generated content' },
    { title: 'Verify & Critique', detail: 'Verification and gap analysis' },
  ],
}

const ROOT = '/home/zorro-omarchy/Desktop/Projects/Personal/00_Active/University-ERP'
const DSA_PATH = '/home/zorro-omarchy/Desktop/Resources/Roadmaps/DSA-mastery'
const DB_PATH = ROOT + '/Backend/data/lms.sqlite'

// ──────────────────────────────────────────────
// PHASE 1: Ingest DSA-mastery data
// ──────────────────────────────────────────────
phase('Ingest & Map')

log('Reading DSA-mastery topic files...')

const topicFiles = [
  DSA_PATH + '/src/data/topics.ts',
  DSA_PATH + '/src/data/topics2.ts',
  DSA_PATH + '/src/data/topics3.ts',
  DSA_PATH + '/src/data/topics4.ts',
  DSA_PATH + '/src/data/topics5.ts',
  DSA_PATH + '/src/data/layers.ts',
]

const extracts = await parallel(topicFiles.map(fp => () =>
  agent(`Read the file ${fp} and extract ALL complete TopicData or LayerData objects as a JSON array.

Each TopicData object has fields: id, title, layerId, order, description, whyItExists, prerequisites, unlocks, patternClues, patternRecognition, commonMistakes, whenNotToUse, resources (array of {role,source,title,url,description,required,order}), practiceProblems (array of {id,title,difficulty,type,leetcodeNumber}), quizQuestions (array of {id,question,options,correctIndex,explanation}), masteryCheckpoints, complexity ({time,space}), relatedTopics, estimatedDays, xpReward, implementationGuide, visualExplanation

For layers.ts, extract all LayerData objects: id, title, subtitle, order, description, goal, duration, color, topicIds.

Return: { items: array of complete objects }
Respond with ONLY valid JSON, no other text.`, { schema: { type: 'object', properties: { items: { type: 'array' } }, required: ['items'] } })
))

const allTopicItems = extracts.slice(0, 5).flatMap(e => e.items || [])
const allLayersItems = (extracts[5]?.items) || []
log('Ingested ' + allTopicItems.length + ' DSA topics and ' + allLayersItems.length + ' layers')

const curriculum = await agent(`
Map these ${allTopicItems.length} DSA topics into a CSE302 "Design and Analysis of Algorithms" curriculum with 5 units. Consider their titles, descriptions, and complexity.

Here are the topics: ${JSON.stringify(allTopicItems.map(t => ({ id: t.id, title: t.title, desc: (t.description || '').slice(0, 100) })))}

Return a JSON object with a "mappings" array where each entry has: { topicId, unit: "Unit 1-5", difficulty: "beginner|intermediate|advanced", tags: [strings] }

Also return "unitSummaries" with an entry per unit like: { "Unit 1": { title: "string", description: "string" } }

Only valid JSON, no markdown.`, { schema: { type: 'object', properties: {
  mappings: { type: 'array', items: { type: 'object', properties: { topicId: { type: 'string' }, unit: { type: 'string' }, difficulty: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['topicId', 'unit', 'difficulty'] } },
  unitSummaries: { type: 'object' }
}, required: ['mappings', 'unitSummaries'] } })

log('Mapped ' + curriculum.mappings.length + ' topics to CSE302 units')

// ──────────────────────────────────────────────
// PHASE 2: Generate content
// ──────────────────────────────────────────────
phase('Generate Notes')

const noteMappings = curriculum.mappings.slice(0, 24)

const generatedNotes = await parallel(noteMappings.map((m, idx) => () => {
  const topic = allTopicItems.find((t) => t.id === m.topicId)
  if (!topic) return null
  return agent(`
Write a detailed LMS study note in markdown for:
TOPIC: "${topic.title}"
DESC: "${(topic.description || '')}"
UNIT: ${m.unit}
DIFFICULTY: ${m.difficulty}

Content from DSA curriculum:
- Pattern clues: ${JSON.stringify(topic.patternClues || [])}
- Common mistakes: ${JSON.stringify(topic.commonMistakes || [])}
- Implementation guide: ${(topic.implementationGuide || '')}
- Visual explanation: ${(topic.visualExplanation || '')}
- Complexity: ${JSON.stringify(topic.complexity || {})}
- Practice problems: ${JSON.stringify((topic.practiceProblems || []).slice(0, 5).map(p => p.title + '(' + p.difficulty + ')'))}

Structure markdown:
# title
## Overview
## Key Concepts
## Pattern Recognition
## Common Mistakes to Avoid
## When to Use / When Not to Use
## Implementation Guide
## Complexity Analysis
## Practice Problems
## Review Questions
## Summary

Make it authoritative and educational. 300-800 words.
Return JSON: { topicId, title, noteContent, description, estimatedMinutes, difficulty, tags }
`, { label: 'note-' + idx, schema: { type: 'object', properties: {
  topicId: { type: 'string' }, title: { type: 'string' }, noteContent: { type: 'string' },
  description: { type: 'string' }, estimatedMinutes: { type: 'number' }, difficulty: { type: 'string' },
  tags: { type: 'array', items: { type: 'string' } }
}, required: ['topicId', 'title', 'noteContent', 'description', 'estimatedMinutes', 'difficulty', 'tags'] } })
}))

log('Generated ' + generatedNotes.filter(Boolean).length + ' study notes from DSA data')

// ──────────────────────────────────────────────
// PHASE 3: Write to database
// ──────────────────────────────────────────────
phase('Write to DB')

const writeResult = await agent(`
Write the following content into SQLite at ${DB_PATH} using node:sqlite (built-in).

1. Soft-delete old CSE302 demo notes:
UPDATE lms_resources SET isDeleted=1, deletedAt=datetime('now'), deletedBy='ingestion'
WHERE subjectCode='CSE302' AND type='note' AND (title LIKE 'Demo%' OR noteContent IS NULL OR noteContent='')

2. Insert these notes:
${JSON.stringify(generatedNotes.filter(Boolean).slice(0, 20))}

Schema for lms_resources:
  id TEXT PRIMARY KEY, type TEXT, title TEXT, description TEXT, difficulty TEXT, semester TEXT,
  subjectCode TEXT, subjectName TEXT, unit TEXT, unitNormalized TEXT, tags TEXT, uploadedBy TEXT,
  uploadedAt TEXT, updatedAt TEXT, noteContent TEXT, structuredContent TEXT, url TEXT,
  examYear TEXT, examType TEXT, estimatedMinutes INTEGER, renderType TEXT,
  exportable INTEGER DEFAULT 1, viewCount INTEGER DEFAULT 0, upvotes INTEGER DEFAULT 0,
  qualityScore REAL DEFAULT 0, moderationState INTEGER DEFAULT 0, isDeleted INTEGER DEFAULT 0

For each note, use:
- id = 'dsa_note_' + topicId.replace(/[^a-zA-Z0-9]/g, '_')
- type = 'note'
- semester = 'VI'
- subjectCode = 'CSE302'
- subjectName = 'Design and Analysis of Algorithms'
- uploadedBy = 'ingestion-system'
- renderType = 'markdown'
- exportable = 1, isDeleted = 0
- uploadedAt = datetime('now')
- tags as JSON string array

Use INSERT OR IGNORE. Also create lms_topics entries for each unique tag.
Also link resources to topics in lms_resource_topics.

Run the SQL, then return JSON: { written: number, skipped: number, errors: string[] }
`, { schema: { type: 'object', properties: { written: { type: 'number' }, skipped: { type: 'number' }, errors: { type: 'array', items: { type: 'string' } } }, required: ['written', 'skipped', 'errors'] } })

log('DB write: ' + writeResult.written + ' written, ' + writeResult.skipped + ' skipped, ' + writeResult.errors.length + ' errors')

// ──────────────────────────────────────────────
// PHASE 4: Verify & Critique
// ──────────────────────────────────────────────
phase('Verify & Critique')

log('Running verification...')
const verifyOutput = await agent('Run: node ' + ROOT + '/Backend/scripts/lms-content-automation/verify.js --db-path="' + DB_PATH + '" --report. Execute via shell command, capture full stdout. Return the key results as JSON: { totalChecks, passed, failed, warnings }', { schema: { type: 'object', properties: { totalChecks: { type: 'number' }, passed: { type: 'number' }, failed: { type: 'number' }, warnings: { type: 'number' } }, required: ['totalChecks', 'passed', 'failed', 'warnings'] } })

log('Running critique...')
const critiqueOutput = await agent('Run: node ' + ROOT + '/Backend/scripts/lms-content-automation/critique.js --db-path="' + DB_PATH + '" --report. Execute via shell command, capture stdout. Return: { overallCompleteness, criticalGaps, recommendations }', { schema: { type: 'object', properties: { overallCompleteness: { type: 'number' }, criticalGaps: { type: 'number' }, recommendations: { type: 'array', items: { type: 'string' } } }, required: ['overallCompleteness', 'criticalGaps', 'recommendations'] } })

log('Verification: ' + verifyOutput.passed + '/' + verifyOutput.totalChecks + ' passed')
log('Critique completeness: ' + critiqueOutput.overallCompleteness + '%')

// ──────────────────────────────────────────────
// FINAL SUMMARY
// ──────────────────────────────────────────────

return {
  pipeline: 'lms-content-ingestion-dsa-mastery',
  status: 'complete',
  dataSource: DSA_PATH,
  database: DB_PATH,
  ingestion: {
    topicsIngested: allTopicItems.length,
    layersIngested: allLayersItems.length,
    curriculumMappings: curriculum.mappings.length,
  },
  generation: {
    notesGenerated: generatedNotes.filter(Boolean).length,
    resourcesWritten: writeResult.written,
    dbErrors: writeResult.errors,
  },
  verification: {
    checksPassed: verifyOutput.passed,
    checksFailed: verifyOutput.failed,
    totalChecks: verifyOutput.totalChecks,
    warnings: verifyOutput.warnings,
  },
  critique: {
    overallCompleteness: critiqueOutput.overallCompleteness,
    criticalGaps: critiqueOutput.criticalGaps,
    topRecommendations: (critiqueOutput.recommendations || []).slice(0, 5),
  },
}
