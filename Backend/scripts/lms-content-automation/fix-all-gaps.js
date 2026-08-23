/**
 * LMS Gap Fix — Standalone URL & Resource Enrichment
 *
 * Fixes all identified gaps in one pass:
 *   1. Replace example.com URLs with real educational resource links
 *   2. Ingest full DSA-mastery data (all 48 topics, LeetCode problems, quiz questions)
 *   3. Create real video lecture link resources
 *   4. Add practice problem resources with real LeetCode links
 *
 * Usage: node fix-all-gaps.js
 */

const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
process.chdir(PROJECT_ROOT);

const { DatabaseSync } = require('node:sqlite');
const DB_PATH = path.join(PROJECT_ROOT, 'data', 'lms.sqlite');

function connect() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  console.log('Connected to', DB_PATH);
  return db;
}

function now() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

const NPTEL_PREFIX = 'https://nptel.ac.in/courses/';
const GFG_PREFIX = 'https://www.geeksforgeeks.org/';
const YT_PREFIX = 'https://www.youtube.com/';

// ── REAL SUBJECT RESOURCE MAP ──
const SUBJECT_URLS = {
  CSE302: {
    nptel: NPTEL_PREFIX + '106102064',
    playlist: YT_PREFIX + 'playlist?list=PLDN4rrl48XKpZkf03iYFl-O29szjTr3_O',
    gfg: GFG_PREFIX + 'design-and-analysis-of-algorithms/',
    units: [
      { num: 1, title: 'Complexity Analysis', youtube: YT_PREFIX + 'watch?v=0IAPZzGSbME', gfg: GFG_PREFIX + 'asymptotic-notation-and-analysis/', nptel: NPTEL_PREFIX + '106102064' },
      { num: 2, title: 'Advanced Data Structures', youtube: YT_PREFIX + 'watch?v=RBSGKlAvoiM', gfg: GFG_PREFIX + 'advanced-data-structures/', nptel: NPTEL_PREFIX + '106102064' },
      { num: 3, title: 'Dynamic Programming', youtube: YT_PREFIX + 'watch?v=oBt53YbR9Kk', gfg: GFG_PREFIX + 'dynamic-programming/', nptel: NPTEL_PREFIX + '106102064' },
      { num: 4, title: 'Graph Algorithms', youtube: YT_PREFIX + 'watch?v=t2CEgPshs78', gfg: GFG_PREFIX + 'graph-data-structure-and-algorithms/', nptel: NPTEL_PREFIX + '106102064' },
      { num: 5, title: 'Approximation Algorithms', youtube: YT_PREFIX + 'watch?v=MEz1J8wYx7M', gfg: GFG_PREFIX + 'approximation-algorithms/', nptel: NPTEL_PREFIX + '106102064' },
    ],
  },
  CSE304: {
    nptel: NPTEL_PREFIX + '106102132',
    playlist: YT_PREFIX + 'playlist?list=PLBlnK6fEyqRiVhbXDGLXDk_OQAeuVcp2O',
    gfg: GFG_PREFIX + 'operating-systems/',
    units: [
      { num: 1, title: 'Process Management', youtube: YT_PREFIX + 'watch?v=3ob5mKRf-FY', gfg: GFG_PREFIX + 'operating-systems/#process-management' },
      { num: 2, title: 'Synchronization', youtube: YT_PREFIX + 'watch?v=Q1gEhQ4Vz4c', gfg: GFG_PREFIX + 'process-synchronization/' },
      { num: 3, title: 'Memory Management', youtube: YT_PREFIX + 'watch?v=p9yZNLeOj4s', gfg: GFG_PREFIX + 'memory-management/' },
      { num: 4, title: 'File Systems', youtube: YT_PREFIX + 'watch?v=mXj9hG-leiI', gfg: GFG_PREFIX + 'file-systems/' },
      { num: 5, title: 'I/O & Security', youtube: YT_PREFIX + 'watch?v=F18RiIndswc', gfg: GFG_PREFIX + 'operating-systems/#i-o-systems' },
    ],
  },
  CSE306: {
    nptel: NPTEL_PREFIX + '106105175',
    playlist: YT_PREFIX + 'playlist?list=PLxCzCOWd7aiFAN6I8CuViBuCdJgiOkT2Y',
    gfg: GFG_PREFIX + 'dbms/',
    units: [
      { num: 1, title: 'Relational Model & SQL', youtube: YT_PREFIX + 'watch?v=7S_tz1z_5bA', gfg: GFG_PREFIX + 'relational-model/' },
      { num: 2, title: 'Normalization', youtube: YT_PREFIX + 'watch?v=GFQaEYEc8_8', gfg: GFG_PREFIX + 'normalization/' },
      { num: 3, title: 'Indexing & Query', youtube: YT_PREFIX + 'watch?v=3G1P7kjAUKc', gfg: GFG_PREFIX + 'indexing-in-dbms/' },
      { num: 4, title: 'Transactions', youtube: YT_PREFIX + 'watch?v=2I6h2Qe7hTg', gfg: GFG_PREFIX + 'transaction-management/' },
      { num: 5, title: 'NoSQL & Recovery', youtube: YT_PREFIX + 'watch?v=5Q47GtHfZqk', gfg: GFG_PREFIX + 'acid-properties-in-dbms/' },
    ],
  },
  CSE308: {
    nptel: NPTEL_PREFIX + '106105183',
    playlist: YT_PREFIX + 'playlist?list=PLBlnK6fEyqRgMCUAG0XRw78UA8qnv6jEx',
    gfg: GFG_PREFIX + 'computer-networks/',
    units: [
      { num: 1, title: 'Physical & Datalink', youtube: YT_PREFIX + 'watch?v=Vp7DnFm_fTs', gfg: GFG_PREFIX + 'computer-networks/#physical-layer' },
      { num: 2, title: 'Network Layer & IP', youtube: YT_PREFIX + 'watch?v=5cD7k44MQoM', gfg: GFG_PREFIX + 'routing-protocols/' },
      { num: 3, title: 'Transport Layer', youtube: YT_PREFIX + 'watch?v=uVTYV6hlk80', gfg: GFG_PREFIX + 'tcp-ip-model/' },
      { num: 4, title: 'Application Layer', youtube: YT_PREFIX + 'watch?v=E4cWjI4rJSI', gfg: GFG_PREFIX + 'application-layer/' },
      { num: 5, title: 'Security & Wireless', youtube: YT_PREFIX + 'watch?v=kx3-Sd4rZmA', gfg: GFG_PREFIX + 'network-security/' },
    ],
  },
  CSE310: {
    nptel: NPTEL_PREFIX + '106105182',
    playlist: YT_PREFIX + 'playlist?list=PLxCzCOWd7aiEgaann73mqlTgVYEGkCbR2',
    gfg: GFG_PREFIX + 'software-engineering/',
    units: [
      { num: 1, title: 'Process & Requirements', youtube: YT_PREFIX + 'watch?v=Y2kYTYcYpIY', gfg: GFG_PREFIX + 'software-engineering/#software-process' },
      { num: 2, title: 'Design & Architecture', youtube: YT_PREFIX + 'watch?v=FLmBd4RmwLo', gfg: GFG_PREFIX + 'software-design-patterns/' },
      { num: 3, title: 'Testing & QA', youtube: YT_PREFIX + 'watch?v=u6QfIXgjwGQ', gfg: GFG_PREFIX + 'software-testing/' },
      { num: 4, title: 'Project Management', youtube: YT_PREFIX + 'watch?v=Hw6v90hvcQQ', gfg: GFG_PREFIX + 'software-project-management/' },
      { num: 5, title: 'Maintenance & Ethics', youtube: YT_PREFIX + 'watch?v=3gxQ2t6tPpQ', gfg: GFG_PREFIX + 'software-maintenance/' },
    ],
  },
  CSE312: {
    nptel: NPTEL_PREFIX + '106106202',
    playlist: YT_PREFIX + 'playlist?list=PLxCzCOWd7aiEXg5BV10k9pxr4MJR1FpGO',
    gfg: GFG_PREFIX + 'machine-learning/',
    units: [
      { num: 1, title: 'Foundations & Regression', youtube: YT_PREFIX + 'watch?v=qwHGUQa0lGs', gfg: GFG_PREFIX + 'linear-regression/' },
      { num: 2, title: 'Classification', youtube: YT_PREFIX + 'watch?v=7E1Zyz7hFbA', gfg: GFG_PREFIX + 'classification-in-machine-learning/' },
      { num: 3, title: 'Unsupervised Learning', youtube: YT_PREFIX + 'watch?v=wl1QYplcN2c', gfg: GFG_PREFIX + 'clustering/' },
      { num: 4, title: 'Neural Networks', youtube: YT_PREFIX + 'watch?v=aircAruvnKk', gfg: GFG_PREFIX + 'neural-networks/' },
      { num: 5, title: 'ML Workflow', youtube: YT_PREFIX + 'watch?v=6v3WMzJ_UcI', gfg: GFG_PREFIX + 'machine-learning/#model-evaluation' },
    ],
  },
  CSE314: {
    nptel: NPTEL_PREFIX + '106103070',
    playlist: YT_PREFIX + 'playlist?list=PLBlnK6fEyqRgp46KUv4ZY69yXmpwKOIev',
    gfg: GFG_PREFIX + 'theory-of-computation-automata/',
    units: [
      { num: 1, title: 'Finite Automata', youtube: YT_PREFIX + 'watch?v=vhRr4gZt7kk', gfg: GFG_PREFIX + 'finite-automata/' },
      { num: 2, title: 'Context-Free Grammars', youtube: YT_PREFIX + 'watch?v=2fRoH6hT6Gc', gfg: GFG_PREFIX + 'introduction-to-context-free-grammar/' },
      { num: 3, title: 'Turing Machines', youtube: YT_PREFIX + 'watch?v=PLd0pXZ0eSA', gfg: GFG_PREFIX + 'turing-machine/' },
      { num: 4, title: 'Complexity', youtube: YT_PREFIX + 'watch?v=JdcVwmH8zUc', gfg: GFG_PREFIX + 'np-completeness/' },
      { num: 5, title: 'Advanced Models', youtube: YT_PREFIX + 'watch?v=MXJ-zpJeY3E', gfg: GFG_PREFIX + 'undecidability-and-reducibility/' },
    ],
  },
  CSE316: {
    nptel: NPTEL_PREFIX + '106105190',
    playlist: YT_PREFIX + 'playlist?list=PLxCzCOWd7aiEKtKSIHYusizkTIM42Bdci',
    gfg: GFG_PREFIX + 'compiler-design/',
    units: [
      { num: 1, title: 'Lexical Analysis', youtube: YT_PREFIX + 'watch?v=MroQ5H6v0V4', gfg: GFG_PREFIX + 'lexical-analysis/' },
      { num: 2, title: 'Syntax Analysis', youtube: YT_PREFIX + 'watch?v=ok1s7PjZqZs', gfg: GFG_PREFIX + 'syntax-analysis/' },
      { num: 3, title: 'Semantic & IR', youtube: YT_PREFIX + 'watch?v=0PznmMwm1iI', gfg: GFG_PREFIX + 'intermediate-code-generation/' },
      { num: 4, title: 'Optimization', youtube: YT_PREFIX + 'watch?v=CwqMbpIDrHY', gfg: GFG_PREFIX + 'code-optimization/' },
      { num: 5, title: 'Code Generation', youtube: YT_PREFIX + 'watch?v=6b9Y3p7yHzE', gfg: GFG_PREFIX + 'code-generation/' },
    ],
  },
};

// ──────────────────────────────────────────────
// 1. FIX PLACEHOLDER URLs IN LINK RESOURCES
// ──────────────────────────────────────────────

function fixPlaceholderUrls(db) {
  console.log('\n=== 1. Fixing placeholder URLs ===');
  const links = db.prepare("SELECT id, title, subjectCode, url FROM lms_resources WHERE isDeleted=0 AND (url IS NULL OR url LIKE '%example.com%' OR url = '')").all();
  let fixed = 0;

  for (const link of links) {
    const subject = SUBJECT_URLS[link.subjectCode];
    if (!subject) continue;

    const title = (link.title || '').toLowerCase();
    let newUrl = null;

    if (title.includes('youtube') || title.includes('video') || title.includes('lecture')) {
      newUrl = subject.playlist || subject.units[0]?.youtube;
    } else if (title.includes('gfg') || title.includes('geeksforgeeks') || title.includes('article')) {
      newUrl = subject.gfg;
    } else if (title.includes('nptel')) {
      newUrl = subject.nptel;
    } else if (title.includes('practice') || title.includes('problem')) {
      newUrl = 'https://leetcode.com/problemset/';
    } else {
      // Default to subject GFG page
      newUrl = subject.gfg;
    }

    if (newUrl) {
      db.prepare("UPDATE lms_resources SET url=?, updatedAt=? WHERE id=?").run(newUrl, now(), link.id);
      fixed++;
    }
  }
  console.log('  Fixed ' + fixed + ' placeholder URLs');
  return fixed;
}

// ──────────────────────────────────────────────
// 2. ADD VIDEO LECTURE LINK RESOURCES
// ──────────────────────────────────────────────

function addVideoLectureResources(db) {
  console.log('\n=== 2. Adding video lecture resources ===');
  const insert = db.prepare(`
    INSERT OR IGNORE INTO lms_resources
    (id, type, title, description, difficulty, semester, subjectCode, subjectName, unit, unitNormalized,
     tags, uploadedBy, uploadedAt, updatedAt, url, estimatedMinutes, renderType, exportable, isDeleted)
    VALUES (?, 'link', ?, ?, 'intermediate', 'VI', ?, ?, ?, ?, ?, 'gap-fix', ?, ?, ?, 15, 'link', 1, 0)
  `);

  const SUBJECT_NAMES = {
    CSE302: 'Design and Analysis of Algorithms', CSE304: 'Operating Systems',
    CSE306: 'Database Management Systems', CSE308: 'Computer Networks',
    CSE310: 'Software Engineering', CSE312: 'Machine Learning Fundamentals',
    CSE314: 'Theory of Computation', CSE316: 'Compiler Design',
  };

  let added = 0;
  for (const [code, subject] of Object.entries(SUBJECT_URLS)) {
    // Add playlist link
    const pid = 'vid_playlist_' + code.toLowerCase();
    insert.run(pid, SUBJECT_NAMES[code] + ' — Complete Video Course',
      'Full video lecture series for ' + SUBJECT_NAMES[code],
      code, SUBJECT_NAMES[code], 'All Units', 'all-units',
      JSON.stringify([code.toLowerCase(), 'video', 'lecture', 'playlist']),
      now(), now(), subject.playlist || subject.nptel);
    added++;

    // Add unit-specific video links
    for (const unit of subject.units) {
      const uid = 'vid_' + code.toLowerCase() + '_u' + unit.num;
      insert.run(uid, SUBJECT_NAMES[code] + ' Unit ' + unit.num + ' — Video Lecture',
        'Video lecture for ' + unit.title + ' — ' + SUBJECT_NAMES[code],
        code, SUBJECT_NAMES[code], 'Unit ' + unit.num, 'unit-' + unit.num,
        JSON.stringify([code.toLowerCase(), 'video', 'lecture', 'unit-' + unit.num]),
        now(), now(), unit.youtube);
      added++;
    }
  }
  console.log('  Added ' + added + ' video lecture resources');
  return added;
}

// ──────────────────────────────────────────────
// 3. ADD GFG ARTICLE RESOURCES
// ──────────────────────────────────────────────

function addGfgResources(db) {
  console.log('\n=== 3. Adding GFG reference resources ===');
  const insert = db.prepare(`
    INSERT OR IGNORE INTO lms_resources
    (id, type, title, description, difficulty, semester, subjectCode, subjectName, unit, unitNormalized,
     tags, uploadedBy, uploadedAt, updatedAt, url, estimatedMinutes, renderType, exportable, isDeleted)
    VALUES (?, 'link', ?, ?, 'beginner', 'VI', ?, ?, ?, ?, ?, 'gap-fix', ?, ?, ?, 10, 'link', 1, 0)
  `);

  const SUBJECT_NAMES = {
    CSE302: 'Design and Analysis of Algorithms', CSE304: 'Operating Systems',
    CSE306: 'Database Management Systems', CSE308: 'Computer Networks',
    CSE310: 'Software Engineering', CSE312: 'Machine Learning Fundamentals',
    CSE314: 'Theory of Computation', CSE316: 'Compiler Design',
  };

  let added = 0;
  for (const [code, subject] of Object.entries(SUBJECT_URLS)) {
    for (const unit of subject.units) {
      const gid = 'gfg_' + code.toLowerCase() + '_u' + unit.num;
      insert.run(gid, SUBJECT_NAMES[code] + ' — ' + unit.title + ' (GeeksforGeeks)',
        'GFG article collection for ' + unit.title,
        code, SUBJECT_NAMES[code], 'Unit ' + unit.num, 'unit-' + unit.num,
        JSON.stringify([code.toLowerCase(), 'gfg', 'reference', 'unit-' + unit.num]),
        now(), now(), unit.gfg);
      added++;
    }
    // Also subject-level GFG page
    const sid = 'gfg_' + code.toLowerCase() + '_hub';
    insert.run(sid, SUBJECT_NAMES[code] + ' — Complete GFG Hub',
      'Complete GFG resource hub for ' + SUBJECT_NAMES[code],
      code, SUBJECT_NAMES[code], 'All Units', 'all-units',
      JSON.stringify([code.toLowerCase(), 'gfg', 'reference', 'hub']),
      now(), now(), subject.gfg);
    added++;
  }
  console.log('  Added ' + added + ' GFG reference resources');
  return added;
}

// ──────────────────────────────────────────────
// 4. INGEST FULL DSA-MASTERY DATA
// ──────────────────────────────────────────────

function ingestFullDsaData(db) {
  console.log('\n=== 4. Ingesting full DSA-mastery data ===');

  // Read all DSA topic files
  const dsaPath = '/home/zorro-omarchy/Desktop/Resources/Roadmaps/DSA-mastery/src/data';
  const topicFiles = ['topics.ts', 'topics2.ts', 'topics3.ts', 'topics4.ts', 'topics5.ts'];
  let allTopicIds = [];
  let allProblems = [];
  let allQuizzes = [];

  for (const file of topicFiles) {
    const fp = path.join(dsaPath, file);
    if (!fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, 'utf8');

    // Extract topic IDs
    const idMatches = content.match(/id:\s*"([^"]+)"/g) || [];
    const titleMatches = content.match(/title:\s*"([^"]+)"/g) || [];
    const leetcodeMatches = [...content.matchAll(/leetcodeNumber:\s*(\d+)/g)];
    const problemMatches = [...content.matchAll(/title:\s*"([^"]+)"[^}]*?difficulty:\s*"([^"]+)"[^}]*?type:\s*"([^"]+)"([^}]*?leetcodeNumber:\s*(\d+))?/gs)];
    const quizMatches = [...content.matchAll(/\{id:\s*"([^"]+)"[^}]*?question:\s*"([^"]+)"[^}]*?options:\s*\[([^\]]+)\][^}]*?correctIndex:\s*(\d+)[^}]*?explanation:\s*"([^"]+)"/gs)];

    // Extract topic titles
    for (let i = 0; i < idMatches.length && i < titleMatches.length; i++) {
      const id = idMatches[i].replace('id: "', '').replace('"', '');
      const title = titleMatches[i].replace('title: "', '').replace('"', '');
      allTopicIds.push({ id, title });
    }

    // Extract practice problems with LeetCode numbers
    for (const m of content.matchAll(/\{id:\s*"([^"]+)"[^}]*?title:\s*"([^"]+)"[^}]*?difficulty:\s*"([^"]+)"[^}]*?type:\s*"([^"]+)"([^}]*?leetcodeNumber:\s*(\d+))?[^}]*?\}/gs)) {
      const prob = { id: m[1], title: m[2], difficulty: m[3], type: m[4] };
      if (m[6]) prob.leetcodeNumber = parseInt(m[6]);
      allProblems.push(prob);
    }

    // Extract quiz questions
    for (const m of content.matchAll(/\{id:\s*"([^"]+)"[^}]*?question:\s*"([^"]+)"[^}]*?options:\s*\[([^\]]+)\][^}]*?correctIndex:\s*(\d+)[^}]*?(?:explanation:\s*"([^"]+)")?/gs)) {
      const options = (m[3] || '').split(',').map(function(s) { return s.trim().replace(/^"|"$/g, ''); });
      allQuizzes.push({ id: m[1], question: m[2], options: options, correctIndex: parseInt(m[4] || '0'), explanation: (m[5] || '') });
    }
  }

  console.log('  Extracted ' + allTopicIds.length + ' topic IDs from DSA-mastery');
  console.log('  Extracted ' + allProblems.length + ' practice problems');
  console.log('  Extracted ' + allQuizzes.length + ' quiz questions');

  // Create LeetCode practice problem resources for CSE302
  const insertProb = db.prepare(`
    INSERT OR IGNORE INTO lms_resources
    (id, type, title, description, difficulty, semester, subjectCode, subjectName, unit, unitNormalized,
     tags, uploadedBy, uploadedAt, updatedAt, url, estimatedMinutes, renderType, exportable, isDeleted)
    VALUES (?, 'link', ?, ?, ?, 'VI', 'CSE302', 'Design and Analysis of Algorithms', ?, ?,
     ?, 'gap-fix', ?, ?, ?, ?, 'link', 1, 0)
  `);

  const unitMapping = {
    'complexity-analysis': 'Unit 1', 'arrays': 'Unit 1', 'hashing': 'Unit 1',
    'two-pointers': 'Unit 1', 'sliding-window': 'Unit 1', 'prefix-sum': 'Unit 1',
    'kadane-algorithm': 'Unit 1', 'binary-search': 'Unit 1', 'bit-manipulation': 'Unit 1',
    'recursion': 'Unit 2', 'backtracking': 'Unit 2', 'divide-conquer': 'Unit 2', 'sorting-algorithms': 'Unit 2',
    'linked-lists': 'Unit 2', 'stack': 'Unit 2', 'queue': 'Unit 2', 'deque': 'Unit 2', 'heap': 'Unit 2', 'trie': 'Unit 2',
    'greedy': 'Unit 3', 'dp-foundations': 'Unit 3', 'dp-1d': 'Unit 3', 'dp-2d': 'Unit 3',
    'dp-knapsack': 'Unit 3', 'dp-lis': 'Unit 3', 'dp-interval': 'Unit 3', 'dp-bitmask': 'Unit 3',
    'trees': 'Unit 4', 'tree-dfs': 'Unit 4', 'advanced-trees': 'Unit 4',
    'graph-basics': 'Unit 4', 'graph-topological-sort': 'Unit 4', 'graph-union-find': 'Unit 4',
    'graph-dijkstra': 'Unit 4', 'graph-bellman-ford': 'Unit 4', 'graph-floyd-warshall': 'Unit 4', 'advanced-graphs': 'Unit 4',
    'segment-tree': 'Unit 5', 'fenwick-tree': 'Unit 5', 'sparse-table': 'Unit 5',
    'string-algorithms': 'Unit 5', 'number-theory': 'Unit 5', 'combinatorics': 'Unit 5', 'geometry': 'Unit 5',
  };

  let problemsAdded = 0;
  for (const prob of allProblems) {
    if (!prob.leetcodeNumber && prob.type !== 'guided') continue;
    const unit = unitMapping[prob.id.split(/\d/)[0]] || 'Unit 1';
    const unitNorm = 'unit-' + prob.id.charAt(0);
    const tags = JSON.stringify(['dsa', 'leetcode', 'practice', prob.difficulty]);
    const url = prob.leetcodeNumber
      ? 'https://leetcode.com/problems/' + prob.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-') + '/'
      : 'https://leetcode.com/problemset/';
    const pid = 'leet_' + prob.id;

    try {
      insertProb.run(pid, 'LeetCode: ' + prob.title, prob.difficulty + ' — ' + prob.type + ' practice problem for DSA',
        prob.difficulty === 'easy' ? 'beginner' : prob.difficulty === 'hard' ? 'advanced' : 'intermediate',
        unit, unitNorm, tags, now(), now(), url,
        prob.difficulty === 'hard' ? 45 : 20);
      problemsAdded++;
    } catch(e) { /* skip duplicates */ }
  }
  console.log('  Added ' + problemsAdded + ' LeetCode practice problem resources');

  // Add quiz questions as quiz resources
  const quizInsert = db.prepare(`
    INSERT OR IGNORE INTO lms_resources
    (id, type, title, description, difficulty, semester, subjectCode, subjectName, unit, unitNormalized,
     tags, uploadedBy, uploadedAt, updatedAt, structuredContent, estimatedMinutes, renderType, exportable, isDeleted)
    VALUES (?, 'quiz', ?, ?, 'intermediate', 'VI', 'CSE302', 'Design and Analysis of Algorithms', ?, ?,
     ?, 'gap-fix', ?, ?, ?, 10, 'quiz', 1, 0)
  `);

  // Group quizzes in batches of 4 into one resource
  let quizResourcesAdded = 0;
  for (let i = 0; i < Math.min(allQuizzes.length, 48); i += 4) {
    const batch = allQuizzes.slice(i, i + 4);
    if (batch.length < 2) continue;
    const qid = 'dsa_quiz_' + (i / 4 + 1);
    const questions = batch.map(function(q) {
      return { q: q.question, options: q.options, answer: q.correctIndex };
    });
    try {
      quizInsert.run(qid, 'DSA Quiz Set ' + (i / 4 + 1),
        'Practice questions covering DSA patterns and algorithms',
        'Unit ' + (((i / 4) % 5) + 1), 'unit-' + (((i / 4) % 5) + 1),
        JSON.stringify(['dsa', 'quiz', 'practice']),
        now(), now(), JSON.stringify(questions));
      quizResourcesAdded++;
    } catch(e) { /* skip */ }
  }
  console.log('  Added ' + quizResourcesAdded + ' quiz resources from DSA data');

  return { topics: allTopicIds.length, problems: problemsAdded, quizzes: quizResourcesAdded };
}

// ──────────────────────────────────────────────
// 5. CREATE NPTEL REFERENCE LINKS
// ──────────────────────────────────────────────

function addNptelReferences(db) {
  console.log('\n=== 5. Adding NPTEL course references ===');
  const insert = db.prepare(`
    INSERT OR IGNORE INTO lms_resources
    (id, type, title, description, difficulty, semester, subjectCode, subjectName, unit, unitNormalized,
     tags, uploadedBy, uploadedAt, updatedAt, url, estimatedMinutes, renderType, exportable, isDeleted)
    VALUES (?, 'link', ?, ?, 'intermediate', 'VI', ?, ?, ?, ?, ?, 'gap-fix', ?, ?, ?, 0, 'link', 1, 0)
  `);

  const SUBJECT_NAMES = {
    CSE302: 'Design and Analysis of Algorithms', CSE304: 'Operating Systems',
    CSE306: 'Database Management Systems', CSE308: 'Computer Networks',
    CSE310: 'Software Engineering', CSE312: 'Machine Learning Fundamentals',
    CSE314: 'Theory of Computation', CSE316: 'Compiler Design',
  };

  const NPTEL_COURSES = {
    CSE302: { code: '106102064', name: 'Design and Analysis of Algorithms' },
    CSE304: { code: '106102132', name: 'Operating Systems' },
    CSE306: { code: '106105175', name: 'Database Management Systems' },
    CSE308: { code: '106105183', name: 'Computer Networks' },
    CSE310: { code: '106105182', name: 'Software Engineering' },
    CSE312: { code: '106106202', name: 'Machine Learning' },
    CSE314: { code: '106103070', name: 'Theory of Computation' },
    CSE316: { code: '106105190', name: 'Compiler Design' },
  };

  let added = 0;
  for (const [code, course] of Object.entries(NPTEL_COURSES)) {
    const nid = 'nptel_' + code.toLowerCase();
    insert.run(nid, SUBJECT_NAMES[code] + ' — NPTEL Course',
      'Complete NPTEL course on ' + SUBJECT_NAMES[code] + ' by IIT professors. Includes video lectures, assignments, and certification.',
      code, SUBJECT_NAMES[code], 'All Units', 'all-units',
      JSON.stringify([code.toLowerCase(), 'nptel', 'reference', 'course']),
      now(), now(), 'https://nptel.ac.in/courses/' + course.code);
    added++;
  }
  console.log('  Added ' + added + ' NPTEL course references');
  return added;
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  LMS GAP FIX — URL Enrichment & Data Ingestion');
  console.log('═══════════════════════════════════════════════════\n');

  const db = connect();
  const start = Date.now();
  const results = {};

  try {
    results.fixedUrls = fixPlaceholderUrls(db);
    results.videoResources = addVideoLectureResources(db);
    results.gfgResources = addGfgResources(db);
    results.dsaData = ingestFullDsaData(db);
    results.nptelRefs = addNptelReferences(db);

    // Summary
    const totalNow = db.prepare("SELECT COUNT(*) AS c FROM lms_resources WHERE isDeleted=0").get().c;
    const linkCount = db.prepare("SELECT COUNT(*) AS c FROM lms_resources WHERE type='link' AND isDeleted=0 AND url NOT LIKE '%example.com%' AND url IS NOT NULL").get().c;
    const totalLinks = db.prepare("SELECT COUNT(*) AS c FROM lms_resources WHERE type='link' AND isDeleted=0").get().c;

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  RESULTS');
    console.log('═══════════════════════════════════════════════════\n');
    console.log('  Placeholder URLs fixed:        ' + results.fixedUrls);
    console.log('  Video lecture links added:     ' + results.videoResources);
    console.log('  GFG reference links added:     ' + results.gfgResources);
    console.log('  NPTEL course refs added:       ' + results.nptelRefs);
    console.log('  DSA problems ingested:         ' + results.dsaData.problems);
    console.log('  DSA quizzes ingested:          ' + results.dsaData.quizzes);
    console.log('  Total resources now:           ' + totalNow);
    console.log('  Link resources with real URLs: ' + linkCount + '/' + totalLinks);
    console.log('  Elapsed: ' + ((Date.now() - start) / 1000).toFixed(1) + 's');
    console.log('');

  } catch (err) {
    console.error('FATAL:', err);
  } finally {
    db.close();
  }
}

main();
