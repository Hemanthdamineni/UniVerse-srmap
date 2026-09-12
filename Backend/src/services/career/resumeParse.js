"use strict";

/**
 * Turn extracted résumé text into a structured record.
 *
 *   parseResume(text, { lexicon }) -> {
 *     name, email, phone, headline,
 *     education:  [{ degree, institution, year, gpa }],
 *     skills:     string[],
 *     projects:   [{ title, subtitle, dateRange, bulletCount }],
 *     experience: [{ title, org, dateRange, bulletCount }],
 *     certifications: string[],
 *     links, hasGithub, hasLinkedin, hasPortfolio,
 *     quantifiedImpacts: string[], sections: string[],
 *     wordCount, layoutWarning
 *   }
 *
 * `lexicon` is an optional array of extra skill strings (e.g. skills required by
 * live opportunities) matched anywhere in the text.
 *
 * Design: key off standard résumé structure — section headings, list
 * delimiters, bullet detection, date ranges, profile-link forms — so it is not
 * tied to one layout. When headings are missing it falls back to classifying
 * text blocks by content.
 */

const {
  canonicalizeSkill,
  canonicalizeSkills,
  isKnownSkill,
} = require("../../utils/skillNames");

// ── small local utils ────────────────────────────────────────────────────────

function toStr(value) {
  return value === null || value === undefined ? "" : String(value);
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const v of values || []) {
    const clean = toStr(v).trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function textIncludesSkill(textLower, skill) {
  const escaped = String(skill).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#.])${escaped}([^a-z0-9+#.]|$)`, "i").test(textLower);
}

// ── section headings ─────────────────────────────────────────────────────────

const RESUME_SECTION_ALIASES = [
  ["summary", /^(professional\s+summary|career\s+summary|summary|profile|professional\s+profile|objective|career\s+objective|about(\s+me)?|overview)$/i],
  ["education", /^(education|academics?|academic\s+background|educational\s+background|qualifications?)$/i],
  ["experience", /^((work|professional|industry|relevant|internship|employment)\s+)?(experience|employment|work\s+history|professional\s+background|professional\s+history|internships?)$/i],
  ["projects", /^((personal|academic|selected|key|notable|technical|major)\s+)?projects?$/i],
  ["skills", /^((technical|core|key|professional|relevant)\s+)?(skills?|technologies|technical\s+proficienc(?:y|ies)|technical\s+expertise|tech\s+stack|tools?\s*&?\s*technologies|competenc(?:y|ies))$/i],
  ["publications", /^(publications?|research(\s+experience)?|papers?)$/i],
  ["coursework", /^((relevant\s+)?coursework|courses?|relevant\s+courses?)$/i],
  ["leadership", /^(leadership(\s*&?\s*community)?|community|activities|extra[\s-]?curriculars?|positions?\s+of\s+responsibility|involvement|volunteering|volunteer(\s+experience)?)$/i],
  ["certifications", /^(certifications?|licenses?\s*&?\s*certifications?|certifications?\s*&?\s*achievements?|achievements?(\s*&?\s*certifications?)?|awards?(\s*&?\s*(?:honou?rs?|achievements?))?|honou?rs?(\s*&?\s*awards?)?)$/i],
  ["interests", /^(interests?|hobbies|interests?\s*&?\s*hobbies)$/i],
  ["references", /^(references?)$/i],
];

const SKILL_CATEGORY_LABEL =
  /^(?:programming\s+)?(?:languages?|frameworks?|libraries|packages?|tools?(?:\s*&?\s*(?:platforms?|technologies))?|platforms?|databases?|data\s?bases?|ai\/?ml|ml\/?ai|machine\s+learning|deep\s+learning|computer\s+vision|nlp|data\s+science|web(?:\s*&?\s*(?:systems?|dev(?:elopment)?))?|systems?|cloud|devops|technologies|concepts?|methodologies|paradigms?|frontend|front[\s-]?end|backend|back[\s-]?end|full[\s-]?stack|mobile|testing|other|misc\.?|core\s+cs|soft\s+skills?)\b\s*[:\-]?\s+/i;

function isBulletLine(line) {
  return /^\s*(?:[•▪‣·◦●○*+‑–—-]|\d+[.)])\s+/.test(line);
}

function stripBullet(line) {
  return line.replace(/^\s*(?:[•▪‣·◦●○*+‑–—-]|\d+[.)])\s+/, "").trim();
}

function matchResumeSectionHeading(line) {
  if (line.length > 48 || isBulletLine(line)) return null;
  const cleaned = line
    .replace(/^[#\s]+/, "")
    .replace(/[:—–\-\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  for (const [key, re] of RESUME_SECTION_ALIASES) if (re.test(cleaned)) return key;
  return null;
}

/** Group résumé lines under their section heading (order preserved). */
function splitResumeSections(lines) {
  const sections = { _preamble: [] };
  const headings = [];
  let current = "_preamble";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const key = matchResumeSectionHeading(line);
    if (key) {
      current = key;
      if (!sections[current]) sections[current] = [];
      headings.push(key);
      continue;
    }
    (sections[current] || (sections[current] = [])).push(line);
  }
  return { sections, headings: uniqueStrings(headings) };
}

// ── line-wrap repair ─────────────────────────────────────────────────────────

/**
 * Join a line onto the previous one when it is an obvious continuation: starts
 * lowercase (or "&"/"and"), the previous line is not a heading, is not a bullet
 * start, and did not already end on sentence punctuation. Fixes PDF exports that
 * wrap a heading like "Google Summer of\nCode".
 */
function looksLikeContactLine(line) {
  return (
    /@/.test(line) ||
    /https?:\/\//.test(line) ||
    /\+?\d[\d ()\-]{7,}\d/.test(line) ||
    (line.match(/\|/g) || []).length >= 2
  );
}

function repairLineWraps(lines) {
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const prev = out[out.length - 1];
    const prevIncomplete =
      prev &&
      (/^(?:[a-z]|&)/.test(line) ||
        /\b(?:of|the|and|for|in|to|a|an|at|on|with|&|per)$/i.test(prev));
    if (
      prev &&
      prevIncomplete &&
      !isBulletLine(line) &&
      !isBulletLine(prev) &&
      !matchResumeSectionHeading(prev) &&
      !matchResumeSectionHeading(line) &&
      !looksLikeContactLine(line) &&
      !looksLikeContactLine(prev) &&
      !looksLikeName(prev) &&
      !/[.:;!?]$/.test(prev) &&
      prev.length < 90
    ) {
      out[out.length - 1] = `${prev} ${line}`;
      continue;
    }
    out.push(line);
  }
  return out;
}

// ── skills ───────────────────────────────────────────────────────────────────

// An unknown token is kept only if it is a single-word "strong" tech token:
// symbol-bearing (C++, F#), an acronym (RTOS, JWT, ES6), or CamelCase (OpenAPI).
function isStrongSkillToken(token) {
  if (!token || token.length > 24 || /[.!?,:;()]/.test(token)) return false;
  if (token.split(/\s+/).filter(Boolean).length !== 1) return false;
  if (/[+#]/.test(token)) return true;
  const compact = token.replace(/[.\-/]/g, "");
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(compact)) return false;
  if (/^[A-Z0-9]{2,6}$/.test(compact)) return true;
  if (/[a-z][A-Z]/.test(compact)) return true;
  if (/\d/.test(compact)) return true;
  return false;
}

/**
 * Skill tokens from "Skills"-like lines. Résumés format these as
 * `Label: a, b | Label2: c, d` with wildly varying labels, so split into
 * segments, strip a leading label from each, then keep a token only when it is a
 * known skill or an unambiguous tech token.
 */
function parseSkillSectionTokens(sectionLines) {
  const out = [];
  for (const raw of sectionLines || []) {
    const text = stripBullet(raw).replace(/\bC\s*\/\s*C\+\+(\s*\/\s*C#)?/gi, (m) =>
      m.includes("#") ? "C, C++, C#" : "C, C++",
    );
    for (let segment of text.split(/\s*[|•●]\s*/)) {
      segment = segment
        .replace(/\([^)]*\)/g, " ")
        .replace(/^\s*[A-Za-z][A-Za-z0-9 /&+.-]{0,30}?:\s*/, "")
        .replace(/\b(?:proficient|familiar(?:ity)?|working knowledge|advanced|intermediate|beginner|expert|fluent|basic)\s*:?\s*/gi, "")
        .replace(SKILL_CATEGORY_LABEL, "");
      for (let token of segment.split(/[,;·]|\s+\/\s+|\s{3,}|\s+[–—]\s+|\s+&\s+/)) {
        token = token.replace(/[.,;:]+$/, "").trim();
        if (!token || !/[A-Za-z]/.test(token) || token.includes(":")) continue;
        if (isKnownSkill(token)) out.push(canonicalizeSkill(token));
        else if (isStrongSkillToken(token)) out.push(token);
      }
    }
  }
  return out;
}

// ── dates & entries ──────────────────────────────────────────────────────────

const MONTHS_RE = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?/i;
const DATE_RANGE_BODY =
  `(?:${MONTHS_RE.source}\\s*)?(?:19|20)\\d{2}\\s*(?:[–—-]|to|·|\\|)\\s*(?:(?:${MONTHS_RE.source}\\s*)?(?:19|20)\\d{2}|present|current|ongoing|now)`;
const DATE_RANGE_TAIL_RE = new RegExp(`\\s*${DATE_RANGE_BODY}\\s*$`, "i");
const DATE_RANGE_ANY_RE = new RegExp(DATE_RANGE_BODY, "i");

function cleanEntryText(value) {
  return value
    .replace(/\s*\[[^\]]*\]\s*/g, " ")
    .replace(/\s*\(\s*\)\s*/g, " ")
    .replace(/\b(?:github|gitlab|bitbucket|link|live\s*demo|demo|source|code|paper|certificate|cert|badges?|website|repo)\b/gi, "")
    .replace(/[§ïï•]/g, "")
    .replace(/\s{2,}.*$/, "")
    .replace(/[\s\-–—|,:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Distinct entries in a projects/experience section, as objects:
 *   { title, subtitle|org, dateRange, bulletCount }
 */
function parseResumeEntries(sectionLines, orgKey) {
  const lines = sectionLines || [];
  const entries = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (isBulletLine(line) || line.length < 4) continue;
    const looksLikeHeader =
      line.includes("|") ||
      /\b(?:19|20)\d{2}\b/.test(line) ||
      /\b(?:present|current|ongoing)\b/i.test(line);
    if (!looksLikeHeader) continue;

    const dateMatch = line.match(DATE_RANGE_ANY_RE);
    const dateRange = dateMatch ? dateMatch[0].replace(/\s+/g, " ").trim() : "";
    const withoutDate = line
      .replace(DATE_RANGE_ANY_RE, " ")
      // a lone employment-type qualifier only when it trails the whole line
      .replace(/\s+(?:full[\s-]?time|part[\s-]?time|internship|contract|freelance|remote|on[\s-]?site|hybrid)\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const parts = withoutDate.split(/\s*(?:\||–|—| - |,\s|·)\s*/).map((p) => p.trim()).filter(Boolean);
    const title = cleanEntryText(parts[0] || withoutDate);
    const subtitle = parts.length > 1 ? cleanEntryText(parts.slice(1).join(" · ")) : "";
    if (title.length < 2) continue;

    let bulletCount = 0;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (isBulletLine(lines[j])) bulletCount += 1;
      else if (matchResumeSectionHeading(lines[j])) break;
      else if (/\b(?:19|20)\d{2}\b/.test(lines[j]) || lines[j].includes("|")) break;
    }
    const entry = { title, dateRange, bulletCount };
    entry[orgKey || "subtitle"] = subtitle;
    entries.push(entry);
  }
  return entries;
}

function parseResumeCertifications(sectionLines) {
  const out = [];
  for (const raw of sectionLines || []) {
    for (let part of stripBullet(raw).split(/\s*\|\s*/)) {
      part = part.trim();
      if (/^https?:\/\//i.test(part)) continue;
      if (
        /^(?:certification|certificate|certified)\b/i.test(part) ||
        /\b(?:certified|certification)\b/i.test(part.slice(0, 60)) ||
        /\b(?:oracle|google cloud|aws certified|microsoft certified|azure fundamentals|comptia|cisco|ccna|pmp|hackerrank|coursera|nptel|udemy|datacamp|deeplearning\.ai|scrum\s+master)\b/i.test(part)
      ) {
        const clean = part
          .replace(/^(?:certification|certificate)\s*[:\-]\s*/i, "")
          .replace(/\s*\[[^\]]*\]\s*/g, " ")
          .replace(/\s+(?:badges?|certificate|link|verify|view)\s*$/i, "")
          .replace(/\s+/g, " ")
          .trim();
        if (clean.length >= 3) out.push(clean);
      }
    }
  }
  return out;
}

// ── identity / education / headline ──────────────────────────────────────────

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d[\d\s().-]{7,}\d/;
const DEGREE_RE =
  /\b(?:B\.?\s?Tech|B\.?\s?E\b|B\.?\s?Sc|B\.?\s?A\b|B\.?\s?Com|BCA|BBA|M\.?\s?Tech|M\.?\s?E\b|M\.?\s?Sc|M\.?\s?A\b|MBA|MCA|Ph\.?\s?D|Bachelor(?:'s)?|Master(?:'s)?|Diploma|Intermediate|Higher\s+Secondary|Class\s+(?:X|XII|10|12))\b[^,\n|]*/i;

function looksLikeName(line) {
  if (!line || line.length > 48 || /\d|@|https?:|\|/.test(line)) return false;
  if (matchResumeSectionHeading(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  return words.every((w) => /^[A-Z][A-Za-z.'-]*$/.test(w) || /^[A-Z][A-Z.'-]+$/.test(w));
}

function extractName(lines, contactIndex) {
  for (let i = 0; i < Math.min(lines.length, 6); i += 1) {
    if (looksLikeName(lines[i])) return lines[i].replace(/\s+/g, " ").trim();
  }
  if (contactIndex > 0) {
    const above = lines[contactIndex - 1];
    if (above && above.length <= 48 && !/\d|@/.test(above)) return above.replace(/\s+/g, " ").trim();
  }
  return "";
}

function extractPhone(text) {
  // Look only near the top of the résumé so long numeric strings deeper in the
  // body (scores, IDs) are not misread as a phone number.
  const head = text.replace(/https?:\/\/\S+/g, " ").split(/\r?\n/).slice(0, 8).join("\n");
  for (const m of head.matchAll(new RegExp(PHONE_RE.source, "gi"))) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 13) {
      return m[0].replace(/[\s.]+/g, " ").replace(/^[\s(]+|[\s)]+$/g, "").trim();
    }
  }
  return "";
}

const INSTITUTION_RE =
  /\b(?:University|College|Institute|Institution|School\s+of|Polytechnic|Vidyalaya|IIT|NIT|BITS|IIIT)\b/i;

function parseEducation(sectionLines) {
  const rows = [];
  const lines = (sectionLines || []).map(stripBullet).filter(Boolean);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const degMatch = line.match(DEGREE_RE);
    const hasInstitution = INSTITUTION_RE.test(line);
    // The line itself must carry a degree or an institution — not just a
    // neighbouring prose sentence.
    if (!degMatch && !hasInstitution) continue;

    // Blocks are usually two adjacent lines: institution then degree (or vice
    // versa). Only look one line ahead/back, and only if that line is itself
    // education-shaped.
    const near = [line];
    for (const j of [i - 1, i + 1]) {
      const n = lines[j];
      if (n && (DEGREE_RE.test(n) || INSTITUTION_RE.test(n) || /\b(?:C?GPA|CGPA|\d\.\d\s*\/\s*\d)\b/i.test(n) || /\b(?:19|20)\d{2}\b/.test(n))) {
        near.push(n);
      }
    }
    const context = near.join(" ");
    const gpaMatch = context.match(/\b(?:C?GPA|percentage|marks)\s*[:\-]?\s*(\d{1,2}(?:\.\d+)?)\s*(?:\/\s*\d{1,3}(?:\.\d+)?)?/i);
    const yearMatch = context.match(/\b(?:19|20)\d{2}\b/g);
    const instMatch = context.match(/[A-Z][A-Za-z.&,'’ -]{2,60}?\b(?:University|College|Institute|Polytechnic)\b/);

    let degree = degMatch ? degMatch[0].replace(/\s+/g, " ") : "";
    // Trim an unbalanced trailing "(", stray punctuation, and a dangling "in".
    degree = degree.replace(/\s*\([^)]*$/, "").replace(/[\s,(–-]+$/, "").replace(/\s+in$/i, "").trim();

    const row = {
      degree,
      institution: instMatch ? instMatch[0].replace(/\s+/g, " ").trim() : "",
      year: yearMatch ? yearMatch[yearMatch.length - 1] : "",
      gpa: gpaMatch ? gpaMatch[1] : "",
    };
    if (!row.degree && !row.institution) continue;
    // Reject prose false-positives. A specific degree abbreviation stands on its
    // own; a loose "Bachelor/Master" word needs corroboration (institution / year
    // / gpa), as does an institution-only row.
    const specificDegree =
      /\b(?:B\.?\s?Tech|B\.?\s?E\b|B\.?\s?Sc|BCA|BBA|B\.?\s?Com|M\.?\s?Tech|M\.?\s?E\b|M\.?\s?Sc|MBA|MCA|Ph\.?\s?D|Diploma|Class\s+(?:X|XII|10|12))/i.test(
        row.degree,
      );
    if (!specificDegree && !row.institution && !row.year && !row.gpa) continue;

    const merged = rows.find(
      (r) =>
        (r.institution && row.institution && r.institution === row.institution) ||
        (r.degree && row.degree && r.degree === row.degree),
    );
    if (merged) {
      merged.degree = merged.degree || row.degree;
      merged.institution = merged.institution || row.institution;
      merged.year = merged.year || row.year;
      merged.gpa = merged.gpa || row.gpa;
    } else {
      rows.push(row);
    }
  }
  return rows.slice(0, 4);
}

function extractHeadline(sections) {
  const source = sections.summary && sections.summary.length ? sections.summary : sections._preamble;
  if (!source) return "";
  const usable = source.filter((l) => {
    if (isBulletLine(l) || EMAIL_RE.test(l) || /https?:\/\//.test(l)) return false;
    if (/\+?\d[\d ()\-]{7,}\d/.test(l)) return false; // contact line
    if ((l.match(/\|/g) || []).length >= 2) return false; // pipe-delimited header row
    // enough real words, not an icon-glyph noise line
    return (l.match(/\b[A-Za-z]{3,}\b/g) || []).length >= 6;
  });
  return usable.join(" ").replace(/\s+/g, " ").trim().slice(0, 300);
}

// ── profile links ────────────────────────────────────────────────────────────

function extractResumeProfiles(text) {
  const links = new Set();
  for (const m of text.matchAll(/https?:\/\/[^\s)\]}>,|]+/gi)) {
    links.add(m[0].replace(/[.,;)]+$/, ""));
  }
  const first = (...res) => {
    for (const re of res) {
      const m = text.match(re);
      if (m) return m[1];
    }
    return null;
  };
  const gh = first(
    /\bgithub\.com\/([A-Za-z0-9][A-Za-z0-9-]{0,38})/i,
    /\bGH\s*[:\-]\s*([A-Za-z0-9][\w.-]*)/i,
    /\bgithub\s*[:\-]\s*([A-Za-z0-9][\w.-]*)/i,
  );
  const ln = first(
    /\blinkedin\.com\/(?:in|pub)\/([\w.-]+)/i,
    /\bLN\s*[:\-]\s*(?:in\/)?([\w.-]+)/i,
    /\blinkedin\s*[:\-]\s*(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/)?(?:in\/)?([\w.-]+)/i,
    /(?:^|[\s|(])in\/([A-Za-z0-9][\w-]{2,})\/?/,
  );
  const lc = first(
    /\bleetcode\.com\/(?:u\/)?([\w.-]+)/i,
    /\bLC\s*[:\-]\s*(?:u\/)?([\w.-]+)/i,
    /(?:^|[\s|(])u\/([A-Za-z0-9][\w-]{2,})\/?/,
  );
  const pages = first(
    /\b([A-Za-z0-9-]+\.github\.io)\b/i,
    /\b([A-Za-z0-9-]+\.(?:vercel|netlify)\.app)\b/i,
  );
  if (gh) links.add(`https://github.com/${gh}`);
  if (ln) links.add(`https://linkedin.com/in/${String(ln).replace(/\/$/, "")}`);
  if (lc) links.add(`https://leetcode.com/u/${String(lc).replace(/\/$/, "")}`);
  if (pages) links.add(`https://${pages.toLowerCase()}`);
  const list = [...links];
  const PORTFOLIO_NOISE =
    /(?:drive|docs|sites)\.google\.com|doi\.org|mdpi\.com|\.edu(?:\.[a-z]{2})?[/:]|catalog-education\.oracle\.com|credly\.com|sharebadge|certview|coursera\.org\/(?:account|verify)/i;
  return {
    links: list,
    hasGithub: Boolean(gh) || /\bgithub\.com\/[\w-]+/i.test(text),
    hasLinkedin: Boolean(ln) || /\blinkedin\.com\/(?:in|pub)\/[\w-]+/i.test(text),
    hasPortfolio:
      Boolean(lc) ||
      Boolean(pages) ||
      list.some(
        (u) => !/github\.com|linkedin\.com|leetcode\.com|mailto:/i.test(u) && !PORTFOLIO_NOISE.test(u),
      ),
  };
}

// ── heading-less fallback ────────────────────────────────────────────────────

/**
 * Best-effort section inference for résumés with no headings: a comma-dense
 * line is a skills line; a date-bearing non-bullet line starts an
 * experience/project entry that owns the bullets beneath it.
 */
function classifyBlocks(lines) {
  const inferred = { skills: [], experience: [], projects: [], education: [] };
  const dateLine = new RegExp(DATE_RANGE_BODY, "i");
  let mode = null; // "experience" | "projects" | "education"
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const commaCount = (line.match(/,/g) || []).length;
    const items = line.split(/\s*,\s*/);

    if (
      !isBulletLine(line) &&
      commaCount >= 4 &&
      items.every((it) => it.split(/\s+/).length <= 4) &&
      !dateLine.test(line)
    ) {
      inferred.skills.push(line);
      mode = null;
      continue;
    }

    if (!isBulletLine(line) && dateLine.test(line)) {
      if (
        (DEGREE_RE.test(line) || INSTITUTION_RE.test(line)) &&
        !/\bintern|engineer|developer|analyst|manager|lead|consultant\b/i.test(line)
      ) {
        inferred.education.push(line, lines[i + 1] || "");
        mode = "education";
      } else if (/\bintern|engineer|developer|analyst|manager|lead|consultant|scientist|architect\b/i.test(line)) {
        inferred.experience.push(line);
        mode = "experience";
      } else {
        inferred.projects.push(line);
        mode = "projects";
      }
      continue;
    }

    if (isBulletLine(line) && mode && mode !== "education") {
      inferred[mode].push(line);
    }
  }
  return inferred;
}

// ── main ─────────────────────────────────────────────────────────────────────

function parseResume(text, { lexicon = [] } = {}) {
  const extractedText = toStr(text).slice(0, 200000);
  // resumeText.js appends discovered PDF link annotations as a trailing
  // "Links:\n<urls>" block — keep it for link detection, strip URLs for prose.
  const bodyText = extractedText.split(/\n{2,}Links:\n/)[0].replace(/https?:\/\/\S+/gi, " ");
  const lowerBody = bodyText.toLowerCase();

  let lines = repairLineWraps(bodyText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
  const contactIndex = lines.findIndex((l) => EMAIL_RE.test(l) || /\+?\d[\d ()\-]{7,}\d/.test(l));

  let { sections, headings } = splitResumeSections(lines);

  // Heading-less résumés: infer sections from block content.
  let layoutWarning = "";
  const wordCount = extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0;
  const hasStructureSignal = new RegExp(DATE_RANGE_BODY, "i").test(bodyText);
  if (headings.length < 2 && (wordCount > 90 || hasStructureSignal)) {
    const inferred = classifyBlocks(lines);
    for (const key of ["skills", "experience", "projects", "education"]) {
      if (!(sections[key] || []).length && inferred[key].length) {
        sections[key] = inferred[key];
        if (!headings.includes(key)) headings.push(key);
      }
    }
    if (headings.length < 2) layoutWarning = "no-sections";
  }

  const declared = parseSkillSectionTokens([...(sections.skills || []), ...(sections.summary || [])]);
  const mentioned = uniqueStrings(lexicon).filter((s) => textIncludesSkill(lowerBody, s));
  const skills = canonicalizeSkills([...declared, ...mentioned]).slice(0, 40);

  const quantifiedImpacts = uniqueStrings(
    Array.from(
      bodyText.matchAll(
        /(?:\b\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?\s*(?:x|ms|fps|F1|BLEU)\b|\b\d+\s*[–—-]\s*\d+\s*(?:ms|s|%)|\b\d+\+?(?:[^\S\n]+[A-Za-z][\w-]*){0,3}[^\S\n]+(?:users|students|people|officials|customers|requests|queries|participants|teams|apis|features|dashboards|models|agents|pipelines|classifiers|variants|backends|repos|papers|hackathons|workshops|downloads|commits))/gi,
      ),
    ).map((m) => m[0].replace(/\s+/g, " ").trim()),
  );

  const projects = parseResumeEntries(sections.projects, "subtitle").slice(0, 10);
  const experience = parseResumeEntries(sections.experience, "org").slice(0, 10);
  const certifications = parseResumeCertifications(sections.certifications).slice(0, 10);
  const profiles = extractResumeProfiles(extractedText);
  const education = parseEducation(sections.education);
  const emailMatch = extractedText.match(EMAIL_RE);

  return {
    name: extractName(lines, contactIndex),
    email: emailMatch ? emailMatch[0] : "",
    phone: extractPhone(bodyText),
    headline: extractHeadline(sections),
    education,
    skills,
    projects,
    experience,
    certifications,
    links: uniqueStrings(profiles.links),
    hasGithub: profiles.hasGithub,
    hasLinkedin: profiles.hasLinkedin,
    hasPortfolio: profiles.hasPortfolio,
    quantifiedImpacts,
    sections: uniqueStrings(headings),
    wordCount,
    layoutWarning,
  };
}

module.exports = {
  parseResume,
  // exported for unit tests
  splitResumeSections,
  parseSkillSectionTokens,
  parseResumeEntries,
  parseEducation,
  repairLineWraps,
  extractName,
};
