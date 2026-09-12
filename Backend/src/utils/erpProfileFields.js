"use strict";

/**
 * Pure parsers for the ERP "Profile" page `TableContent`.
 *
 * The live ERP payload and the development demo payload use slightly different
 * keys and value formats; every parser here accepts both. This mirrors the
 * frontend reference implementation in
 * `Frontend/src/lib/erp/profileTransformers.ts` — keep the two in step.
 *
 * Real shape (captured):
 *   "Student Name": "DAMINENI HEMANTH SATYA VEER"
 *   "Register No.": "AP23110010419"
 *   "Semester": "VI SEMESTER"                      (no "Academic Year" key)
 *   "Program / Section": "B.Tech.-Computer Science and Engineering [UG - Full Time] / 'J'"
 *   "Specialization": "Artificial Intelligence and Machine Learning"
 *   "Student Contact Number / Email": "9492891632 (Verified ) / x@srmap.edu.in"
 *
 * Demo shape:
 *   "Program / Section": "B.Tech Computer Science and Engineering / A"
 *   "Department": "Computer Science and Engineering"
 *   "Academic Year": "III Year"
 *   "Student E-Mail": "x@srmap.edu.in"
 */

const DEGREE_PREFIXES = [
  "Integrated M.Tech",
  "Dual Degree",
  "B.Tech",
  "M.Tech",
  "B.E",
  "M.E",
  "B.Sc",
  "M.Sc",
  "B.A",
  "M.A",
  "B.Com",
  "M.Com",
  "B.Des",
  "M.Des",
  "B.Arch",
  "M.Arch",
  "B.Pharm",
  "M.Pharm",
  "B.Ed",
  "M.Ed",
  "Ph.D",
  "BBA",
  "MBA",
  "BCA",
  "MCA",
  "LLB",
  "LLM",
];

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

function tableContent(profileData) {
  return (profileData && typeof profileData === "object" && profileData.TableContent) || {};
}

function readField(table, ...keys) {
  for (const key of keys) {
    const value = table[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** "A / B / C" -> ["A", "B / C"]. */
function splitCompound(value, separator = " / ") {
  if (!value) return ["", ""];
  const parts = String(value).split(separator).map((part) => part.trim());
  return [parts[0] || "", parts.slice(1).join(separator).trim()];
}

function stripVerifiedMarker(value) {
  return String(value || "")
    .replace(/\s*\((?:un)?verified\s*\)\s*/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function romanOrIntToNumber(token) {
  const raw = String(token || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!raw) return null;
  if (ROMAN[raw]) return ROMAN[raw];
  const digits = raw.match(/\d+/);
  return digits ? Number.parseInt(digits[0], 10) : null;
}

function degreePrefixRegExp(degree) {
  const escaped = degree.replace(/\./g, "\\.?").replace(/\s+/g, "\\s+");
  return new RegExp(`^\\s*${escaped}\\s*[.\\-–:]*\\s*`, "i");
}

function parseName(profileData) {
  return readField(tableContent(profileData), "Student Name", "Name");
}

function parseRegisterNo(profileData) {
  return readField(
    tableContent(profileData),
    "Register No.",
    "Register No",
    "Register Number",
    "Registration Number",
    "Student ID",
  );
}

function parseEmail(profileData) {
  const table = tableContent(profileData);
  const direct = readField(table, "Student E-Mail", "Student Email", "Email");
  if (direct) return direct;
  const compound = readField(
    table,
    "Student Contact Number / Email",
    "Student Contact No / Email",
    "Contact Number / Email",
  );
  if (!compound) return "";
  return (
    compound
      .split(" / ")
      .map((part) => stripVerifiedMarker(part))
      .find((part) => part.includes("@")) || ""
  );
}

function parseContactNumber(profileData) {
  const table = tableContent(profileData);
  const direct = readField(table, "Student Contact Number", "Contact Number", "Mobile Number");
  if (direct) return stripVerifiedMarker(direct);
  const [first] = splitCompound(
    readField(table, "Student Contact Number / Email", "Contact Number / Email"),
  );
  return stripVerifiedMarker(first);
}

/** Section-stripped programme string, e.g. "B.Tech.-Computer Science and Engineering [UG - Full Time]". */
function parseProgramme(profileData) {
  const table = tableContent(profileData);
  const [program] = splitCompound(
    readField(table, "Program / Section", "Programme / Section", "Program", "Programme"),
  );
  return program;
}

/** Just the degree label, e.g. "B.Tech". */
function parseDegree(profileData) {
  const programme = parseProgramme(profileData);
  if (!programme) return "";
  for (const degree of DEGREE_PREFIXES) {
    if (degreePrefixRegExp(degree).test(programme)) return degree;
  }
  const match = programme.match(/^\s*([A-Za-z][A-Za-z.]*)/);
  return match ? match[1] : "";
}

/**
 * The academic branch: degree prefix and enrolment-type bracket removed.
 * "B.Tech.-Computer Science and Engineering [UG - Full Time]" -> "Computer Science and Engineering"
 * Falls back to an explicit "Department"/"Branch" key, then the programme string.
 */
function parseBranch(profileData) {
  const table = tableContent(profileData);
  const programme = parseProgramme(profileData);
  if (programme) {
    let cleaned = programme.replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s+/g, " ").trim();
    for (const degree of DEGREE_PREFIXES) {
      const re = degreePrefixRegExp(degree);
      if (re.test(cleaned)) {
        cleaned = cleaned.replace(re, "").trim();
        break;
      }
    }
    if (cleaned && cleaned.toLowerCase() !== programme.trim().toLowerCase()) return cleaned;
  }
  return readField(table, "Department", "Branch") || programme;
}

function parseSpecialization(profileData) {
  return readField(tableContent(profileData), "Specialization");
}

function parseSection(profileData) {
  const table = tableContent(profileData);
  const [, section] = splitCompound(readField(table, "Program / Section", "Programme / Section"));
  const value = section || readField(table, "Section");
  return value.replace(/^['"‘’]+|['"‘’]+$/g, "").trim();
}

function parseInstitution(profileData) {
  return readField(tableContent(profileData), "Institution", "School");
}

function parseSemesterNumber(profileData) {
  const semester = readField(tableContent(profileData), "Semester", "Current Semester");
  if (!semester) return null;
  const n = romanOrIntToNumber(semester.split(/\s+/)[0]);
  return n && n >= 1 && n <= 12 ? n : null;
}

/** Academic year (1-6). Uses "Academic Year" when present, else derives from the semester. */
function parseYear(profileData) {
  const academicYear = readField(tableContent(profileData), "Academic Year", "A.Y.");
  if (academicYear) {
    const n = romanOrIntToNumber(academicYear.split(/\s+/)[0]);
    if (n && n >= 1 && n <= 6) return n;
  }
  const semester = parseSemesterNumber(profileData);
  return semester ? Math.ceil(semester / 2) : null;
}

module.exports = {
  parseName,
  parseRegisterNo,
  parseEmail,
  parseContactNumber,
  parseProgramme,
  parseDegree,
  parseBranch,
  parseSpecialization,
  parseSection,
  parseInstitution,
  parseSemesterNumber,
  parseYear,
};
