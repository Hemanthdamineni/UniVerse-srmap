export const meta = {
  name: 'lms-quality-pipeline',
  description: 'Full lifecycle: generate → proofread → revise → quick-ref → verify for all CSE',
  phases: [
    { title: 'Map Skill Gaps', detail: 'Analyze coverage vs student needs' },
    { title: 'Generate Core Content', detail: 'Write complete notes with all 11 sections' },
    { title: 'Proofread', detail: '3-lens adversarial review' },
    { title: 'Revise & Polish', detail: 'Apply proofreading fixes' },
    { title: 'Quick-Reference Content', detail: 'GFG/LeetCode-style cheatsheets' },
    { title: 'Final Verify', detail: 'Full QA suite and report' },
  ],
}

var ROOT = '/home/zorro-omarchy/Desktop/Projects/Personal/00_Active/University-ERP'
var DB_PATH = ROOT + '/Backend/data/lms.sqlite'
var SCRIPT_DIR = ROOT + '/Backend/scripts/lms-content-automation'

var SUBJECT_NAMES = {
  CSE302: 'Design and Analysis of Algorithms',
  CSE304: 'Operating Systems',
  CSE306: 'Database Management Systems',
  CSE308: 'Computer Networks',
  CSE310: 'Software Engineering',
  CSE312: 'Machine Learning Fundamentals',
  CSE314: 'Theory of Computation',
  CSE316: 'Compiler Design',
}

function makeId(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50) }

// ──────────────────────────────────────────────
// PHASE 1: Map skill gaps
// ──────────────────────────────────────────────
phase('Map Skill Gaps')

log('Analyzing existing LMS content via direct DB query...')

// Use shell-based DB query instead of agent-based (avoid API errors for code execution)
var dbQuery = await agent('Run this shell command and return the JSON output:\nnode -e \'const{DatabaseSync}=require("node:sqlite");const db=new DatabaseSync("' + DB_PATH + '");console.log(JSON.stringify(db.prepare("SELECT subjectCode,COUNT(*)as c,COUNT(DISTINCT type)as types FROM lms_resources WHERE isDeleted=0 GROUP BY subjectCode ORDER BY subjectCode").all()));db.close()\'\n\nReturn the command\'s JSON output as a parsed array.', { schema: { type: 'array', items: { type: 'object', properties: { subjectCode: { type: 'string' }, c: { type: 'number' }, types: { type: 'number' } }, required: ['subjectCode', 'c', 'types'] } } })

// Defensive: if agent returned null (API error), use fallback
var dbState = dbQuery || []

var skillGapItems = [
  { skill: 'Python Programming', reason: 'Core tool for ML, automation, data science' },
  { skill: 'Git & Version Control', reason: 'Essential for collaboration, not in core curriculum' },
  { skill: 'System Design Basics', reason: 'Critical for interviews and capstone projects' },
  { skill: 'Linux & Shell Scripting', reason: 'Fundamental for OS, DevOps, daily dev work' },
  { skill: 'Data Analysis & Visualization', reason: 'Bridges ML theory to real-world practice' },
  { skill: 'Web Development Fundamentals', reason: 'Most common student project type' },
]

log('Found ' + dbState.length + ' subjects in database')
log('Identified ' + skillGapItems.length + ' cross-subject skill gaps to address')

// ──────────────────────────────────────────────
// PHASE 2: Generate enriched content
// ──────────────────────────────────────────────
phase('Generate Core Content')

var enrichTargets = [
  { code: 'CSE304', unit: 'Unit 1', topic: 'CPU Scheduling Algorithms — FCFS, SJF, Round Robin, Priority', dif: 'intermediate', tags: ['os', 'scheduling', 'cpu', 'process-management'] },
  { code: 'CSE304', unit: 'Unit 2', topic: 'Deadlock — Detection, Recovery, and Banker\'s Algorithm', dif: 'advanced', tags: ['os', 'deadlocks', 'synchronization'] },
  { code: 'CSE304', unit: 'Unit 3', topic: 'Page Replacement Algorithms — FIFO, LRU, Optimal, Clock', dif: 'intermediate', tags: ['os', 'memory', 'paging'] },
  { code: 'CSE306', unit: 'Unit 1', topic: 'SQL Query Optimization and Index Selection', dif: 'intermediate', tags: ['dbms', 'sql', 'optimization', 'indexing'] },
  { code: 'CSE306', unit: 'Unit 4', topic: 'Concurrency Control — 2PL, Timestamp Ordering, MVCC', dif: 'advanced', tags: ['dbms', 'transactions', 'concurrency'] },
  { code: 'CSE308', unit: 'Unit 3', topic: 'TCP Congestion Control — Slow Start, AIMD, Fast Retransmit', dif: 'intermediate', tags: ['networks', 'tcp', 'congestion-control'] },
  { code: 'CSE308', unit: 'Unit 5', topic: 'Network Security — TLS Handshake, Certificates, Firewalls', dif: 'advanced', tags: ['networks', 'security', 'tls'] },
  { code: 'CSE310', unit: 'Unit 3', topic: 'TDD, CI/CD Pipelines, and Automated Testing Strategies', dif: 'intermediate', tags: ['se', 'testing', 'ci-cd'] },
  { code: 'CSE310', unit: 'Unit 4', topic: 'Agile Estimation — Story Points, Velocity, Burndown Charts', dif: 'intermediate', tags: ['se', 'agile', 'project-management'] },
  { code: 'CSE312', unit: 'Unit 4', topic: 'Backpropagation and Gradient Descent Optimization Variants', dif: 'advanced', tags: ['ml', 'neural-networks', 'optimization'] },
  { code: 'CSE314', unit: 'Unit 1', topic: 'DFA Minimization and Myhill-Nerode Theorem', dif: 'advanced', tags: ['automata', 'dfa', 'formal-languages'] },
  { code: 'CSE316', unit: 'Unit 3', topic: 'LR Parsing — SLR, CLR, LALR and Parser Generators', dif: 'advanced', tags: ['compiler', 'parsing', 'lr-parser'] },
]

log('Generating ' + enrichTargets.length + ' enriched exam-focused notes with 11-section structure...')

var generatedNotes = await parallel(enrichTargets.map(function(t, idx) { return function() {
  return agent('Write a COMPLETE study note for university LMS exam prep.\n\nSUBJECT: ' + t.code + ' — ' + (SUBJECT_NAMES[t.code] || 'CSE') + '\nUNIT: ' + t.unit + '\nTOPIC: ' + t.topic + '\nDIFFICULTY: ' + t.dif + '\nTAGS: ' + JSON.stringify(t.tags) + '\n\nALL 11 required sections (markdown headings):\n# topic\n## 1. Overview — why this matters, real-world relevance\n## 2. Key Concepts & Definitions — formal definitions of every important term\n## 3. Detailed Explanation — deep structured explanation with subsections\n## 4. Step-by-Step Examples — concrete worked examples (input → process → output)\n## 5. Common Mistakes & Pitfalls — at least 5 specific mistakes with WHY explanations\n## 6. Exam Tips & Interview Questions — what professors look for, time management\n## 7. Quick Reference / Cheat Sheet — compact scannable summary like GFG last-minute notes\n## 8. Practice Problems — 3-5 problems (easy/medium/hard) with hints and solution approach\n## 9. Real-World Applications — industry use, real systems/tools\n## 10. Connections to Other Topics — links to other units and subjects\n## 11. Summary — three-sentence key takeaway\n\nReturn JSON: { title, noteContent, description (2 sentences), estimatedMinutes (number), difficulty, tags }', { label: 'gen-' + idx, schema: { type: 'object', properties: { title: { type: 'string' }, noteContent: { type: 'string' }, description: { type: 'string' }, estimatedMinutes: { type: 'number' }, difficulty: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['title', 'noteContent', 'description', 'estimatedMinutes', 'difficulty', 'tags'] } })
}}))

log('Generated ' + generatedNotes.filter(Boolean).length + ' notes for proofreading')

// ──────────────────────────────────────────────
// PHASE 3: Adversarial proofreading (3 lenses)
// ──────────────────────────────────────────────
phase('Proofread')

log('Running 3-lens adversarial proofreading on all generated notes...')

var proofreadResults = await parallel(generatedNotes.filter(Boolean).map(function(note, idx) { return function() {
  return agent('Review this study note for QUALITY across 3 dimensions. Return a single JSON.\n\nNOTE TITLE: ' + note.title + '\n\nCONTENT SNIPPET:\n' + String(note.noteContent || '').slice(0, 3500) + '\n\n[DIMENSION 1 — ACCURACY 0-100] Check: factual errors, incorrect definitions, wrong complexity claims, misstated algorithms.\n[DIMENSION 2 — PEDAGOGY 0-100] Check: clarity for 3rd-year CSE, concrete examples, logical structure, bridge theory→practice, exam usefulness.\n[DIMENSION 3 — COMPLETENESS 0-100] Check: all 11 sections present and substantive, appropriate practice problems, scannable quick-ref.\n\nReturn JSON exactly: { accuracyScore, accuracyErrors:[{section,error,correction,severity}], pedagogyScore, pedagogyImprovements:[{issue,suggestion,priority}], completenessScore, completenessIssues:[{section,status,suggestion}], needsRevision (true if any score<70 or critical errors) }', { label: 'review-' + idx, schema: { type: 'object', properties: { accuracyScore: { type: 'number' }, accuracyErrors: { type: 'array', items: { type: 'object', properties: { section: { type: 'string' }, error: { type: 'string' }, correction: { type: 'string' }, severity: { type: 'string' } }, required: ['section', 'error', 'correction', 'severity'] } }, pedagogyScore: { type: 'number' }, pedagogyImprovements: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, suggestion: { type: 'string' }, priority: { type: 'string' } }, required: ['issue', 'suggestion', 'priority'] } }, completenessScore: { type: 'number' }, completenessIssues: { type: 'array', items: { type: 'object', properties: { section: { type: 'string' }, status: { type: 'string' }, suggestion: { type: 'string' } }, required: ['section', 'status', 'suggestion'] } }, needsRevision: { type: 'boolean' } }, required: ['accuracyScore', 'accuracyErrors', 'pedagogyScore', 'pedagogyImprovements', 'completenessScore', 'completenessIssues', 'needsRevision'] } })
}}))

var validReviews = proofreadResults.filter(Boolean)
var needsRevision = validReviews.filter(function(r) { return r.needsRevision })
var avgAcc = validReviews.length > 0 ? Math.round(validReviews.reduce(function(s, r) { return s + r.accuracyScore }, 0) / validReviews.length) : 0
var avgPed = validReviews.length > 0 ? Math.round(validReviews.reduce(function(s, r) { return s + r.pedagogyScore }, 0) / validReviews.length) : 0
var avgComp = validReviews.length > 0 ? Math.round(validReviews.reduce(function(s, r) { return s + r.completenessScore }, 0) / validReviews.length) : 0
var overallQuality = Math.round((avgAcc + avgPed + avgComp) / 3)

log('Accuracy: ' + avgAcc + '% | Pedagogy: ' + avgPed + '% | Completeness: ' + avgComp + '% | Overall: ' + overallQuality + '%')
log(needsRevision.length + ' notes need revision, ' + (validReviews.length - needsRevision.length) + ' pass as-is')

// ──────────────────────────────────────────────
// PHASE 4: Revise based on feedback
// ──────────────────────────────────────────────
phase('Revise & Polish')

var revisedMap = {}
var notesToRevise = needsRevision

if (notesToRevise.length > 0) {
  log('Revising ' + notesToRevise.length + ' notes based on proofreading feedback...')
  var revisions = await parallel(notesToRevise.map(function(review, idx) { return function() {
    var origIdx = generatedNotes.filter(Boolean).indexOf(
      generatedNotes.filter(Boolean).filter(function(_, i) { return validReviews.indexOf(review) === i })[0]
    )
    var original = generatedNotes.filter(Boolean)[origIdx >= 0 ? origIdx : idx]
    if (!original) return null
    var feedback = 'ACCURACY: ' + JSON.stringify(review.accuracyErrors) + '\nPEDAGOGY: ' + JSON.stringify(review.pedagogyImprovements) + '\nCOMPLETENESS: ' + JSON.stringify(review.completenessIssues)
    return agent('REVISE this LMS study note based on expert proofreading feedback.\n\nTITLE: ' + original.title + '\n\nORIGINAL:\n' + String(original.noteContent || '').slice(0, 5000) + '\n\nISSUES TO FIX:\n' + feedback + '\n\nFix ALL issues. Return COMPLETE revised markdown with all 11 sections.', { label: 'revise-' + idx, schema: { type: 'object', properties: { title: { type: 'string' }, noteContent: { type: 'string' }, description: { type: 'string' }, estimatedMinutes: { type: 'number' } }, required: ['title', 'noteContent', 'description', 'estimatedMinutes'] } })
  }}))
  for (var i = 0; i < revisions.length; i++) {
    if (revisions[i]) revisedMap[i] = revisions[i]
  }
}

log('Revised ' + Object.keys(revisedMap).length + ' notes based on proofreading feedback')

// Assemble final notes: use revised if available, else original
var finalNotes = generatedNotes.filter(Boolean).map(function(note, idx) {
  var revision = revisedMap[idx]
  if (revision) {
    return { title: revision.title || note.title, noteContent: revision.noteContent || note.noteContent, description: revision.description || note.description, estimatedMinutes: revision.estimatedMinutes || note.estimatedMinutes, difficulty: note.difficulty, tags: note.tags, revised: true }
  }
  return { title: note.title, noteContent: note.noteContent, description: note.description, estimatedMinutes: note.estimatedMinutes, difficulty: note.difficulty, tags: note.tags, revised: false }
})

// ──────────────────────────────────────────────
// PHASE 5: Quick-reference content
// ──────────────────────────────────────────────
phase('Quick-Reference Content')

log('Generating GFG/LeetCode-style last-minute revision cheatsheets...')

var quickRefPlans = [
  { code: 'CSE302', topics: ['Sorting Algorithms Comparison Cheatsheet', 'Graph Algorithms Quick Reference', 'Dynamic Programming Patterns Summary', 'Asymptotic Complexity Master Table'] },
  { code: 'CSE304', topics: ['CPU Scheduling Comparison', 'Page Replacement Algorithms Cheatsheet', 'Deadlock Handling Summary', 'Linux Command Quick Reference'] },
  { code: 'CSE306', topics: ['Normal Forms 1NF-5NF Comparison', 'SQL Query Cheatsheet', 'Transaction Isolation Levels Guide', 'Indexing Strategies Quick Reference'] },
  { code: 'CSE308', topics: ['TCP/IP Protocol Stack Reference', 'HTTP Methods and Status Codes', 'Routing Protocols Comparison', 'Network Security Cheatsheet'] },
  { code: 'CSE310', topics: ['Design Patterns Quick Reference', 'Testing Types Comparison Table', 'UML Diagram Notation Guide', 'Agile Methodology Cheatsheet'] },
  { code: 'CSE312', topics: ['ML Algorithm Selection Guide', 'Evaluation Metrics Cheatsheet', 'Activation Functions Comparison', 'Loss Functions Quick Reference'] },
  { code: 'CSE314', topics: ['Automata and Language Hierarchy', 'Grammar Types Comparison', 'Complexity Classes Cheatsheet', 'Undecidable Problems Reference'] },
  { code: 'CSE316', topics: ['Compiler Phases Overview', 'Parsing Techniques Comparison', 'Code Optimization Cheatsheet', 'Runtime Memory Management Guide'] },
]

var quickRefs = await parallel(quickRefPlans.flatMap(function(subj) {
  return subj.topics.map(function(topic, idx2) { return function() {
    return agent('Create a GFG/LeetCode-style LAST MINUTE REVISION cheatsheet.\n\nSUBJECT: ' + subj.code + ' — ' + (SUBJECT_NAMES[subj.code] || '') + '\nCHEATSHEET: ' + topic + '\n\nA student has 5 minutes before an exam. Make it dense, scannable, useful.\n\nFormat (markdown):\n# ' + topic + '\n\n## Key Formulas / Definitions\n(3-5 bullet points only)\n\n## Quick Comparison Table\n(markdown table if applicable)\n\n## Step-by-Step Process\n(4-6 steps if applicable)\n\n## Edge Cases & Gotchas\n(what exam tricks to watch for)\n\n## Must-Know for Exam\n(2-3 items that always appear on exams)\n\nUnder 300 words. Bold key terms. Pure markdown.', { label: 'qr-' + subj.code + '-' + idx2, schema: { type: 'object', properties: { subjectCode: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' } }, required: ['subjectCode', 'title', 'content'] } })
  }})
}))

log('Generated ' + quickRefs.filter(Boolean).length + ' cheatsheets')

// Build DB payloads
var notesForDb = finalNotes.filter(Boolean).map(function(n) {
  var code = 'CSE302'
  if (n.tags && Array.isArray(n.tags)) {
    var found = n.tags.find(function(t) { return typeof t === 'string' && t.startsWith('CSE') })
    if (found) code = found
  }
  var unitMatch = String(n.title || '').match(/Unit\s+(\d)/i)
  var unit = unitMatch ? 'Unit ' + unitMatch[1] : 'Unit 1'
  return { id: 'enr_' + makeId(n.title).slice(0, 50), type: 'note', semester: 'VI', subjectCode: code, subjectName: SUBJECT_NAMES[code] || 'Computer Science', unit: unit, title: String(n.title || '').slice(0, 200), description: String(n.description || 'Study note for ' + code).slice(0, 300), difficulty: n.difficulty || 'intermediate', tags: JSON.stringify(Array.isArray(n.tags) ? n.tags : [code.toLowerCase()]), noteContent: String(n.noteContent || ''), estimatedMinutes: typeof n.estimatedMinutes === 'number' ? n.estimatedMinutes : 30, renderType: 'markdown', uploadedBy: 'quality-pipeline' }
})

var cheatsForDb = quickRefs.filter(Boolean).map(function(q) {
  return { id: 'cheat_' + makeId(q.subjectCode + '_' + q.title).slice(0, 50), type: 'note', semester: 'VI', subjectCode: q.subjectCode, subjectName: SUBJECT_NAMES[q.subjectCode] || 'Computer Science', unit: 'Quick Reference', title: String(q.title || '').slice(0, 200), description: q.subjectCode + ' — Last Minute Revision', difficulty: 'intermediate', tags: JSON.stringify([q.subjectCode.toLowerCase(), 'quick-reference', 'cheatsheet']), noteContent: String(q.content || ''), estimatedMinutes: 5, renderType: 'markdown', uploadedBy: 'quality-pipeline' }
})

// ──────────────────────────────────────────────
// Write to database
// ──────────────────────────────────────────────
log('Writing content to LMS database...')

var writePayload = JSON.stringify({ notes: notesForDb, cheatsheets: cheatsForDb })

var writeResult = await agent('Write this content into SQLite at ' + DB_PATH + ' using node:sqlite.\n\nRun these operations:\n\n1. Soft-delete old quality-pipeline content:\ndb.prepare("UPDATE lms_resources SET isDeleted=1, deletedAt=datetime(\'now\'), deletedBy=\'quality-pipeline\' WHERE uploadedBy=\'quality-pipeline\' AND isDeleted=0").run()\n\n2. Insert notes (INSERT OR IGNORE):\nFor each item in the "notes" array, insert into lms_resources with id, type=\'note\', title, description, difficulty=\'intermediate\', semester=\'VI\', subjectCode, subjectName, unit, unitNormalized=lower(replace(unit,\' \',\'-\')), tags, uploadedBy=\'quality-pipeline\', uploadedAt=datetime(\'now\'), updatedAt=datetime(\'now\'), noteContent, estimatedMinutes, renderType=\'markdown\', exportable=1, isDeleted=0, viewCount=0, upvotes=0, qualityScore=0, moderationState=0\n\n3. Insert cheatsheets (INSERT OR IGNORE, same schema)\n\n4. Create lms_topics entries for any tag matching pattern /^[a-z]/ using INSERT OR IGNORE\n\n5. Link resources to topics in lms_resource_topics\n\nDATA: ' + writePayload + '\n\nReturn JSON: { notesWritten: number, cheatsheetsWritten: number, errors: [string] }', { schema: { type: 'object', properties: { notesWritten: { type: 'number' }, cheatsheetsWritten: { type: 'number' }, errors: { type: 'array', items: { type: 'string' } } }, required: ['notesWritten', 'cheatsheetsWritten', 'errors'] } })

var dbNotes = (writeResult && writeResult.notesWritten) || 0
var dbCheats = (writeResult && writeResult.cheatsheetsWritten) || 0
var dbErrors = (writeResult && writeResult.errors) || []
log('DB: ' + dbNotes + ' notes, ' + dbCheats + ' cheatsheets written, ' + dbErrors.length + ' errors')

// ──────────────────────────────────────────────
// Final verification
// ──────────────────────────────────────────────
phase('Final Verify')

log('Running final verification suite...')

var finalV = await agent('Run: node ' + SCRIPT_DIR + '/verify.js --db-path="' + DB_PATH + '" --report. Execute via shell, capture stdout. Return: { totalChecks, passed, failed, warnings }', { schema: { type: 'object', properties: { totalChecks: { type: 'number' }, passed: { type: 'number' }, failed: { type: 'number' }, warnings: { type: 'number' } }, required: ['totalChecks', 'passed', 'failed', 'warnings'] } })

var finalC = await agent('Run: node ' + SCRIPT_DIR + '/critique.js --db-path="' + DB_PATH + '" --report. Execute via shell. Return: { overallCompleteness: number, criticalGaps: number, recommendations: [string] }', { schema: { type: 'object', properties: { overallCompleteness: { type: 'number' }, criticalGaps: { type: 'number' }, recommendations: { type: 'array', items: { type: 'string' } } }, required: ['overallCompleteness', 'criticalGaps', 'recommendations'] } })

var vPassed = (finalV && finalV.passed) || 0
var vTotal = (finalV && finalV.totalChecks) || 0
var vFailed = (finalV && finalV.failed) || 0
var vWarn = (finalV && finalV.warnings) || 0
var cScore = (finalC && finalC.overallCompleteness) || 0
var cGaps = (finalC && finalC.criticalGaps) || 0
var cRecs = (finalC && finalC.recommendations) || []

log('Verify: ' + vPassed + '/' + vTotal + ' passed (' + vFailed + ' failed, ' + vWarn + ' warnings)')
log('Critique: ' + cScore + '% completeness, ' + cGaps + ' critical gaps')

// ──────────────────────────────────────────────
// OUTPUT
// ──────────────────────────────────────────────

return {
  pipeline: 'lms-quality-pipeline',
  status: 'complete',
  phases: {
    skillGapAnalysis: { subjectsFound: dbState.length, skillGapsIdentified: skillGapItems.length, topGaps: skillGapItems.map(function(s) { return s.skill }).slice(0, 4) },
    contentGeneration: { notesGenerated: generatedNotes.filter(Boolean).length, subjectsCovered: [...new Set(enrichTargets.map(function(t) { return t.code }))] },
    proofreading: {
      notesReviewed: validReviews.length,
      avgAccuracy: avgAcc,
      avgPedagogy: avgPed,
      avgCompleteness: avgComp,
      overallQualityScore: overallQuality,
      notesPassed: validReviews.length - needsRevision.length,
      notesRevised: Object.keys(revisedMap).length,
    },
    quickRefContent: { cheatsheetsGenerated: quickRefs.filter(Boolean).length, subjectsCovered: quickRefPlans.length },
    database: { notesWritten: dbNotes, cheatsheetsWritten: dbCheats, dbErrors: dbErrors },
    finalVerification: { passed: vPassed, failed: vFailed, total: vTotal, warnings: vWarn },
    finalCritique: { completeness: cScore, criticalGaps: cGaps, topRecommendations: cRecs.slice(0, 3) },
  },
}
