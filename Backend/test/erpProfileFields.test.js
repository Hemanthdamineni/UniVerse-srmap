const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseName,
  parseRegisterNo,
  parseEmail,
  parseContactNumber,
  parseProgramme,
  parseDegree,
  parseBranch,
  parseSpecialization,
  parseSection,
  parseYear,
} = require("../src/utils/erpProfileFields");

// The real ERP "Profile" page payload (captured under
// data/live-page-audit/.../02-profile/processed-data-no-raw-html.json).
const LIVE = {
  PageHeading: "PROFILE",
  TableContent: {
    "Student Name": "DAMINENI HEMANTH SATYA VEER",
    "Register No.": "AP23110010419",
    Institution: "School of Engineering and Sciences (College)",
    Semester: "VI SEMESTER",
    "Program / Section": "B.Tech.-Computer Science and Engineering [UG - Full Time] / 'J'",
    Specialization: "Artificial Intelligence and Machine Learning",
    "D.O.B. / Gender": "04-May-2006 / Male",
    "Student Contact Number / Email": "9492891632 (Verified ) / hemanthsatyaveer_damineni@srmap.edu.in",
    "Father Name / Mother Name": "Damineni Satish / Damineni Lakshmi Prasanna",
  },
};

// The development demo payload (routes/authRoutes.js buildDemoProfileData).
const DEMO = {
  PageHeading: "PROFILE",
  TableContent: {
    "Student Name": "Hemachandra K",
    Name: "Hemachandra K",
    "Register No.": "AP23110010001",
    Semester: "VI",
    "Academic Year": "III Year",
    "Program / Section": "B.Tech Computer Science and Engineering / A",
    Department: "Computer Science and Engineering",
    "Student E-Mail": "ap23110010001@srmap.edu.in",
    "Student Contact Number": "9000000000",
  },
};

test("parses the live ERP profile shape", () => {
  assert.equal(parseName(LIVE), "DAMINENI HEMANTH SATYA VEER");
  assert.equal(parseRegisterNo(LIVE), "AP23110010419");
  assert.equal(parseEmail(LIVE), "hemanthsatyaveer_damineni@srmap.edu.in");
  assert.equal(parseContactNumber(LIVE), "9492891632");
  assert.equal(
    parseProgramme(LIVE),
    "B.Tech.-Computer Science and Engineering [UG - Full Time]",
  );
  assert.equal(parseDegree(LIVE), "B.Tech");
  assert.equal(parseBranch(LIVE), "Computer Science and Engineering");
  assert.equal(parseSpecialization(LIVE), "Artificial Intelligence and Machine Learning");
  assert.equal(parseSection(LIVE), "J");
  assert.equal(parseYear(LIVE), 3); // VI semester -> year 3
});

test("parses the demo profile shape", () => {
  assert.equal(parseName(DEMO), "Hemachandra K");
  assert.equal(parseRegisterNo(DEMO), "AP23110010001");
  assert.equal(parseEmail(DEMO), "ap23110010001@srmap.edu.in");
  assert.equal(parseContactNumber(DEMO), "9000000000");
  assert.equal(parseDegree(DEMO), "B.Tech");
  assert.equal(parseBranch(DEMO), "Computer Science and Engineering");
  assert.equal(parseSpecialization(DEMO), "");
  assert.equal(parseSection(DEMO), "A");
  assert.equal(parseYear(DEMO), 3); // "III Year"
});

test("degrades gracefully on empty / malformed input", () => {
  for (const bad of [null, undefined, {}, { TableContent: null }, { TableContent: {} }]) {
    assert.equal(parseName(bad), "");
    assert.equal(parseBranch(bad), "");
    assert.equal(parseYear(bad), null);
    assert.equal(parseSection(bad), "");
  }
});

test("branch strips assorted degree prefixes and enrolment brackets", () => {
  const mk = (program) => ({ TableContent: { "Program / Section": program } });
  assert.equal(
    parseBranch(mk("M.Tech.-Electronics and Communication Engineering [PG - Full Time] / 'A'")),
    "Electronics and Communication Engineering",
  );
  assert.equal(parseBranch(mk("BBA-Business Analytics / 'C'")), "Business Analytics");
  assert.equal(parseBranch(mk("B.Sc Physics / A")), "Physics");
});
