export const meta = {
  name: 'lms-content-populator',
  description: 'Aggressively populates LMS: each cycle adds new resources, improves existing ones, deletes useless, balances subjects. Run 20-30 cycles to fill before launch.',
  phases: [
    { title: 'Scan', detail: 'Audit current state, find gaps, pick targets' },
    { title: 'Fix Curriculum', detail: 'Purge wrong subject codes, remap correct ones' },
    { title: 'Delete Trash', detail: 'Remove placeholder/demo content' },
    { title: 'Rewrite Thin Notes', detail: 'Upgrade short notes into proper study material' },
    { title: 'Generate New Resources', detail: 'Create new notes, quizzes, flashcards, links for weakest subjects' },
    { title: 'Generate QR Cheatsheets', detail: 'Add last-minute revision sheets' },
    { title: 'Generate Question Bank', detail: 'Add practice questions for subjects with low QB count' },
    { title: 'Apply All', detail: 'Write everything to DB, report cycle stats' },
  ],
}

var ROOT = '/home/zorro-omarchy/Desktop/Projects/Personal/00_Active/University-ERP'
var DB_PATH = ROOT + '/Backend/data/lms.sqlite'
var SCRIPTS = ROOT + '/Backend/scripts/lms-content-automation'

var FAKE_CODES = ['CSE308','CSE310','CSE312','CSE314','CSE316']

function sh(cmd) { return agent('Run this shell command. Return ONLY the raw stdout, no markdown, no json fences, no explanation:\n' + cmd) }

function cleanJSON(s) {
  s = String(s || '').trim()
  // Strip markdown code fences
  s = s.replace(/^```[\s\S]*?\n/g, '').replace(/\n```.*$/g, '').replace(/```/g, '').trim()
  // Try parsing directly
  try { JSON.parse(s); return s } catch(e) {}
  // Find first { and try from there to last }
  var start = s.indexOf('{')
  if (start >= 0) { var tryStr = s.slice(start); if (tryStr.includes('}')) tryStr = tryStr.slice(0, tryStr.lastIndexOf('}')+1); try { JSON.parse(tryStr); return tryStr } catch(e2) {} }
  // Find first [ and try from there to last ]
  start = s.indexOf('[')
  if (start >= 0) { var tryStr2 = s.slice(start); if (tryStr2.includes(']')) tryStr2 = tryStr2.slice(0, tryStr2.lastIndexOf(']')+1); try { JSON.parse(tryStr2); return tryStr2 } catch(e3) {} }
  // Fallback
  return '{}'
}

var SUBJECTS = {
  CSE101: 'Fundamentals of Computing and Programming in C',
  CSE102: 'Data Structures',
  CSE202: 'OOPS with C++',
  CSE203: 'Discrete Mathematics',
  CSE204: 'Design and Analysis of Algorithms',
  CSE205: 'Hands-On with Python',
  CSE207: 'Digital Electronics',
  CSE208: 'Probability and Statistics',
  CSE209: 'Database Management Systems',
  CSE210: 'Web Technology',
  CSE301: 'Computer Networks',
  CSE302: 'Operating Systems',
  CSE303: 'Machine Learning',
  CSE304: 'Automata and Compiler Design',
  CSE305: 'Computer Organization and Architecture',
  CSE306: 'Software Engineering and Project Management',
  CSE309: 'Advanced Java Programming',
  CSE423: 'Natural Language Processing',
  CSE455: 'Artificial Intelligence',
  CSE456: 'Digital Image Processing',
}

var UNITS = ['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5']

// ──────────────────────────────────────────────
// PHASE 1: Scan
// ──────────────────────────────────────────────
phase('Scan')

log('Full audit of LMS content state...')

var raw = await sh('node ' + SCRIPTS + '/query-notes.js')
var allNotes = JSON.parse(cleanJSON(raw))
log('Total notes: ' + allNotes.length)

// Per-subject full breakdown
var breakdown = await sh('node ' + SCRIPTS + '/query-audit.js ' + DB_PATH)
var audit = JSON.parse(cleanJSON(breakdown))

log('Subjects (ascending): ' + audit.subjects.map(function(s) { return s.subjectCode + '(' + s.total + 'res,' + s.types + 'types)' }).join(' | '))
log('Resource types: ' + audit.types.map(function(t) { return t.type + '=' + t.c }).join(', '))
log('Demo/placeholder: ' + audit.demoCount)

// Pick weakest subject to target this cycle
var weakestSubject = audit.subjects[0] // lowest total resources
log('Targeting: ' + weakestSubject.subjectCode + ' (' + weakestSubject.total + ' resources)')

// Pick lowest resource type
var lowestType = audit.types[0] // lowest count type
if (!lowestType || lowestType.c > 150) lowestType = { type: 'quiz', c: 71 }
log('Lowest resource type: ' + lowestType.type + ' (' + lowestType.c + ')')

// Pick subject with lowest question bank
var weakestQB = (audit.questions[0] || { subjectCode: 'CSE302', c: 0 })
log('Lowest QB: ' + weakestQB.subjectCode + ' (' + weakestQB.c + ' questions)')

var changes = { deleted: 0, rewritten: 0, newNotes: 0, newQuizzes: 0, newFlashcards: 0, newPyqs: 0, newLinks: 0, newQB: 0, enriched: 0 }

// ──────────────────────────────────────────────
// PHASE 2: Fix curriculum — purge fake subjects, remap correct codes
// ──────────────────────────────────────────────
phase('Fix Curriculum')
var fixResult = await sh('node ' + SCRIPTS + '/query-fix-curriculum.js ' + DB_PATH)
var fixData = JSON.parse(cleanJSON(fixResult))
log('Purged ' + fixData.purgedResources + ' resources, ' + fixData.purgedGuides + ' guides, ' + fixData.purgedQB + ' QB items')
log('Remapped ' + (fixData.remapped ? (fixData.remapped.notes + fixData.remapped.cheats) : 0) + ' resources with correct subject codes')
if (fixData.subjects) {
  log('Subjects now: ' + fixData.subjects.map(function(s) { return s.subjectCode + '(' + s.c + ')' }).join(', '))
}

// ──────────────────────────────────────────────
// PHASE 3: Delete trash
// ──────────────────────────────────────────────
phase('Delete Trash')

var trashResult = await sh('node -e \'const{DatabaseSync}=require("node:sqlite");const db=new DatabaseSync("' + DB_PATH + '");var r=db.prepare("UPDATE lms_resources SET isDeleted=1,deletedAt=datetime(\'now\'),deletedBy=\'cleanup-cycle\' WHERE isDeleted=0 AND (title LIKE \'%Demo%\' OR title LIKE \'%placeholder%\' OR title LIKE \'%test%\')").run();console.log(JSON.stringify({deleted:r.changes}));db.close()\'')
var trash = JSON.parse(cleanJSON(trashResult))
changes.deleted = trash.deleted || 0
log('Deleted ' + changes.deleted + ' demo/placeholder resources')

// ──────────────────────────────────────────────
// PHASE 3: Rewrite thin notes
// ──────────────────────────────────────────────
phase('Rewrite Thin Notes')

var thinNotes = allNotes.filter(function(n) { return n.len < 1000 }).slice(0, 5)
log('Rewriting ' + thinNotes.length + ' thin notes...')

var rewrites = await parallel(thinNotes.map(function(n, idx) { return function() {
  return agent('Read content of note "' + n.id + '" from ' + DB_PATH + ': node -e \'const{DatabaseSync}=require("node:sqlite");const db=new DatabaseSync("' + DB_PATH + '");var r=db.prepare("SELECT noteContent FROM lms_resources WHERE id=\'"+process.argv[1]+"\'").get();console.log(JSON.stringify(r));db.close()\' ' + n.id + '\n\nIf under 800 chars, REWRITE as a proper study note with:\n# ' + n.title + '\n## 1. Overview\n## 2. Key Concepts & Definitions\n## 3. Detailed Explanation\n## 4. Step-by-Step Examples (at least 3)\n## 5. Common Mistakes & Pitfalls\n## 6. Quick Reference / Cheat Sheet\n## 7. Practice Questions\n## 8. Summary\n\nSubject: ' + n.subjectCode + ' | Unit: ' + n.unit + '\n\nReturn JSON: {"id":"' + n.id + '","noteContent":"...","action":"rewritten"}', { label: 'rw-' + idx, schema: { type: 'object', properties: { id: { type: 'string' }, noteContent: { type: 'string' }, action: { type: 'string' } }, required: ['id', 'noteContent', 'action'] } })
}}))

var rewrote = rewrites.filter(function(r) { return r && r.action === 'rewritten' })
changes.rewritten = rewrote.length
log('Rewrote ' + rewrote.length + ' notes')

// ──────────────────────────────────────────────
// PHASE 4: Generate new resources for weakest subject
// ──────────────────────────────────────────────
phase('Generate New Resources')

var target = weakestSubject.subjectCode
var targetName = SUBJECTS[target] || 'Computer Science'

// Pick the unit with FEWEST resources in this subject
var unitTarget = await sh('node ' + SCRIPTS + '/query-weakest-unit.js ' + target + ' ' + DB_PATH)
var weakestUnit = JSON.parse(cleanJSON(unitTarget))
log('Weakest unit in ' + target + ': ' + (weakestUnit.unitNormalized || 'unit-1') + ' (' + (weakestUnit.c || 0) + ' resources)')

// Generate 2 new notes for the weakest unit
log('Generating 2 new notes for ' + target + '...')
var newNotes = await parallel([1,2].map(function(i) { return function() {
  return agent('Create and INSERT a new study note for the LMS.\n\nSubject: ' + target + ' — ' + targetName + '\nTarget unit: ' + (weakestUnit.unitNormalized || 'unit-1') + '\n\nWrite a proper study note (600-1000 words) with:\n# title\n## 1. Overview\n## 2. Key Concepts\n## 3. Detailed Explanation\n## 4. Examples (at least 3)\n## 5. Common Mistakes\n## 6. Quick Reference\n## 7. Practice Questions\n## 8. Summary\n\nPick a specific, exam-relevant topic.\n\nThen insert it:\nconst{DatabaseSync}=require("node:sqlite");const db=new DatabaseSync("' + DB_PATH + '");var id="auto_note_"+Date.now()+"_"+i;db.prepare("INSERT OR IGNORE INTO lms_resources(id,type,title,description,difficulty,semester,subjectCode,subjectName,unit,unitNormalized,tags,uploadedBy,uploadedAt,updatedAt,noteContent,estimatedMinutes,renderType,exportable,isDeleted) VALUES(?,?,\'note\',?,?,?,\'VI\',?,?,?,?,?,\'populator-bot\',datetime(\'now\'),datetime(\'now\'),?,30,\'markdown\',1,0)").run(id,...)\n\nReturn JSON: { id: string, title: string, topic: string, inserted: boolean }', { label: 'nn-' + i, schema: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, topic: { type: 'string' }, inserted: { type: 'boolean' } }, required: ['id', 'title', 'topic', 'inserted'] } })
}}))

var nn = newNotes.filter(function(n) { return n && n.inserted })
changes.newNotes = nn.length
log('Created ' + nn.length + ' new notes')

// Generate 2 quizzes for the weakest unit
log('Generating 2 quizzes for ' + target + '...')
var newQuizzes = await parallel([1,2].map(function(i) { return function() {
  return agent('Create and INSERT 5 quiz questions for ' + target + ' — ' + targetName + ' unit ' + (weakestUnit.unitNormalized || 'unit-1') + ' into the LMS.\n\nFor each question:\n- id="q_auto_"+random\n- subjectCode="' + target + '"\n- unit="' + (weakestUnit.unitNormalized || 'unit-1').replace(/^unit/i,'Unit ').trim() + '"\n- question: string\n- options: JSON array of 4 strings\n- correctIndex: 0-3\n- explanation: string\n- difficulty: "easy","medium",or "hard"\n- contributedBy: "populator-bot"\n\nInsert: db.prepare("INSERT OR IGNORE INTO lms_question_bank(id,subjectCode,unit,unitNormalized,question,options,correctIndex,explanation,difficulty,contributedBy,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,datetime(\'now\'))").run(...)\n\nAlso create a quiz resource: db.prepare("INSERT OR IGNORE INTO lms_resources(id,type,title,description,difficulty,semester,subjectCode,subjectName,unit,unitNormalized,tags,uploadedBy,uploadedAt,updatedAt,structuredContent,estimatedMinutes,renderType,exportable,isDeleted) VALUES(?,?,\'quiz\',?,?,?,\'VI\',?,?,?,?,?,\'populator-bot\',datetime(\'now\'),datetime(\'now\'),?,10,\'quiz\',1,0)")\n\nReturn JSON: { resourceId: string, questionsAdded: number }', { label: 'nq-' + i, schema: { type: 'object', properties: { resourceId: { type: 'string' }, questionsAdded: { type: 'number' } }, required: ['resourceId', 'questionsAdded'] } })
}}))

var nq = newQuizzes.filter(function(q) { return q && q.questionsAdded > 0 })
changes.newQuizzes = nq.length
changes.newQB = nq.reduce(function(s, q) { return s + (q.questionsAdded || 0) }, 0)
log('Created ' + nq.length + ' quiz resources with ' + changes.newQB + ' questions')

// Generate 5 flashcards for the weakest subject
log('Generating flashcards for ' + target + '...')
var fcResult = await agent('Create 5 flashcards for ' + target + ' — ' + targetName + ' and INSERT into LMS.\n\nFlashcards go into lms_resources with type="flashcard" and structuredContent = front|||back pairs separated by \\n---\\n\n\nInsert:\nconst{DatabaseSync}=require("node:sqlite");const db=new DatabaseSync("' + DB_PATH + '");var id="auto_fc_"+Date.now();db.prepare("INSERT OR IGNORE INTO lms_resources(id,type,title,description,difficulty,semester,subjectCode,subjectName,unit,unitNormalized,tags,uploadedBy,uploadedAt,updatedAt,structuredContent,estimatedMinutes,renderType,exportable,isDeleted) VALUES(?,?,\'flashcard\',?,?,?,\'VI\',?,?,?,?,?,\'populator-bot\',datetime(\'now\'),datetime(\'now\'),?,10,\'markdown\',1,0)").run(id,...)\n\nEach card: front question ||| back answer. Separate cards with \\n---\\n\n\nReturn JSON: { resourceId: string, cardCount: number, subjectCode: string, unit: string }', { label: 'nfc', schema: { type: 'object', properties: { resourceId: { type: 'string' }, cardCount: { type: 'number' }, subjectCode: { type: 'string' }, unit: { type: 'string' } }, required: ['resourceId', 'cardCount', 'subjectCode', 'unit'] } })

if (fcResult && fcResult.cardCount > 0) { changes.newFlashcards = fcResult.cardCount; log('Created ' + fcResult.cardCount + ' flashcards') }

// Generate 2 link resources with real URLs for the weakest subject
log('Generating link resources for ' + target + '...')
var linkResult = await agent('Create 2 link-type resources for ' + target + ' — ' + targetName + ' and INSERT into LMS.\n\nUse real educational URLs (GeeksforGeeks, NPTEL, YouTube, LeetCode, etc).\n\nInsert:\nconst{DatabaseSync}=require("node:sqlite");const db=new DatabaseSync("' + DB_PATH + '");db.prepare("INSERT OR IGNORE INTO lms_resources(id,type,title,description,difficulty,semester,subjectCode,subjectName,unit,unitNormalized,tags,uploadedBy,uploadedAt,updatedAt,url,estimatedMinutes,renderType,exportable,isDeleted) VALUES(?,?,\'link\',?,?,?,\'VI\',?,?,?,?,?,\'populator-bot\',datetime(\'now\'),datetime(\'now\'),?,10,\'link\',1,0)").run(...)\n\nReturn JSON: { created: number, links: [{id, title, url}] }', { label: 'nlk', schema: { type: 'object', properties: { created: { type: 'number' }, links: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, url: { type: 'string' } }, required: ['id', 'title', 'url'] } } }, required: ['created', 'links'] } })

if (linkResult && linkResult.created > 0 && linkResult.created < 100) { changes.newLinks = linkResult.created; log('Created ' + linkResult.created + ' link resources') }

// ──────────────────────────────────────────────
// PHASE 5: Generate Quick Reference cheatsheets for underserved subject
// ──────────────────────────────────────────────
phase('Generate QR Cheatsheets')

var secondWeakest = (audit.subjects[1] || weakestSubject).subjectCode
log('Creating cheatsheet for ' + secondWeakest + '...')

var cheatResult = await agent('Create a LAST MINUTE REVISION cheatsheet for ' + secondWeakest + ' — ' + (SUBJECTS[secondWeakest] || '') + '. Insert into LMS.\n\nFormat (markdown, under 300 words):\n# Cheatsheet Title\n## Key Formulas / Definitions (3-5 bullets)\n## Quick Comparison Table (markdown table)\n## Step-by-Step Process (4-6 steps)\n## Edge Cases & Gotchas\n\nInsert:\nconst{DatabaseSync}=require("node:sqlite");const db=new DatabaseSync("' + DB_PATH + '");var id="auto_cheat_"+Date.now();db.prepare("INSERT OR IGNORE INTO lms_resources(id,type,title,description,difficulty,semester,subjectCode,subjectName,unit,unitNormalized,tags,uploadedBy,uploadedAt,updatedAt,noteContent,estimatedMinutes,renderType,exportable,isDeleted) VALUES(?,?,\'note\',?,?,?,\'VI\',?,?,?,?,?,\'populator-bot\',datetime(\'now\'),datetime(\'now\'),?,5,\'markdown\',1,0)").run(id,...)\n\nReturn JSON: { id: string, title: string, subjectCode: string, inserted: boolean }', { label: 'cheat', schema: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, subjectCode: { type: 'string' }, inserted: { type: 'boolean' } }, required: ['id', 'title', 'subjectCode', 'inserted'] } })

if (cheatResult && cheatResult.inserted) log('Created cheatsheet: ' + cheatResult.title)

// ──────────────────────────────────────────────
// PHASE 6: Generate Question Bank for low-QB subject
// ──────────────────────────────────────────────
phase('Generate Question Bank')

if (weakestQB.c < 60) {
  log('Adding questions for ' + weakestQB.subjectCode + ' (currently ' + weakestQB.c + ')...')
  var qbResult = await agent('Add 5 new question bank items for ' + weakestQB.subjectCode + ' — ' + (SUBJECTS[weakestQB.subjectCode] || '') + '.\n\nInsert into lms_question_bank:\ndb.prepare("INSERT OR IGNORE INTO lms_question_bank(id,subjectCode,unit,unitNormalized,question,options,correctIndex,explanation,difficulty,contributedBy,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?,datetime(\'now\'))")\n\nUse varying difficulties. Vary the units. Return a summary.\n\nReturn JSON: { added: number, subjectCode: string, difficulties: {easy:number,medium:number,hard:number} }', { label: 'qb', schema: { type: 'object', properties: { added: { type: 'number' }, subjectCode: { type: 'string' }, difficulties: { type: 'object' } }, required: ['added', 'subjectCode', 'difficulties'] } })
  if (qbResult && qbResult.added > 0) { changes.newQB += qbResult.added; log('Added ' + qbResult.added + ' QB items for ' + qbResult.subjectCode) }
}

// ──────────────────────────────────────────────
// PHASE 7: Apply & Report
// ──────────────────────────────────────────────
phase('Apply All')

// Apply rewrites
if (rewrote.length > 0) {
  var payload = rewrote.map(function(c) { return { id: c.id, noteContent: c.noteContent } })
  var writeResult = await sh('node -e \'var fs=require("fs");var d=' + JSON.stringify(payload) + ';fs.writeFileSync("/tmp/lms-fixes.json",JSON.stringify(d));\' && node ' + SCRIPTS + '/apply-improvements.js /tmp/lms-fixes.json')
  var result = JSON.parse(cleanJSON(writeResult.trim().split('\n').pop() || '{}'))
  log('Applied ' + (result.updated || 0) + ' note updates')
}

// Final state
var finalRaw = await sh('node ' + SCRIPTS + '/query-notes.js')
var finalNotes = JSON.parse(cleanJSON(finalRaw))
var fb = finalNotes.filter(function(n) { return n.len < 1000 }).length
var fg = finalNotes.filter(function(n) { return n.len >= 3000 }).length
var favg = Math.round(finalNotes.reduce(function(s, n) { return s + n.len }, 0) / finalNotes.length)

var finalAudit = await sh('node ' + SCRIPTS + '/query-audit.js ' + DB_PATH)

var fa = JSON.parse(cleanJSON(finalAudit))
log('CYCLE COMPLETE:')
log('  Deleted: ' + changes.deleted + ' | Rewrote: ' + changes.rewritten)
log('  New notes: ' + changes.newNotes + ' | Quizzes: ' + changes.newQuizzes + ' | Flashcards: ' + changes.newFlashcards)
log('  New links: ' + changes.newLinks + ' | QB items: ' + changes.newQB)
log('  Total notes: ' + finalNotes.length + ' | Avg: ' + favg + 'c | <1k: ' + fb + ' | >=3k: ' + fg)
log('  Subjects now: ' + fa.subjects.map(function(s) { return s.subjectCode + '(' + s.c + 'res,' + s.types + 'types)' }).join(' | '))
log('  Total question bank: ' + fa.questions)

return {
  pipeline: 'lms-content-populator',
  status: 'complete',
  cycle: {
    deleted: changes.deleted,
    rewritten: changes.rewritten,
    newNotes: changes.newNotes,
    newQuizzes: changes.newQuizzes,
    newFlashcards: changes.newFlashcards,
    newPyqs: changes.newPyqs,
    newLinks: changes.newLinks,
    newQB: changes.newQB,
    enriched: changes.enriched,
  },
  totalAdded: Math.min(changes.newNotes + changes.newQuizzes + changes.newFlashcards + changes.newLinks + changes.newQB, 50),
  finalState: {
    totalNotes: finalNotes.length,
    avgLength: favg,
    thinRemaining: fb,
    goodCount: fg,
    questionBank: fa.questions,
    subjects: fa.subjects,
  },
}