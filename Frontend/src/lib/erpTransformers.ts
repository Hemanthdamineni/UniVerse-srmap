/**
 * erpTransformers.ts
 *
 * Central transformation layer for all ERP page data.
 *
 * Pipeline:
 *   Raw ERP Batch Response
 *     → normalizeRawValue()       [global: no object leakage, primitives only]
 *     → Page-specific transformer  [structured domain model per renderer]
 *     → Renderer receives clean typed model
 *
 * Rules:
 * - ALL transformers live here, not inside page components
 * - NO heuristics (string length, string content detection)
 * - NO side effects — pure functions only
 * - Every transformer maps raw data to a fully typed, validated model
 * - Unknown/unmapped keys are explicitly discarded
 */

// ---------------------------------------------------------------------------
// IMPORTS
// ---------------------------------------------------------------------------
import type { PageBlueprint } from "../config/erpBlueprints";
import { sanitizeErpDisplayText } from "./erpDisplayText";

// ---------------------------------------------------------------------------
// 1. GLOBAL NORMALIZER
//    Converts any raw ERP value to a safe string. Never returns objects.
// ---------------------------------------------------------------------------

export function normalizeRawValue(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const cleaned = sanitizeErpDisplayText(value, fallback);
    return cleaned || fallback;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  // Objects and arrays are NOT displayable — return fallback, not [object Object]
  return fallback;
}

// ---------------------------------------------------------------------------
// 2. ATTENDANCE TRANSFORMER
// ---------------------------------------------------------------------------

export interface AttendanceRecord {
  subjectCode: string;
  subjectDescription: string;
  classesConducted: number;
  attendanceEntered: number;
  odMlTaken: number;
  present: number;
  odMlApprovedPct: number;
  attendancePct: number;
}

export interface AttendanceModel {
  records: AttendanceRecord[];
  notes: string[];
}

/**
 * Classifies a raw attendance table row.
 * Returns "record" | "note" | "skip"
 * 
 * Classification is based on structural shape, NOT string content heuristics.
 * A valid record row has a non-empty Subject Code that matches the course code pattern.
 * A note row has a Subject Code that does not match this pattern.
 */
function classifyAttendanceRow(row: Record<string, unknown>): "record" | "note" | "skip" {
  const code = normalizeRawValue(row["Subject Code"]);
  if (!code || code === "-") return "skip";
  // Course codes are short alphanumeric tokens (e.g., "CSE 304", "MCE 244")
  // This is a structural check, not a string content heuristic
  if (/^[A-Z]{2,5}\s*\d{3,4}[A-Z]?$/i.test(code)) return "record";
  return "note";
}

export function transformAttendance(rawData: unknown): AttendanceModel {
  const records: AttendanceRecord[] = [];
  const notes: string[] = [];

  const data = rawData as Record<string, unknown>;
  const details = (data?.Academic as Record<string, unknown>)?.["Attendance Details"] as Record<string, unknown>;
  if (!details?.tables || !Array.isArray(details.tables)) return { records, notes };

  // Find the primary data table: the one with at least 3 rows
  let targetTable: Record<string, unknown>[] | null = null;
  for (const table of details.tables as unknown[]) {
    if (Array.isArray(table) && table.length > 2) {
      targetTable = table as Record<string, unknown>[];
      break;
    }
  }

  if (!targetTable) return { records, notes };

  for (const row of targetTable) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const classification = classifyAttendanceRow(r);

    if (classification === "skip") continue;

    if (classification === "note") {
      const note = normalizeRawValue(r["Subject Code"]);
      if (note) notes.push(note);
      continue;
    }

    // classification === "record"
    const parseNum = (keys: string[]): number => {
      for (const k of keys) {
        const value = r[k];
        if (value !== undefined) {
           const v = normalizeRawValue(value);
           const n = parseFloat(v);
           if (!isNaN(n)) return n;
        }
      }
      return 0;
    };

    const conducted = parseNum(["ClassesConducted", "Classes Conducted"]);
    const entered = parseNum(["Attendance Entered (Slots)", "Attendance\nEntered\n(Slots)"]);
    const odMl = parseNum(["OD/ML Taken", "OD/ML\nTaken"]);
    const present = parseNum(["Present(P)", "Present (P)"]);
    const odMlPct = parseNum(["OD ML % approved", "OD ML % Approved", "OD ML %\nApproved"]);
    const attendancePct = parseNum(["Attendance %", "Attendance\n%"]);

    records.push({
      subjectCode: normalizeRawValue(r["Subject Code"]),
      subjectDescription: normalizeRawValue(r["Subject Description"]),
      classesConducted: conducted,
      attendanceEntered: entered,
      odMlTaken: odMl,
      present: present,
      odMlApprovedPct: odMlPct,
      attendancePct,
    });
  }

  return { records, notes };
}

// ---------------------------------------------------------------------------
// 3. TIMETABLE TRANSFORMER
// ---------------------------------------------------------------------------

export interface TimetableSlot {
  time: string;
  classDetails: string;
}

export interface TimetableDay {
  day: string;
  slots: TimetableSlot[];
}

export interface TimetableSubject {
  code: string;
  name: string;
  ltpc: string;
  faculty: string;
  room: string;
}

export interface TimetableModel {
  timeSlots: string[];
  days: TimetableDay[];
  subjects: TimetableSubject[];
}

function looksLikeLtpc(value: string) {
  return /^\d+\s*-\s*\d+\s*-\s*\d+\s*-\s*\d+$/i.test(normalizeRawValue(value));
}

function looksLikeRoom(value: string) {
  const normalized = normalizeRawValue(value);
  if (!normalized) return false;
  return /(?:\(|\b)([A-Z]{1,3}\s*\d{2,4})(?:\)|\b)/i.test(normalized);
}

export function transformTimetable(rawData: unknown): TimetableModel {
  const empty: TimetableModel = { timeSlots: [], days: [], subjects: [] };

  const data = rawData as Record<string, unknown>;
  const section = (data?.Academic as Record<string, unknown>)?.["Time Table"] as Record<string, unknown>;
  if (!section?.tables || !Array.isArray(section.tables) || section.tables.length < 2) return empty;

  const scheduleTable = section.tables[0] as Record<string, unknown>[];
  const subjectTable = section.tables[1] as Record<string, unknown>[];

  const timeHeaderRow =
    scheduleTable.find((row) => {
      const numericKeys = Object.keys(row || {}).filter((key) => /^\d+$/.test(key));
      if (!numericKeys.length) return false;
      return numericKeys.some((key) => normalizeRawValue(row[key]).includes(":"));
    }) ||
    scheduleTable.find((row) => Object.keys(row || {}).some((key) => /^\d+$/.test(key))) ||
    {};
  const timeSlotKeys = Object.keys(timeHeaderRow).filter(k => /^\d+$/.test(k));
  const timeSlots = timeSlotKeys.map(k => normalizeRawValue(timeHeaderRow[k])).filter(Boolean);

  const days: TimetableDay[] = [];
  for (const row of scheduleTable) {
    const dayName = normalizeRawValue(row.col1 ?? row.col2 ?? row["Day"]);
    if (!dayName || dayName === "-") continue;

    const slots: TimetableSlot[] = timeSlotKeys.map((key, idx) => ({
      time: timeSlots[idx] ?? `Period ${idx + 1}`,
      classDetails: normalizeRawValue(row[key]) === "-" ? "" : normalizeRawValue(row[key]),
    }));

    days.push({ day: dayName, slots });
  }

  const subjects: TimetableSubject[] = [];
  const seen = new Set<string>();

  for (const row of subjectTable) {
    const code = normalizeRawValue(row["Subject Code"] || row["Code"] || row.col1);
    if (!code || code === "-" || code.toLowerCase() === "subject code") continue;
    if (seen.has(code)) continue;
    seen.add(code);

    const name = normalizeRawValue(
      row["Subject Description"] || row["Subject Desc"] || row["Subject Name"] || row["Description"] || row.col2
    );
    const ltpc = normalizeRawValue(row["L-T-P-C"] || row["LTPC"] || row.col3);
    const faculty = normalizeRawValue(
      row["Faculty Name"] || row["Faculty"] || row["Staff Name"] || row.col4
    );
    const roomCandidate = normalizeRawValue(
      row["Class Room Name"] || row["Room"] || row["Class Room"] || row.col5
    );
    const room = looksLikeRoom(roomCandidate) ? roomCandidate : "";

    subjects.push({
      code,
      name: name || code,
      ltpc: looksLikeLtpc(ltpc) ? ltpc : "",
      faculty: faculty || "",
      room,
    });
  }

  return { timeSlots, days, subjects };
}

// ---------------------------------------------------------------------------
// 3a. COURSE REGISTRATION TRANSFORMER
// ---------------------------------------------------------------------------

export interface CourseRegistrationSubject {
  semester: string;
  code: string;
  description: string;
  credit: string;
  group: string;
  subjectPart: string;
}

export interface CourseRegistrationModel {
  subjects: CourseRegistrationSubject[];
}

export function transformCourseRegistration(rawData: unknown): CourseRegistrationModel {
  const empty: CourseRegistrationModel = { subjects: [] };
  const data = rawData as Record<string, unknown>;
  const section = (data?.Academic as Record<string, unknown>)?.["Course Registration"] as Record<string, unknown>;
  const tables = section?.tables as Array<Array<Record<string, unknown>>> | undefined;

  if (!tables || tables.length === 0 || !Array.isArray(tables[0])) {
    return empty;
  }

  const subjects = tables[0]
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      semester: normalizeRawValue(row["Semester"]),
      code: normalizeRawValue(row["Subject Code"] || row["Code"]),
      description: normalizeRawValue(row["Subject Desc"] || row["Description"] || row["Subject Description"]),
      credit: normalizeRawValue(row["Credit"]),
      group: normalizeRawValue(row["Group"]),
      subjectPart: normalizeRawValue(row["Subject Part"]),
    }))
    .filter((row) => row.code && row.code.toLowerCase() !== "subject code");

  return { subjects };
}

// ---------------------------------------------------------------------------
// 3b. CURRICULUM TRANSFORMER
// ---------------------------------------------------------------------------

export interface CurriculumSubject {
  semester: string;
  code: string;
  description: string;
  credit: string;
  group: string;
}

export interface CurriculumModel {
  subjects: CurriculumSubject[];
}

export function transformCurriculum(rawData: unknown): CurriculumModel {
  const empty: CurriculumModel = { subjects: [] };
  const data = rawData as Record<string, unknown>;
  
  // Try to find the subjects table
  // Based on context, it's often under Academic -> "Student Wise Subjects"
  const section = (data?.Academic as Record<string, unknown>)?.["Student Wise Subjects"] as Record<string, unknown>;
  const tables = section?.tables as Array<Array<Record<string, unknown>>> | undefined;
  
  if (!tables || tables.length === 0) return empty;

  const subjectsTable = tables[0];
  const subjects: CurriculumSubject[] = [];

  for (let i = 0; i < subjectsTable.length; i++) {
    const row = subjectsTable[i];
    const semester = normalizeRawValue(row["Semester"] || row.col1);
    const code = normalizeRawValue(row["Code"] || row.col2);
    const description = normalizeRawValue(row["Description"] || row.col3);
    const credit = normalizeRawValue(row["Credit"] || row.col4);
    const group = normalizeRawValue(row["Group"] || row.col5);

    // Skip headers
    if (!code || code.toLowerCase() === "code" || code === "-") continue;

    subjects.push({
      semester,
      code,
      description,
      credit,
      group
    });
  }

  return { subjects };
}

// ---------------------------------------------------------------------------
// 3b. CURRENT RESULTS TRANSFORMER
// ---------------------------------------------------------------------------

export interface CurrentResultSubject {
  semester: string;
  subjectCode: string;
  subjectDescription: string;
  credit: string;
  grade: string;
  result: string;
}

export interface CurrentResultModel {
  title: string;
  sgpa: string;
  subjects: CurrentResultSubject[];
  disclaimer: string;
}

function transformCurrentResults(rawData: unknown): Partial<CurrentResultModel> {
  if (!rawData || typeof rawData !== "object") return {};
  
  // Drill into Examination -> Current Semester Results
  const root = rawData as Record<string, unknown>;
  const examination = root.Examination as Record<string, unknown> | undefined;
  const section = (examination?.["Current Semester Results"] as Record<string, unknown> | undefined) || root;
  const title = normalizeRawValue(section.title);
  const textRaw = normalizeRawValue(section.text || "");
  
  // Extract SGPA
  const sgpaMatch = textRaw.match(/S\.G\.P\.A\s+([\d.]+)/i);
  let sgpa = sgpaMatch ? sgpaMatch[1] : "";

  // Extract disclaimer
  const disclaimerMatch = textRaw.match(/Disclaimer:(.*)/is);
  const disclaimer = disclaimerMatch ? disclaimerMatch[1].trim() : "";

  const subjects: CurrentResultSubject[] = [];
  const tables = section.tables;
  
  if (Array.isArray(tables) && Array.isArray(tables[0])) {
    const table = tables[0];
    for (const record of table) {
      if (!record || typeof record !== "object") continue;
      
      const r = record as Record<string, unknown>;
      const sem = normalizeRawValue(r.Semester);
      const code = normalizeRawValue(r["Subject Code"]);
      
      // Some rows hold SGPA or Disclaimer at the bottom inside the table
      if (sem.toUpperCase() === "S.G.P.A") {
        if (!sgpa) sgpa = code; // the next column usually
        continue;
      }
      if (sem.toLowerCase().includes("disclaimer") || code.toLowerCase().includes("disclaimer")) {
        continue;
      }

      if (code && sem) {
        subjects.push({
          semester: sem,
          subjectCode: code,
          subjectDescription: normalizeRawValue(r["Subject Description"]),
          credit: normalizeRawValue(r.Credit),
          grade: normalizeRawValue(r.Grade),
          result: normalizeRawValue(r.Result),
        });
      }
    }
  }

  return { title, sgpa, subjects, disclaimer };
}

// ---------------------------------------------------------------------------
// 3c. FEE DUES TRANSFORMER
// ---------------------------------------------------------------------------

export interface FeeDueRecord {
  category: string;
  head: string;
  dueAmount: string;
  collectedAmount: string;
  toBePaidAmount: string;
}

export interface FeeDuesModel {
  title: string;
  records: FeeDueRecord[];
  noDues: boolean;
}

function transformFeeDues(rawData: unknown): Partial<FeeDuesModel> {
  if (!rawData || typeof rawData !== "object") return { noDues: true, records: [] };
  
  const root = rawData as Record<string, unknown>;
  const finance = root.Finance as Record<string, unknown> | undefined;
  const section = (finance?.["Fee Due Details"] as Record<string, unknown> | undefined) || root;
  const title = normalizeRawValue(section.title) || "Fee Dues";
  const records: FeeDueRecord[] = [];
  let noDues = false;

  const tables = section.tables;
  if (Array.isArray(tables) && Array.isArray(tables[0])) {
    const table = tables[0];
    for (const record of table) {
      if (!record || typeof record !== "object") continue;
      const r = record as Record<string, unknown>;
      
      const slNo = normalizeRawValue(r["Sl.No."]);
      if (slNo.toLowerCase().includes("no fee dues")) {
        noDues = true;
        break;
      }

      const cat = normalizeRawValue(r["Fee Category"]);
      const head = normalizeRawValue(r["Fee Head"]);
      if (cat || head) {
        records.push({
          category: cat,
          head: head,
          dueAmount: normalizeRawValue(r["Due Amount (INR)"]),
          collectedAmount: normalizeRawValue(r["Collected (INR)"]),
          toBePaidAmount: normalizeRawValue(r["To be Paid Amount (INR)"]),
        });
      }
    }
  } else {
    noDues = true;
  }

  return { title, records, noDues: noDues || records.length === 0 };
}

// ---------------------------------------------------------------------------
// 4. PROFILE TRANSFORMER
// ---------------------------------------------------------------------------

export interface StudentProfile {
  studentName: string;
  registerNo: string;
  dob: string;
  gender: string;
  academicYear: string;
  program: string;
  specialization: string;
  section: string;
  currentSemester: string;
  fatherName: string;
  motherName: string;
  contactNumber: string;
  email: string;
}

const splitField = (field: string, separator: string = " / ") => {
  return field ? field.split(separator).map(item => item.trim()) : ["", ""];
};

const readField = (tableContent: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) {
    const value = tableContent[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

export function transformProfileData(rawData: unknown): StudentProfile {
  const tableContent = (rawData as Record<string, unknown>) || {};
  const dobGender = readField(tableContent, "D.O.B. / Gender", "DOB / Gender");
  const programSection = readField(tableContent, "Program / Section", "Programme / Section");
  const contactEmail = readField(
    tableContent,
    "Student Contact Number / Email",
    "Student Contact No / Email",
    "Contact Number / Email"
  );
  const parentNames = readField(
    tableContent,
    "Father Name / Mother Name",
    "Father / Mother Name"
  );

  const [compoundDob, compoundGender] = splitField(dobGender);
  const [compoundProgram, compoundSection] = splitField(programSection);
  const [compoundContact, compoundEmail] = splitField(contactEmail);
  const [compoundFatherName, compoundMotherName] = splitField(parentNames);

  return {
    studentName: readField(tableContent, "Student Name", "Name", "Register No.", "Register No") || "N/A",
    registerNo: readField(tableContent, "Register No.", "Register No", "Register Number", "Registration Number") || "N/A",
    dob: compoundDob || readField(tableContent, "D.O.B.", "DOB", "Date of Birth") || "N/A",
    gender: compoundGender || readField(tableContent, "Gender") || "N/A",
    academicYear: readField(tableContent, "Academic Year", "A.Y.") || "2025-2026",
    program: compoundProgram || readField(tableContent, "Program", "Programme") || "N/A",
    specialization: readField(tableContent, "Specialization", "Branch") || "N/A",
    section: compoundSection || readField(tableContent, "Section") || "N/A",
    currentSemester: readField(tableContent, "Semester", "Current Semester") || "N/A",
    fatherName: compoundFatherName || readField(tableContent, "Father Name") || "N/A",
    motherName: compoundMotherName || readField(tableContent, "Mother Name") || "N/A",
    contactNumber: (compoundContact || readField(tableContent, "Student Contact Number", "Contact Number", "Mobile Number")).replace(/\s*\((Verified|Unverified)\s*\)\s*/i, '').trim() || "N/A",
    email: compoundEmail || readField(tableContent, "Email", "Student Email") || "N/A",
  };
}

// ---------------------------------------------------------------------------
// 5. INTERNAL MARKS TRANSFORMER
// ---------------------------------------------------------------------------

export interface InternalMarkSubject {
  code: string;
  description: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  status: "excellent" | "good" | "needs-improvement";
  detailTableIndex: number;
}

export interface InternalMarksModel {
  subjects: InternalMarkSubject[];
  averagePercentage: number;
}

interface TableSection {
  tables?: Array<Array<Record<string, unknown>>>;
  [key: string]: unknown;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractSubjects(rows: Array<Record<string, unknown>>): InternalMarkSubject[] {
  return rows
    .filter((row) => {
      const code = String(row?.["Subject Code"] ?? "").trim();
      const description = String(row?.["Subject Description"] ?? "").trim();
      const hasMarks = row?.["Marks Obtained"] !== undefined && row?.["Max.Marks"] !== undefined;

      if (!code || !description || !hasMarks) return false;
      if (/^name$/i.test(code) || /^subject code$/i.test(code)) return false;
      if (/^name$/i.test(description) || /^subject description$/i.test(description)) return false;
      if (/mark secured\(conducted\)/i.test(description)) return false;
      if (/cla|mid semester/i.test(code) || /cla|mid semester/i.test(description)) return false;

      return true;
    })
    .map((row, index) => {
      const marksObtained = toNumber(row?.["Marks Obtained"], 0);
      const maxMarks = toNumber(row?.["Max.Marks"], 100);
      const percentage = maxMarks > 0 ? (marksObtained / maxMarks) * 100 : 0;

      return {
        code: String(row?.["Subject Code"] ?? "Unknown"),
        description: String(row?.["Subject Description"] ?? ""),
        marksObtained,
        maxMarks,
        percentage,
        status: percentage >= 80 ? "excellent" : percentage >= 60 ? "good" : "needs-improvement",
        detailTableIndex: index + 1,
      };
    });
}

function normalizeInternalMarksSource(marksData?: unknown): TableSection | null {
  const root = marksData && typeof marksData === "object" ? (marksData as Record<string, unknown>) : null;
  const examination = root?.Examination as Record<string, unknown> | undefined;
  const academic = root?.Academic as Record<string, unknown> | undefined;
  const examinationMarks = examination?.["Internal Mark Details"] as TableSection | undefined;
  const academicMarks = academic?.["Internal Mark Details"] as TableSection | undefined;

  if (Array.isArray(examinationMarks?.tables?.[0])) {
    return examinationMarks;
  }

  if (Array.isArray(academicMarks?.tables?.[0])) {
    return academicMarks;
  }

  if (academic && typeof academic === "object") {
    for (const [key, value] of Object.entries(academic)) {
      if (!/internal|mark/i.test(key)) continue;
      const candidate = value as TableSection | undefined;
      if (Array.isArray(candidate?.tables?.[0])) {
        return candidate;
      }
    }
  }

  return null;
}

export function transformInternalMarks(rawData: unknown): InternalMarksModel | null {
  const source = normalizeInternalMarksSource(rawData);
  if (!source?.tables?.[0] || !Array.isArray(source.tables[0])) return null;

  const rawRows = source.tables[0];
  const subjects = extractSubjects(rawRows);
  if (!subjects.length) return null;

  const validSubjects = subjects.filter((s) => s.maxMarks > 0);
  const averagePercentage = validSubjects.length
    ? validSubjects.reduce((acc, curr) => acc + curr.percentage, 0) / validSubjects.length
    : 0;

  return { subjects, averagePercentage };
}

// ---------------------------------------------------------------------------
// 6. PIPELINE REGISTRY, SCHEMA & PARTIAL VALIDATION
// ---------------------------------------------------------------------------

export type FieldType = "string" | "number" | "boolean" | "array" | "object";

export interface SchemaField {
  type: FieldType;
  required: boolean;
  itemSchema?: SchemaDefinition; 
  objectSchema?: SchemaDefinition; 
}

export type SchemaDefinition = Record<string, SchemaField>;

// Explicit schemas to define valid data shapes
const attendanceRecordSchema: SchemaDefinition = {
  subjectCode: { type: "string", required: true },
  subjectDescription: { type: "string", required: true },
  classesConducted: { type: "number", required: true },
  attendanceEntered: { type: "number", required: true },
  odMlTaken: { type: "number", required: true },
  present: { type: "number", required: true },
  odMlApprovedPct: { type: "number", required: true },
  attendancePct: { type: "number", required: true },
};

const attendanceSchema: SchemaDefinition = {
  records: { type: "array", required: true, itemSchema: attendanceRecordSchema },
  notes: { type: "array", required: false },
};

const internalMarkSubjectSchema: SchemaDefinition = {
  code: { type: "string", required: true },
  description: { type: "string", required: true },
  marksObtained: { type: "number", required: true },
  maxMarks: { type: "number", required: true },
  percentage: { type: "number", required: true },
  status: { type: "string", required: true },
  detailTableIndex: { type: "number", required: true },
};

const internalMarksSchema: SchemaDefinition = {
  subjects: { type: "array", required: true, itemSchema: internalMarkSubjectSchema },
  averagePercentage: { type: "number", required: true },
};

const profileSchema: SchemaDefinition = {
  studentName: { type: "string", required: true },
  registerNo: { type: "string", required: true },
  dob: { type: "string", required: true },
  gender: { type: "string", required: true },
  academicYear: { type: "string", required: true },
  program: { type: "string", required: true },
  specialization: { type: "string", required: true },
  section: { type: "string", required: true },
  currentSemester: { type: "string", required: true },
  fatherName: { type: "string", required: true },
  motherName: { type: "string", required: true },
  contactNumber: { type: "string", required: true },
  email: { type: "string", required: true },
};

const timetableSlotSchema: SchemaDefinition = {
  time: { type: "string", required: true },
  classDetails: { type: "string", required: false },
};

const timetableDaySchema: SchemaDefinition = {
  day: { type: "string", required: true },
  slots: { type: "array", required: true, itemSchema: timetableSlotSchema },
};

const timetableSubjectSchema: SchemaDefinition = {
  code: { type: "string", required: true },
  name: { type: "string", required: true },
  ltpc: { type: "string", required: true },
  faculty: { type: "string", required: true },
  room: { type: "string", required: false },
};

const timetableSchema: SchemaDefinition = {
  timeSlots: { type: "array", required: true },
  days: { type: "array", required: true, itemSchema: timetableDaySchema },
  subjects: { type: "array", required: true, itemSchema: timetableSubjectSchema },
};

const currentResultSubjectSchema: SchemaDefinition = {
  semester: { type: "string", required: true },
  subjectCode: { type: "string", required: true },
  subjectDescription: { type: "string", required: true },
  credit: { type: "string", required: false }, // Some are empty for non-credit courses
  grade: { type: "string", required: true },
  result: { type: "string", required: true },
};

const currentResultsSchema: SchemaDefinition = {
  title: { type: "string", required: false },
  sgpa: { type: "string", required: false },
  subjects: { type: "array", required: true, itemSchema: currentResultSubjectSchema },
  disclaimer: { type: "string", required: false },
};

const feeDueRecordSchema: SchemaDefinition = {
  category: { type: "string", required: true },
  head: { type: "string", required: true },
  dueAmount: { type: "string", required: true },
  collectedAmount: { type: "string", required: true },
  toBePaidAmount: { type: "string", required: true },
};

const feeDuesSchema: SchemaDefinition = {
  title: { type: "string", required: true },
  records: { type: "array", required: true, itemSchema: feeDueRecordSchema },
  noDues: { type: "boolean", required: true },
};

const curriculumSubjectSchema: SchemaDefinition = {
  semester: { type: "string", required: true },
  code: { type: "string", required: true },
  description: { type: "string", required: true },
  credit: { type: "string", required: true },
  group: { type: "string", required: true },
};

const curriculumSchema: SchemaDefinition = {
  subjects: { type: "array", required: true, itemSchema: curriculumSubjectSchema },
};

const courseRegistrationSubjectSchema: SchemaDefinition = {
  semester: { type: "string", required: true },
  code: { type: "string", required: true },
  description: { type: "string", required: true },
  credit: { type: "string", required: true },
  group: { type: "string", required: false },
  subjectPart: { type: "string", required: false },
};

const courseRegistrationSchema: SchemaDefinition = {
  subjects: { type: "array", required: true, itemSchema: courseRegistrationSubjectSchema },
};

// ---------------------------------------------------------------------------
// 3d. FEES PAID TRANSFORMER
// ---------------------------------------------------------------------------

export interface FeePaidRecord {
  slNo: string;
  amount: string;
  date: string;
  receiptNo: string;
  particulars: string;
}

export interface FeesPaidModel {
  title: string;
  records: FeePaidRecord[];
}

const feePaidRecordSchema: SchemaDefinition = {
  slNo: { type: "string", required: true },
  amount: { type: "string", required: true },
  date: { type: "string", required: true },
  receiptNo: { type: "string", required: true },
  particulars: { type: "string", required: true },
};

const feesPaidSchema: SchemaDefinition = {
  title: { type: "string", required: true },
  records: { type: "array", required: true, itemSchema: feePaidRecordSchema },
};

function transformFeesPaid(rawData: unknown): Partial<FeesPaidModel> {
  if (!rawData || typeof rawData !== "object") return { records: [] };

  const root = rawData as Record<string, unknown>;
  
  // 1. ROBUST SECTION DISCOVERY
  // Search for the "Fee Paid Details" block or use the root if it looks like the data we want
  const findBlock = (obj: unknown): Record<string, unknown> | null => {
    if (!obj || typeof obj !== "object") return null;
    const record = obj as Record<string, unknown>;
    if (record["Fee Paid Details"] && typeof record["Fee Paid Details"] === "object") {
      return record["Fee Paid Details"] as Record<string, unknown>;
    }
    if (Array.isArray(record.tables)) return record;

    for (const key of Object.keys(record)) {
      if (typeof record[key] === "object") {
        const found = findBlock(record[key]);
        if (found) return found;
      }
    }
    return null;
  };

  const section = findBlock(root) || root;

  const title = normalizeRawValue(section.title) || "Payment Receipts";
  const records: FeePaidRecord[] = [];

  // 2. RESILIENT TABLE PROCESSING
  const tables = section.tables;
  if (Array.isArray(tables) && tables.length > 0) {
    // Find the likely data table (the one with the most columns or specific headers)
    const table = tables.find(t => Array.isArray(t) && t.length > 0) || tables[0];
    
    if (Array.isArray(table)) {
      for (const record of table) {
        if (!record || typeof record !== "object") continue;
        const r = record as Record<string, unknown>;

        // 3. ENHANCED COLUMN MAPPING
        // We use various permutations seen in university ERP scraped data
        const slNo = normalizeRawValue(
          r["Sl.No."] || r["Sl. No."] || r["S.No."] || r["SNo"] || r.col1
        );
        
        const amount = normalizeRawValue(
          r["Amount (Paid)"] || r["Amount"] || r["Amount (INR)"] || r["Total Amount"] || r.col2
        );
        
        const date = normalizeRawValue(
          r["Receipt Date"] || r["Date"] || r["Date of Payment"] || r.col3
        );
        
        const receiptNo = normalizeRawValue(
          r["Receipt No."] || r["Receipt No"] || r["Receipt Number"] || r["Ref No"] || r.col4
        );
        
        const particulars = normalizeRawValue(
          r["Particulars"] || r["Description"] || r.col5
        ) || "Fee Payment";

        // Logic check: A valid record MUST have at least a receipt number and an amount.
        // Sl No is optional but preferred.
        if (amount && receiptNo) {
          records.push({
            slNo: slNo || "-",
            amount,
            date: date || "-",
            receiptNo,
            particulars,
          });
        }
      }
    }
  }

  return { title, records };
}

export type TransformerFn = (rawData: unknown) => unknown;

const registry: Record<string, TransformerFn> = {
  attendance: transformAttendance,
  "internal-marks": transformInternalMarks,
  profile: transformProfileData,
  timetable: transformTimetable,
  "course-registration": transformCourseRegistration,
  curriculum: transformCurriculum,
  "results-current": transformCurrentResults,
  "finance-dues": transformFeeDues,
  "finance-paid": transformFeesPaid,
};

const schemas: Record<string, SchemaDefinition> = {
  attendance: attendanceSchema,
  "internal-marks": internalMarksSchema,
  profile: profileSchema,
  timetable: timetableSchema,
  "course-registration": courseRegistrationSchema,
  curriculum: curriculumSchema,
  "results-current": currentResultsSchema,
  "finance-dues": feeDuesSchema,
  "finance-paid": feesPaidSchema,
};

// Derive key dynamically, removing hardcoded coupling
export function deriveTransformerKey(source: string | PageBlueprint): string {
  if (typeof source === "string") return source;
  const renderer = source.renderer;
  if (registry[renderer]) return renderer;
  return renderer; // generic/fallback mappings
}

export interface TransformerOutput<T = unknown> {
  type: string;
  data: Partial<T> | null;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates untyped blob against a schema map. Allows partial data retention.
 */
function enforceSchema(
  data: unknown,
  schema: SchemaDefinition,
  path = "root"
): { validData: unknown; errors: string[]; warnings: string[] } {
  const result: Record<string, unknown> = {};
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (typeof data !== "object" || data === null) {
     return { validData: null, errors: [`${path} expected object but got ${typeof data}`], warnings };
  }

  const dataRecord = data as Record<string, unknown>;

  for (const [key, fieldDef] of Object.entries(schema)) {
     const value = dataRecord[key];
     const fieldPath = `${path}.${key}`;

     if (value === undefined || value === null) {
       if (fieldDef.required) {
         errors.push(`Missing required field: ${fieldPath}`);
       } else {
         warnings.push(`Missing optional field: ${fieldPath}`);
       }
       continue;
     }

     if (fieldDef.type === "array") {
       if (!Array.isArray(value)) {
         errors.push(`Expected array at ${fieldPath}`);
       } else {
         if (fieldDef.itemSchema) {
           const validItems: unknown[] = [];
           for (let i = 0; i < value.length; i++) {
             const { validData: itemData, errors: itemErrors, warnings: itemWarnings } = enforceSchema(value[i], fieldDef.itemSchema, `${fieldPath}[${i}]`);
             if (itemErrors.length > 0) {
               warnings.push(`Dropped invalid item at ${fieldPath}[${i}]: ${itemErrors.join(", ")}`);
               // We purposefully drop invalid row rendering cascades here!
             } else {
               validItems.push(itemData);
             }
             warnings.push(...itemWarnings);
           }
           result[key] = validItems;
         } else {
           result[key] = value;
         }
       }
       continue;
     }

     if (fieldDef.type === "object") {
       if (typeof value !== "object" || Array.isArray(value)) {
         errors.push(`Expected object at ${fieldPath}`);
       } else if (fieldDef.objectSchema) {
         const { validData: objData, errors: objErrors, warnings: objWarnings } = enforceSchema(value, fieldDef.objectSchema, fieldPath);
         errors.push(...objErrors);
         warnings.push(...objWarnings);
         result[key] = objData;
       } else {
         result[key] = value;
       }
       continue;
     }

     const actualType = typeof value;
     if (actualType !== fieldDef.type) {
       errors.push(`Type mismatch at ${fieldPath}: expected ${fieldDef.type}, got ${actualType}`);
       continue;
     }

     if (fieldDef.type === "number" && Number.isNaN(value as number)) {
       errors.push(`NaN detected at ${fieldPath}`);
       continue;
     }

     if (fieldDef.type === "string" && typeof value === "string" && value.includes("[object Object]")) {
       errors.push(`Object leakage detected at ${fieldPath}`);
       continue;
     }

     result[key] = value;
  }

  return { validData: result, errors, warnings };
}

/**
 * Main pipeline execution entry point.
 */
export function executePipeline(source: string | PageBlueprint, rawData: unknown): TransformerOutput {
  const pageType = deriveTransformerKey(source);
  const transformer = registry[pageType];
  
  if (!transformer) {
    return {
      type: pageType || "generic",
      data: null, // Avoid returning un-schema'd data blob to the UI layer
      isValid: false,
      errors: [`No transformer registered for ${pageType}`],
      warnings: ["Generic fallback executed"]
    };
  }

  try {
    const rawResult = transformer(rawData);
    if (!rawResult || typeof rawResult !== "object") {
      return { type: pageType, data: null, isValid: false, errors: ["Transformer returned invalid root object"], warnings: [] };
    }

    const schema = schemas[pageType];
    if (!schema) {
      return { type: pageType, data: rawResult, isValid: true, errors: [], warnings: ["Unchecked schema"] };
    }

    const { validData, errors, warnings } = enforceSchema(rawResult, schema);
    const validRecord =
      validData && typeof validData === "object" ? (validData as Record<string, unknown>) : null;
    
    // Partial Validation Rule: If validData contains any resolved properties, we can attempt to render.
    const hasDataKeys = Boolean(validRecord && Object.keys(validRecord).length > 0);
    
    return {
      type: pageType,
      data: hasDataKeys ? validRecord : null,
      isValid: hasDataKeys,
      errors,
      warnings
    };

  } catch (error: unknown) {
    console.error(`Pipeline transformation failed for ${pageType}:`, error);
    const message = error instanceof Error ? error.message : "Transformer runtime exception";
    return { 
      type: pageType, 
      data: null, 
      isValid: false, 
      errors: [message], 
      warnings: [] 
    };
  }
}
