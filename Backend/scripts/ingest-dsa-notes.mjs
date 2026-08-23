import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import notes from './notes-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../data/lms.sqlite');

const db = new DatabaseSync(DB_PATH);

const result = { written: 0, skipped: 0, errors: [] };

function unitFromTopicId(topicId) {
  if (/unit-?1/i.test(topicId) || /complexity-analysis|arrays-fundamentals|hashing|two-pointers|sliding-window|prefix-sum|kadane|binary-search|bit-manipulation|core-patterns|problem-solving/.test(topicId)) {
    return { unit: 'Unit 1', unitNormalized: 'unit-1' };
  }
  if (/unit-?2/i.test(topicId) || /recursion|recursive|backtracking|divide.?and.?conquer|sorting/.test(topicId)) {
    return { unit: 'Unit 2', unitNormalized: 'unit-2' };
  }
  if (/linked-list|stack|queue/.test(topicId)) {
    return { unit: 'Unit 3', unitNormalized: 'unit-3' };
  }
  return { unit: 'Unit 1', unitNormalized: 'unit-1' };
}

function sanitizeId(s) {
  return s.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '');
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

try {
  // Step 1: Soft-delete old CSE302 demo notes
  const deleteStmt = db.prepare(
    `UPDATE lms_resources SET isDeleted=1, deletedAt=datetime('now'), deletedBy='ingestion'
     WHERE subjectCode='CSE302' AND type='note' AND (title LIKE 'Demo%' OR noteContent IS NULL OR noteContent='')`
  );
  const deleteResult = deleteStmt.run();
  console.log(`Soft-deleted ${deleteResult.changes} demo notes`);

  // Step 2: Prepare statements
  const insertNote = db.prepare(`
    INSERT OR IGNORE INTO lms_resources (
      id, type, title, description, difficulty, semester, subjectCode, subjectName,
      unit, unitNormalized, tags, uploadedBy, uploadedAt, updatedAt,
      noteContent, estimatedMinutes, renderType, exportable, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTopic = db.prepare(`
    INSERT OR IGNORE INTO lms_topics (id, label, subjectCode, description)
    VALUES (?, ?, ?, ?)
  `);

  const getTopicByLabel = db.prepare(`
    SELECT id FROM lms_topics WHERE label = ?
  `);

  const linkResourceTopic = db.prepare(`
    INSERT OR IGNORE INTO lms_resource_topics (resourceId, topicId) VALUES (?, ?)
  `);

  function ensureTopic(label, subjectCode) {
    // First check if a topic with this label already exists
    const existing = getTopicByLabel.get(label);
    if (existing) return existing.id;
    // Generate ID and insert
    const id = 'topic_' + sanitizeId(label);
    insertTopic.run(id, label, subjectCode, '');
    return id;
  }

  // Step 3: Process each note
  db.exec('BEGIN TRANSACTION');
  try {
    for (const note of notes) {
      try {
        const id = 'dsa_note_' + sanitizeId(note.topicId);
        const tagsJson = JSON.stringify(note.tags || []);
        const u = unitFromTopicId(note.topicId);
        const now = timestamp();

        const insertResult = insertNote.run(
          id,
          'note',
          note.title,
          note.description || '',
          note.difficulty || 'beginner',
          'VI',
          'CSE302',
          'Design and Analysis of Algorithms',
          u.unit,
          u.unitNormalized,
          tagsJson,
          'ingestion-system',
          now,
          now,
          note.noteContent,
          note.estimatedMinutes || null,
          'markdown',
          1,
          0
        );

        if (insertResult.changes > 0) {
          result.written++;

          // Create topic entries for each tag and link resource to topic
          const seenTopics = new Set();
          for (const tag of (note.tags || [])) {
            const tagId = ensureTopic(tag, 'CSE302');
            if (!seenTopics.has(tagId)) {
              seenTopics.add(tagId);
              linkResourceTopic.run(id, tagId);
            }
          }

          // Also link to a topic matching the topicId itself
          const topicLabel = note.topicId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const topicId = ensureTopic(topicLabel, 'CSE302');
          linkResourceTopic.run(id, topicId);
        } else {
          result.skipped++;
        }
      } catch (err) {
        result.errors.push(`Error processing note "${note.topicId}": ${err.message}`);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

} catch (err) {
  result.errors.push(`Fatal error: ${err.message}`);
} finally {
  db.close();
}

console.log(JSON.stringify(result));
