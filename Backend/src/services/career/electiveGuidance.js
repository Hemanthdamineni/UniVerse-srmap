/**
 * electiveGuidance.js — rank a student's available electives against their
 * declared career track(s). Story 4.1 / T4.1.4.
 *
 * Two inputs, both already on the student graph:
 *   - `graph.academic.curriculum.subjects` — the elective courses in the plan
 *   - `graph.intent.targetRoles` / `interestAreas` — the career goal
 *
 * The elective↔track weights live in `data/electiveRoleMap.json` (a keyword
 * seed — see its `_comment`). This module owns the role taxonomy and the free
 * -text → trackId resolution.
 *
 * @module career/electiveGuidance
 */

const path = require("node:path");
const fs = require("node:fs");

/** The recognised career tracks. Keep the ids in sync with electiveRoleMap.json. */
const TRACKS = {
  "software-engineer": "Software Engineer",
  frontend: "Frontend Engineer",
  "ml-ai": "ML / AI Engineer",
  "data-science": "Data Scientist / Analyst",
  "data-engineering": "Data Engineer",
  "devops-cloud": "DevOps / Cloud / SRE",
  security: "Security Engineer",
  "embedded-iot": "Embedded / IoT",
  mobile: "Mobile Developer",
  product: "Product Management",
  "higher-studies": "Research / Higher Studies",
  "core-branch": "Core (branch) roles",
};

// free-text career goal -> trackId, by keyword. A phrase can match several.
const ROLE_KEYWORDS = [
  [/\b(ml engineer|machine learning|artificial intelligence|deep learning|\bnlp\b|computer vision|\bai\b)/, "ml-ai"],
  [/\b(data scien|data analy|analytics|statistic|quant )/, "data-science"],
  [/\b(data eng|\betl\b|big data|data platform|warehous)/, "data-engineering"],
  [/\b(devops|\bsre\b|site reliability|cloud|infra|platform eng|kubernetes)/, "devops-cloud"],
  [/\b(security|infosec|cyber|pentest|appsec)/, "security"],
  [/\b(front[- ]?end|ui eng|react dev|web dev)/, "frontend"],
  [/\b(mobile dev|mobile app|android|\bios\b|flutter|react native)/, "mobile"],
  [/\b(embedded|firmware|\biot\b|\brtos\b|hardware|vlsi)/, "embedded-iot"],
  [/\b(product manage|\bpm\b|product owner|product analyst)/, "product"],
  [/\b(research|\bphd\b|higher stud|masters|academia)/, "higher-studies"],
  [/\b(backend|back[- ]?end|software eng|\bsde\b|full[- ]?stack|\bswe\b)/, "software-engineer"],
];

let cachedMap;
function loadElectiveRoleMap() {
  if (cachedMap !== undefined) return cachedMap;
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "..", "data", "electiveRoleMap.json"), "utf8"),
    );
    delete raw._comment;
    cachedMap = raw;
  } catch {
    cachedMap = {};
  }
  return cachedMap;
}

/** For tests. */
function _resetCache() {
  cachedMap = undefined;
}

/** Resolve free-text career goals to a de-duped list of trackIds. */
function resolveTracks(phrases) {
  const out = new Set();
  for (const phrase of Array.isArray(phrases) ? phrases : []) {
    const text = String(phrase || "").toLowerCase();
    if (!text) continue;
    for (const [re, trackId] of ROLE_KEYWORDS) {
      if (re.test(text)) out.add(trackId);
    }
  }
  return [...out];
}

function str(v) {
  return String(v ?? "").trim();
}

/**
 * @param {object} input
 * @param {Array<{code?:string,name?:string,credit?:number,semester?:number}>} input.subjects
 * @param {string[]} input.targetRoles
 * @param {string[]} [input.interestAreas]
 * @param {number} [input.limit]
 * @returns {{
 *   tracks: Array<{ id: string, label: string, primary: boolean }>,
 *   electives: Array<{ code: string, name: string, credit: number|null, score: number,
 *                      tracks: Array<{ id: string, label: string, weight: number }>, why: string }>
 * }}
 */
function rankElectives({ subjects = [], targetRoles = [], interestAreas = [], limit = 8 } = {}) {
  const map = loadElectiveRoleMap();
  const primary = resolveTracks(targetRoles);
  const secondary = resolveTracks(interestAreas).filter((t) => !primary.includes(t));
  const trackWeight = new Map();
  for (const t of primary) trackWeight.set(t, 1);
  for (const t of secondary) trackWeight.set(t, 0.5);

  const tracks = [
    ...primary.map((id) => ({ id, label: TRACKS[id] || id, primary: true })),
    ...secondary.map((id) => ({ id, label: TRACKS[id] || id, primary: false })),
  ];

  if (trackWeight.size === 0) return { tracks, electives: [] };

  const keywords = Object.keys(map);
  const scored = [];

  for (const subject of Array.isArray(subjects) ? subjects : []) {
    const name = str(subject.name);
    if (!name) continue;
    const haystack = name.toLowerCase();

    // Union the track weights of every seed keyword the elective name contains.
    const perTrack = new Map();
    for (const kw of keywords) {
      if (!haystack.includes(kw)) continue;
      for (const [trackId, weight] of map[kw]) {
        perTrack.set(trackId, Math.max(perTrack.get(trackId) || 0, weight));
      }
    }
    if (perTrack.size === 0) continue;

    let score = 0;
    const matchedTracks = [];
    for (const [trackId, weight] of perTrack) {
      const studentWeight = trackWeight.get(trackId);
      if (!studentWeight) continue;
      score += weight * studentWeight;
      matchedTracks.push({ id: trackId, label: TRACKS[trackId] || trackId, weight });
    }
    if (score <= 0) continue;

    matchedTracks.sort((a, b) => b.weight - a.weight);
    scored.push({
      code: str(subject.code) || null,
      name,
      credit: subject.credit == null ? null : Number(subject.credit),
      score: Math.round(score * 100) / 100,
      tracks: matchedTracks,
      why: `Strong for ${matchedTracks.slice(0, 2).map((t) => t.label).join(", ")}`,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return { tracks, electives: scored.slice(0, Math.max(1, limit)) };
}

/** Pull the inputs out of a full StudentGraph. */
function fromGraph(graph, opts = {}) {
  return rankElectives({
    subjects: graph?.academic?.curriculum?.subjects || [],
    targetRoles: graph?.intent?.targetRoles || [],
    interestAreas: graph?.intent?.interestAreas || [],
    ...opts,
  });
}

module.exports = { TRACKS, resolveTracks, rankElectives, fromGraph, loadElectiveRoleMap, _resetCache };
